CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `donation_request` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alias` text,
	`location` text,
	`note` text,
	`items_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text,
	`created_at` text DEFAULT '2026-08-23T15:07:46.605Z' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_donation_status` ON `donation_request` (`status`);--> statement-breakpoint
CREATE TABLE `donor` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`alias` text,
	`batch_code` text,
	`contact` text,
	`created_at` text DEFAULT '2026-08-23T15:07:46.605Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `donor_batch_code_unique` ON `donor` (`batch_code`);--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`content` text NOT NULL,
	`rating` integer,
	`contact` text,
	`created_at` text DEFAULT '2026-08-23T15:07:46.605Z' NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_feedback_item` ON `feedback` (`item_id`);--> statement-breakpoint
CREATE TABLE `item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`batch_code` text,
	`donor_id` integer,
	`name` text NOT NULL,
	`category` text,
	`condition` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit` text DEFAULT '件',
	`description` text,
	`price` real,
	`photo` text,
	`photo_thumb` text,
	`status` text DEFAULT 'received' NOT NULL,
	`note` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT '2026-08-23T15:07:46.605Z' NOT NULL,
	`updated_at` text DEFAULT '2026-08-23T15:07:46.605Z' NOT NULL,
	FOREIGN KEY (`donor_id`) REFERENCES `donor`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_code_unique` ON `item` (`code`);--> statement-breakpoint
CREATE INDEX `idx_item_code` ON `item` (`code`);--> statement-breakpoint
CREATE INDEX `idx_item_status` ON `item` (`status`);--> statement-breakpoint
CREATE INDEX `idx_item_batch` ON `item` (`batch_code`);--> statement-breakpoint
CREATE TABLE `label_template` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`width_mm` real NOT NULL,
	`height_mm` real NOT NULL,
	`fields` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT '2026-08-23T15:07:46.605Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prev_hash` text DEFAULT '' NOT NULL,
	`hash` text NOT NULL,
	`ref_type` text NOT NULL,
	`ref_id` integer,
	`action` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ledger_ref` ON `ledger` (`ref_type`,`ref_id`);--> statement-breakpoint
CREATE TABLE `login_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`login_name` text,
	`ipaddr` text,
	`login_location` text,
	`browser` text,
	`os` text,
	`status` integer DEFAULT 0 NOT NULL,
	`msg` text,
	`login_time` text DEFAULT '2026-08-23T15:07:46.605Z' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_login_status` ON `login_log` (`status`);--> statement-breakpoint
CREATE INDEX `idx_login_time` ON `login_log` (`login_time`);--> statement-breakpoint
CREATE TABLE `oper_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text,
	`business_type` integer DEFAULT 0 NOT NULL,
	`method` text,
	`request_method` text,
	`operator_type` integer DEFAULT 1 NOT NULL,
	`oper_name` text,
	`oper_url` text,
	`oper_ip` text,
	`oper_param` text,
	`json_result` text,
	`status` integer DEFAULT 0 NOT NULL,
	`error_msg` text,
	`cost_time` integer,
	`created_at` text DEFAULT '2026-08-23T15:07:46.605Z' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_oper_btype` ON `oper_log` (`business_type`);--> statement-breakpoint
CREATE INDEX `idx_oper_status` ON `oper_log` (`status`);--> statement-breakpoint
CREATE INDEX `idx_oper_time` ON `oper_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `pending_entry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payload` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT '2026-08-23T15:07:46.605Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `store` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text DEFAULT '示例二手慈善商店' NOT NULL,
	`slogan` text DEFAULT '让每一份善意都有去处',
	`public_enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT '2026-08-23T15:07:46.604Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`created_at` text DEFAULT '2026-08-23T15:07:46.605Z' NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_roles_user` ON `user_roles` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_roles` ON `user_roles` (`user_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`display_name` text,
	`disabled` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);