CREATE TABLE `project_modifiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`modifier_id` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`modifier_id`) REFERENCES `stack_modifiers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_modifiers_uq` ON `project_modifiers` (`project_id`,`modifier_id`);--> statement-breakpoint
CREATE TABLE `stack_modifiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`multiplier` real DEFAULT 1 NOT NULL,
	`note` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stack_modifiers_name_unique` ON `stack_modifiers` (`name`);--> statement-breakpoint
ALTER TABLE `activities` ADD `count_unit` text DEFAULT 'ต่อรายการ' NOT NULL;