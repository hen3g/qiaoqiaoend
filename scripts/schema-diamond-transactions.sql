-- Diamond ledger for spend/grant history. App also auto-migrates via ensureDiamondTransactionsTable().
CREATE TABLE IF NOT EXISTS diamond_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  amount INT NOT NULL COMMENT 'negative = spend, positive = grant',
  balance_after INT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL,
  meta JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dt_user_created (user_id, created_at),
  KEY idx_dt_user_amount_created (user_id, amount, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
