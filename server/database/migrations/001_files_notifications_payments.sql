-- =====================================================================
-- 001 — Fichiers, envois de notifications, push navigateur,
--       sessions de paiement en ligne, préférences utilisateur.
-- =====================================================================

-- Fichiers téléversés (stockés hors base, sur disque ou S3, par tenant)
CREATE TABLE files (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id      BIGINT UNSIGNED NOT NULL,
  owner_user_id  BIGINT UNSIGNED NULL,
  kind           ENUM('attendance_proof','homework','lost_photo','logo','document','course','import','other') NOT NULL,
  original_name  VARCHAR(255) NOT NULL,
  mime           VARCHAR(100) NOT NULL,
  size_bytes     INT UNSIGNED NOT NULL,
  storage_key    VARCHAR(255) NOT NULL,
  sha256         CHAR(64) NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_files_tid (tenant_id, id),
  KEY ix_files_owner (tenant_id, owner_user_id),
  CONSTRAINT fk_files_owner FOREIGN KEY (tenant_id, owner_user_id) REFERENCES users(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historique des envois externes (email, SMS, push)
CREATE TABLE notification_deliveries (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  notification_id BIGINT UNSIGNED NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  channel         ENUM('email','sms','push') NOT NULL,
  status          ENUM('sent','failed','skipped') NOT NULL,
  provider        VARCHAR(30) NOT NULL,
  destination     VARCHAR(255) NULL,
  error           VARCHAR(500) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_deliv_date (tenant_id, created_at),
  CONSTRAINT fk_deliv_user FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Abonnements Web Push (un par navigateur / appareil)
CREATE TABLE push_subscriptions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  endpoint    VARCHAR(700) NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,
  p256dh      VARCHAR(255) NOT NULL,
  auth        VARCHAR(255) NOT NULL,
  user_agent  VARCHAR(255) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_push_endpoint (tenant_id, endpoint_hash),
  CONSTRAINT fk_push_user FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sessions de paiement en ligne (Stripe Checkout, CMI…, ou simulé en dev)
CREATE TABLE payment_sessions (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id           BIGINT UNSIGNED NOT NULL,
  invoice_id          BIGINT UNSIGNED NOT NULL,
  created_by          BIGINT UNSIGNED NULL,
  provider            VARCHAR(20) NOT NULL,
  provider_session_id VARCHAR(255) NOT NULL,
  status              ENUM('pending','paid','expired','failed') NOT NULL DEFAULT 'pending',
  amount_cents        INT NOT NULL,
  checkout_url        VARCHAR(1000) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pay_session (provider, provider_session_id),
  CONSTRAINT fk_paysess_invoice FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Préférences utilisateur : langue d'interface et canaux de notification
ALTER TABLE users
  ADD COLUMN locale VARCHAR(5) NOT NULL DEFAULT 'fr' AFTER phone,
  ADD COLUMN notify_prefs LONGTEXT NULL CHECK (notify_prefs IS NULL OR JSON_VALID(notify_prefs)) AFTER locale;

-- Pièce jointe liée aux leçons de cours (PDF, présentation…)
ALTER TABLE course_lessons ADD COLUMN file_id BIGINT UNSIGNED NULL AFTER content_url;
