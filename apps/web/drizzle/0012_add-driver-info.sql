CREATE TABLE `drivers` (
	`samsara_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `rides` ADD `user_info_snapshot` text NOT NULL;--> statement-breakpoint
ALTER TABLE `rides` ADD `driver_id` text REFERENCES drivers(samsara_id);