CREATE TABLE `project_activity_qty` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`activity_id` integer NOT NULL,
	`complexity` text NOT NULL,
	`qty` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_activity_qty_uq` ON `project_activity_qty` (`project_id`,`activity_id`,`complexity`);--> statement-breakpoint
CREATE TABLE `questionnaire_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`questionnaire_id` integer NOT NULL,
	`activity_id` integer NOT NULL,
	`help_text` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`questionnaire_id`) REFERENCES `questionnaires`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questionnaire_activities_uq` ON `questionnaire_activities` (`questionnaire_id`,`activity_id`);