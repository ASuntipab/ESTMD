ALTER TABLE `projects` ADD `buffer_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `roles` ADD `seniority` text DEFAULT 'junior' NOT NULL;--> statement-breakpoint
ALTER TABLE `roles` ADD `scope` text DEFAULT 'item' NOT NULL;--> statement-breakpoint
ALTER TABLE `roles` ADD `ratio_of_dev` real;