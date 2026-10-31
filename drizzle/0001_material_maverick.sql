CREATE TABLE `contentItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`topic` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`tone` enum('professional','casual','punchy') NOT NULL,
	`status` enum('draft','approved','rejected','scheduled','published') NOT NULL DEFAULT 'draft',
	`source` enum('ai','template') NOT NULL DEFAULT 'template',
	`scheduledAt` timestamp,
	`publishedAt` timestamp,
	`usedAt` timestamp,
	`approvalNote` text,
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contentItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `content_user_status_idx` ON `contentItems` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `content_scheduled_idx` ON `contentItems` (`status`,`scheduledAt`);