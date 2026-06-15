-- follow/fix redesign: collapse the autofit enum to a two-mode string and
-- drop the floor column. 'grow'/'grow+shrink' carried the "height tracks
-- content" intent → 'follow'; everything else (NULL, legacy 'off', garbage)
-- becomes the safe fixed-height fallback → 'fix'.
--
-- DROP COLUMN requires SQLite >= 3.35.0 (Bun's bundled SQLite is well past
-- this). On an environment pinned to SQLite < 3.35, replace the DROP with a
-- table rebuild: CREATE blocks_new without min_row_span, INSERT…SELECT the
-- surviving columns, DROP blocks, ALTER blocks_new RENAME TO blocks, then
-- recreate the idx_blocks_notepage index (the composite PK rides along on
-- the rebuilt table).
UPDATE blocks SET autofit = 'follow' WHERE autofit IN ('grow', 'grow+shrink');--> statement-breakpoint
UPDATE blocks SET autofit = 'fix'    WHERE autofit IS NULL OR autofit NOT IN ('follow', 'fix');--> statement-breakpoint
ALTER TABLE `blocks` DROP COLUMN `min_row_span`;
