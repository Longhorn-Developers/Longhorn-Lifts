CREATE TABLE `admins` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`hash` text NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_email_unique` ON `admins` (`email`);--> statement-breakpoint
CREATE TABLE `dropoffLocations` (
	`id` integer PRIMARY KEY NOT NULL,
	`abbreviation` text,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pickupLocations` (
	`id` integer PRIMARY KEY NOT NULL,
	`abbreviation` text,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`type` text NOT NULL
);
