CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`sort_key` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `notepages` ADD `folder_id` text;--> statement-breakpoint
ALTER TABLE `notepages` ADD `sort_key` integer DEFAULT 0 NOT NULL;