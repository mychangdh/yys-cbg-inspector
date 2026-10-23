CREATE TABLE IF NOT EXISTS `account_summaries` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_key` CHAR(64) NOT NULL,
  `product_url` TEXT NOT NULL,
  `summary` LONGTEXT NOT NULL,
  `captured_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_summaries_product_key_key` (`product_key`),
  KEY `account_summaries_captured_at_idx` (`captured_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
