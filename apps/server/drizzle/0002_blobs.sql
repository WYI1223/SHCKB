CREATE TABLE `blobs` (
	`hash` text PRIMARY KEY NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL
);
