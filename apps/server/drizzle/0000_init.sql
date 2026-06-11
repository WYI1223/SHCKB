CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`notepage_id` text NOT NULL,
	`kind` text NOT NULL,
	`col` integer NOT NULL,
	`row` integer NOT NULL,
	`col_span` integer NOT NULL,
	`row_span` integer NOT NULL,
	`content` text NOT NULL,
	FOREIGN KEY (`notepage_id`) REFERENCES `notepages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_blocks_notepage` ON `blocks` (`notepage_id`);--> statement-breakpoint
CREATE TABLE `notepages` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text DEFAULT 'Untitled' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`gravity_enabled` integer DEFAULT true NOT NULL,
	`published_doc` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notepages_slug_unique` ON `notepages` (`slug`);