PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_blocks` (
	`id` text NOT NULL,
	`notepage_id` text NOT NULL,
	`kind` text NOT NULL,
	`col` integer NOT NULL,
	`row` integer NOT NULL,
	`col_span` integer NOT NULL,
	`row_span` integer NOT NULL,
	`content` text NOT NULL,
	PRIMARY KEY(`notepage_id`, `id`),
	FOREIGN KEY (`notepage_id`) REFERENCES `notepages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_blocks`("id", "notepage_id", "kind", "col", "row", "col_span", "row_span", "content") SELECT "id", "notepage_id", "kind", "col", "row", "col_span", "row_span", "content" FROM `blocks`;--> statement-breakpoint
DROP TABLE `blocks`;--> statement-breakpoint
ALTER TABLE `__new_blocks` RENAME TO `blocks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_blocks_notepage` ON `blocks` (`notepage_id`);