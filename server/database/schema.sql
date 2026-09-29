-- =====================================================================
-- Athénée School OS — Schéma MySQL 8 / MariaDB 10.4+ (multi-tenant)
--
-- Règles d'isolation (MySQL n'a pas de Row-Level Security) :
--   1. Chaque table métier porte `tenant_id` (indexé).
--   2. Chaque table référencée expose UNIQUE (tenant_id, id) et les enfants
--      la référencent par une clé étrangère COMPOSITE (tenant_id, xxx_id).
--      => la base REFUSE physiquement qu'un élève de l'école A pointe vers
--         une classe de l'école B.
--   3. Côté application, Sequelize ajoute automatiquement `tenant_id = ?`
--      à toutes les requêtes (src/models/tenantScope.js).
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- Plateforme SaaS (hors tenant)
-- ---------------------------------------------------------------------
CREATE TABLE plans (
  id            VARCHAR(20)  NOT NULL PRIMARY KEY,
  name          VARCHAR(60)  NOT NULL,
  price_cents   INT          NULL,
  max_students  INT          NULL,
  features      LONGTEXT     NOT NULL DEFAULT ('{}') CHECK (JSON_VALID(features))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tenants (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug           VARCHAR(60)  NOT NULL UNIQUE,
  name           VARCHAR(160) NOT NULL,
  city           VARCHAR(80)  NULL,
  plan_id        VARCHAR(20)  NOT NULL,
  custom_domain  VARCHAR(160) NULL UNIQUE,
  currency       CHAR(3)      NOT NULL DEFAULT 'MAD',
  primary_color  VARCHAR(9)   NOT NULL DEFAULT '#13254A',
  logo_url       VARCHAR(255) NULL,
  school_year    VARCHAR(9)   NOT NULL,
  settings       LONGTEXT     NOT NULL DEFAULT ('{}') CHECK (JSON_VALID(settings)),
  status         ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tenants_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Identité, sessions, audit
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id      BIGINT UNSIGNED NOT NULL,
  role           ENUM('admin','staff','accountant','teacher','nurse','parent','student','driver') NOT NULL,
  email          VARCHAR(160) NOT NULL,
  password_hash  VARCHAR(100) NULL,
  first_name     VARCHAR(80)  NOT NULL,
  last_name      VARCHAR(80)  NOT NULL,
  phone          VARCHAR(30)  NULL,
  totp_secret    VARCHAR(64)  NULL,
  totp_enabled   TINYINT(1)   NOT NULL DEFAULT 0,
  status         ENUM('active','invited','disabled') NOT NULL DEFAULT 'active',
  failed_logins  INT          NOT NULL DEFAULT 0,
  locked_until   DATETIME     NULL,
  last_login_at  DATETIME     NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (tenant_id, email),
  UNIQUE KEY uq_users_tid (tenant_id, id),
  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sessions (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id      BIGINT UNSIGNED NOT NULL,
  user_id        BIGINT UNSIGNED NOT NULL,
  refresh_hash   CHAR(64)     NOT NULL UNIQUE,
  user_agent     VARCHAR(255) NULL,
  ip             VARCHAR(45)  NULL,
  expires_at     DATETIME     NOT NULL,
  revoked_at     DATETIME     NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_sessions_user (tenant_id, user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id      BIGINT UNSIGNED NOT NULL,
  user_id        BIGINT UNSIGNED NULL,
  action         VARCHAR(120) NOT NULL,
  entity         VARCHAR(60)  NULL,
  entity_id      VARCHAR(40)  NULL,
  method         VARCHAR(8)   NULL,
  path           VARCHAR(255) NULL,
  status_code    SMALLINT     NULL,
  ip             VARCHAR(45)  NULL,
  meta           LONGTEXT     NULL CHECK (meta IS NULL OR JSON_VALID(meta)),
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_audit_tenant_date (tenant_id, created_at),
  CONSTRAINT fk_audit_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id      BIGINT UNSIGNED NOT NULL,
  user_id        BIGINT UNSIGNED NOT NULL,
  kind           VARCHAR(40)  NOT NULL,
  title          VARCHAR(200) NOT NULL,
  body           VARCHAR(500) NULL,
  link           VARCHAR(200) NULL,
  read_at        DATETIME     NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_notif_user (tenant_id, user_id, read_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Structure pédagogique
-- ---------------------------------------------------------------------
CREATE TABLE levels (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id  BIGINT UNSIGNED NOT NULL,
  name       VARCHAR(40) NOT NULL,
  cycle      ENUM('Maternelle','Primaire','Collège','Lycée') NOT NULL,
  position   INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_levels_tid (tenant_id, id),
  CONSTRAINT fk_levels_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subjects (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  name        VARCHAR(80) NOT NULL,
  short_name  VARCHAR(20) NOT NULL,
  coefficient DECIMAL(4,2) NOT NULL DEFAULT 1,
  color       VARCHAR(9) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subjects_tid (tenant_id, id),
  CONSTRAINT fk_subjects_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rooms (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id  BIGINT UNSIGNED NOT NULL,
  name       VARCHAR(40) NOT NULL,
  capacity   INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rooms_tid (tenant_id, id),
  CONSTRAINT fk_rooms_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE teachers (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  subject_id  BIGINT UNSIGNED NULL,
  hired_on    DATE NULL,
  status      ENUM('active','absent','left') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_teachers_tid (tenant_id, id),
  UNIQUE KEY uq_teachers_user (tenant_id, user_id),
  CONSTRAINT fk_teachers_user    FOREIGN KEY (tenant_id, user_id)    REFERENCES users(tenant_id, id),
  CONSTRAINT fk_teachers_subject FOREIGN KEY (tenant_id, subject_id) REFERENCES subjects(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE classes (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  level_id        BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(40) NOT NULL,
  school_year     VARCHAR(9)  NOT NULL,
  capacity        INT NOT NULL DEFAULT 30,
  room_id         BIGINT UNSIGNED NULL,
  main_teacher_id BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_classes_tid (tenant_id, id),
  UNIQUE KEY uq_classes_name (tenant_id, school_year, name),
  CONSTRAINT fk_classes_level   FOREIGN KEY (tenant_id, level_id)        REFERENCES levels(tenant_id, id),
  CONSTRAINT fk_classes_room    FOREIGN KEY (tenant_id, room_id)         REFERENCES rooms(tenant_id, id),
  CONSTRAINT fk_classes_teacher FOREIGN KEY (tenant_id, main_teacher_id) REFERENCES teachers(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE class_subjects (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  class_id     BIGINT UNSIGNED NOT NULL,
  subject_id   BIGINT UNSIGNED NOT NULL,
  teacher_id   BIGINT UNSIGNED NULL,
  weekly_hours TINYINT NOT NULL DEFAULT 2,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cs (tenant_id, class_id, subject_id),
  CONSTRAINT fk_cs_class   FOREIGN KEY (tenant_id, class_id)   REFERENCES classes(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_cs_subject FOREIGN KEY (tenant_id, subject_id) REFERENCES subjects(tenant_id, id),
  CONSTRAINT fk_cs_teacher FOREIGN KEY (tenant_id, teacher_id) REFERENCES teachers(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Élèves & familles
-- ---------------------------------------------------------------------
CREATE TABLE students (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  user_id      BIGINT UNSIGNED NULL,
  class_id     BIGINT UNSIGNED NULL,
  matricule    VARCHAR(30) NOT NULL,
  first_name   VARCHAR(80) NOT NULL,
  last_name    VARCHAR(80) NOT NULL,
  gender       ENUM('F','M') NULL,
  birth_date   DATE NOT NULL,
  address      VARCHAR(255) NULL,
  photo_url    VARCHAR(255) NULL,
  status       ENUM('enrolled','pending','left') NOT NULL DEFAULT 'enrolled',
  enrolled_on  DATE NULL,
  uses_canteen TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_students_tid (tenant_id, id),
  UNIQUE KEY uq_students_matricule (tenant_id, matricule),
  KEY ix_students_class (tenant_id, class_id),
  KEY ix_students_name (tenant_id, last_name, first_name),
  CONSTRAINT fk_students_class FOREIGN KEY (tenant_id, class_id) REFERENCES classes(tenant_id, id),
  CONSTRAINT fk_students_user  FOREIGN KEY (tenant_id, user_id)  REFERENCES users(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE guardians (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NULL,
  first_name  VARCHAR(80) NOT NULL,
  last_name   VARCHAR(80) NOT NULL,
  relation    VARCHAR(30) NULL,
  phone       VARCHAR(30) NULL,
  email       VARCHAR(160) NULL,
  job         VARCHAR(80) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_guardians_tid (tenant_id, id),
  CONSTRAINT fk_guardians_user FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_guardians (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  student_id   BIGINT UNSIGNED NOT NULL,
  guardian_id  BIGINT UNSIGNED NOT NULL,
  is_emergency TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sg (tenant_id, student_id, guardian_id),
  CONSTRAINT fk_sg_student  FOREIGN KEY (tenant_id, student_id)  REFERENCES students(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_sg_guardian FOREIGN KEY (tenant_id, guardian_id) REFERENCES guardians(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Emploi du temps (les UNIQUE empêchent les conflits enseignant / classe)
-- ---------------------------------------------------------------------
CREATE TABLE timetable_slots (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  class_id    BIGINT UNSIGNED NOT NULL,
  subject_id  BIGINT UNSIGNED NOT NULL,
  teacher_id  BIGINT UNSIGNED NOT NULL,
  room_id     BIGINT UNSIGNED NULL,
  weekday     TINYINT NOT NULL CHECK (weekday BETWEEN 1 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_slots_tid (tenant_id, id),
  UNIQUE KEY uq_slot_class   (tenant_id, class_id, weekday, start_time),
  UNIQUE KEY uq_slot_teacher (tenant_id, teacher_id, weekday, start_time),
  CONSTRAINT fk_slot_class   FOREIGN KEY (tenant_id, class_id)   REFERENCES classes(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_slot_subject FOREIGN KEY (tenant_id, subject_id) REFERENCES subjects(tenant_id, id),
  CONSTRAINT fk_slot_teacher FOREIGN KEY (tenant_id, teacher_id) REFERENCES teachers(tenant_id, id),
  CONSTRAINT fk_slot_room    FOREIGN KEY (tenant_id, room_id)    REFERENCES rooms(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE timetable_exceptions (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id             BIGINT UNSIGNED NOT NULL,
  slot_id               BIGINT UNSIGNED NOT NULL,
  on_date               DATE NOT NULL,
  kind                  ENUM('cancel','substitute','room_change','moved') NOT NULL,
  substitute_teacher_id BIGINT UNSIGNED NULL,
  room_id               BIGINT UNSIGNED NULL,
  note                  VARCHAR(255) NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tex_slot    FOREIGN KEY (tenant_id, slot_id)               REFERENCES timetable_slots(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_tex_teacher FOREIGN KEY (tenant_id, substitute_teacher_id) REFERENCES teachers(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Présences, évaluations, devoirs
-- ---------------------------------------------------------------------
CREATE TABLE attendance (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  student_id   BIGINT UNSIGNED NOT NULL,
  on_date      DATE NOT NULL,
  period       ENUM('day','morning','afternoon') NOT NULL DEFAULT 'day',
  status       ENUM('present','absent','late') NOT NULL,
  minutes_late SMALLINT NULL,
  justified    TINYINT(1) NOT NULL DEFAULT 0,
  reason       VARCHAR(255) NULL,
  proof_url    VARCHAR(255) NULL,
  recorded_by  BIGINT UNSIGNED NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_att (tenant_id, student_id, on_date, period),
  KEY ix_att_date (tenant_id, on_date, status),
  CONSTRAINT fk_att_student FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE evaluations (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  class_id    BIGINT UNSIGNED NOT NULL,
  subject_id  BIGINT UNSIGNED NOT NULL,
  teacher_id  BIGINT UNSIGNED NULL,
  kind        ENUM('Contrôle','Examen','Devoir surveillé','Interrogation','Exposé') NOT NULL DEFAULT 'Contrôle',
  title       VARCHAR(120) NOT NULL,
  coefficient DECIMAL(4,2) NOT NULL DEFAULT 1,
  max_score   DECIMAL(5,2) NOT NULL DEFAULT 20,
  held_on     DATE NOT NULL,
  term        TINYINT NOT NULL DEFAULT 1,
  published   TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_eval_tid (tenant_id, id),
  KEY ix_eval_class (tenant_id, class_id, subject_id),
  CONSTRAINT fk_eval_class   FOREIGN KEY (tenant_id, class_id)   REFERENCES classes(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_eval_subject FOREIGN KEY (tenant_id, subject_id) REFERENCES subjects(tenant_id, id),
  CONSTRAINT fk_eval_teacher FOREIGN KEY (tenant_id, teacher_id) REFERENCES teachers(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grades (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id      BIGINT UNSIGNED NOT NULL,
  evaluation_id  BIGINT UNSIGNED NOT NULL,
  student_id     BIGINT UNSIGNED NOT NULL,
  score          DECIMAL(5,2) NULL,
  comment        VARCHAR(255) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_grade (tenant_id, evaluation_id, student_id),
  KEY ix_grade_student (tenant_id, student_id),
  CONSTRAINT fk_grade_eval    FOREIGN KEY (tenant_id, evaluation_id) REFERENCES evaluations(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_grade_student FOREIGN KEY (tenant_id, student_id)    REFERENCES students(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE homework (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  class_id     BIGINT UNSIGNED NOT NULL,
  subject_id   BIGINT UNSIGNED NOT NULL,
  teacher_id   BIGINT UNSIGNED NULL,
  title        VARCHAR(160) NOT NULL,
  instructions TEXT NULL,
  due_at       DATETIME NOT NULL,
  attachments  LONGTEXT NULL CHECK (attachments IS NULL OR JSON_VALID(attachments)),
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hw_tid (tenant_id, id),
  KEY ix_hw_class (tenant_id, class_id, due_at),
  CONSTRAINT fk_hw_class   FOREIGN KEY (tenant_id, class_id)   REFERENCES classes(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_hw_subject FOREIGN KEY (tenant_id, subject_id) REFERENCES subjects(tenant_id, id),
  CONSTRAINT fk_hw_teacher FOREIGN KEY (tenant_id, teacher_id) REFERENCES teachers(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE homework_submissions (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  homework_id  BIGINT UNSIGNED NOT NULL,
  student_id   BIGINT UNSIGNED NOT NULL,
  status       ENUM('todo','submitted','late','graded') NOT NULL DEFAULT 'todo',
  submitted_at DATETIME NULL,
  file_url     VARCHAR(255) NULL,
  score        DECIMAL(5,2) NULL,
  feedback     VARCHAR(500) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sub (tenant_id, homework_id, student_id),
  CONSTRAINT fk_sub_hw      FOREIGN KEY (tenant_id, homework_id) REFERENCES homework(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_student FOREIGN KEY (tenant_id, student_id)  REFERENCES students(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- E-learning & bibliothèque
-- ---------------------------------------------------------------------
CREATE TABLE courses (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  subject_id  BIGINT UNSIGNED NOT NULL,
  level_id    BIGINT UNSIGNED NULL,
  teacher_id  BIGINT UNSIGNED NULL,
  title       VARCHAR(160) NOT NULL,
  description TEXT NULL,
  status      ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_courses_tid (tenant_id, id),
  CONSTRAINT fk_course_subject FOREIGN KEY (tenant_id, subject_id) REFERENCES subjects(tenant_id, id),
  CONSTRAINT fk_course_level   FOREIGN KEY (tenant_id, level_id)   REFERENCES levels(tenant_id, id),
  CONSTRAINT fk_course_teacher FOREIGN KEY (tenant_id, teacher_id) REFERENCES teachers(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE course_lessons (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  course_id   BIGINT UNSIGNED NOT NULL,
  chapter     VARCHAR(120) NOT NULL,
  position    INT NOT NULL DEFAULT 0,
  title       VARCHAR(160) NOT NULL,
  kind        ENUM('video','pdf','slides','exercise','quiz','assignment') NOT NULL,
  content_url VARCHAR(255) NULL,
  quiz        LONGTEXT NULL CHECK (quiz IS NULL OR JSON_VALID(quiz)),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lessons_tid (tenant_id, id),
  CONSTRAINT fk_lesson_course FOREIGN KEY (tenant_id, course_id) REFERENCES courses(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lesson_progress (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  lesson_id    BIGINT UNSIGNED NOT NULL,
  student_id   BIGINT UNSIGNED NOT NULL,
  completed_at DATETIME NULL,
  score        DECIMAL(5,2) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_progress (tenant_id, lesson_id, student_id),
  CONSTRAINT fk_prog_lesson  FOREIGN KEY (tenant_id, lesson_id)  REFERENCES course_lessons(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_prog_student FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE library_items (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  title       VARCHAR(200) NOT NULL,
  author      VARCHAR(120) NULL,
  kind        ENUM('Livre','Manuel','PDF','Vidéo','Support de cours','Référence') NOT NULL,
  subject_id  BIGINT UNSIGNED NULL,
  level       VARCHAR(40) NULL,
  file_url    VARCHAR(255) NULL,
  downloads   INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FULLTEXT KEY ft_library (title, author),
  CONSTRAINT fk_lib_subject FOREIGN KEY (tenant_id, subject_id) REFERENCES subjects(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Transport scolaire
-- ---------------------------------------------------------------------
CREATE TABLE buses (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id         BIGINT UNSIGNED NOT NULL,
  line_name         VARCHAR(80) NOT NULL,
  plate             VARCHAR(20) NOT NULL,
  model             VARCHAR(60) NULL,
  capacity          INT NOT NULL,
  color             VARCHAR(9) NULL,
  driver_user_id    BIGINT UNSIGNED NULL,
  attendant_user_id BIGINT UNSIGNED NULL,
  gps_device_id     VARCHAR(60) NULL,
  status            ENUM('in_service','parked','maintenance') NOT NULL DEFAULT 'parked',
  delay_minutes     SMALLINT NOT NULL DEFAULT 0,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_buses_tid (tenant_id, id),
  CONSTRAINT fk_bus_driver    FOREIGN KEY (tenant_id, driver_user_id)    REFERENCES users(tenant_id, id),
  CONSTRAINT fk_bus_attendant FOREIGN KEY (tenant_id, attendant_user_id) REFERENCES users(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bus_stops (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id      BIGINT UNSIGNED NOT NULL,
  bus_id         BIGINT UNSIGNED NOT NULL,
  position       INT NOT NULL,
  name           VARCHAR(120) NOT NULL,
  lat            DECIMAL(9,6) NOT NULL,
  lng            DECIMAL(9,6) NOT NULL,
  scheduled_time TIME NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stops_tid (tenant_id, id),
  CONSTRAINT fk_stop_bus FOREIGN KEY (tenant_id, bus_id) REFERENCES buses(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bus_assignments (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  student_id  BIGINT UNSIGNED NOT NULL,
  bus_id      BIGINT UNSIGNED NOT NULL,
  stop_id     BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assign_student (tenant_id, student_id),
  CONSTRAINT fk_assign_student FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_assign_bus     FOREIGN KEY (tenant_id, bus_id)     REFERENCES buses(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_assign_stop    FOREIGN KEY (tenant_id, stop_id)    REFERENCES bus_stops(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bus_positions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  bus_id      BIGINT UNSIGNED NOT NULL,
  lat         DECIMAL(9,6) NOT NULL,
  lng         DECIMAL(9,6) NOT NULL,
  speed       DECIMAL(5,1) NULL,
  recorded_at DATETIME NOT NULL,
  KEY ix_pos_bus_time (tenant_id, bus_id, recorded_at),
  CONSTRAINT fk_pos_bus FOREIGN KEY (tenant_id, bus_id) REFERENCES buses(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bus_boardings (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  student_id  BIGINT UNSIGNED NOT NULL,
  bus_id      BIGINT UNSIGNED NOT NULL,
  event       ENUM('board','alight') NOT NULL,
  method      ENUM('qr','rfid','nfc','manual') NOT NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_board_student (tenant_id, student_id, recorded_at),
  CONSTRAINT fk_board_student FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_board_bus     FOREIGN KEY (tenant_id, bus_id)     REFERENCES buses(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Vie scolaire
-- ---------------------------------------------------------------------
CREATE TABLE canteen_menus (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  on_date     DATE NOT NULL,
  starter     VARCHAR(120) NULL,
  main        VARCHAR(120) NOT NULL,
  side        VARCHAR(120) NULL,
  dessert     VARCHAR(120) NULL,
  vegetarian  VARCHAR(120) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_menu_date (tenant_id, on_date),
  CONSTRAINT fk_menu_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activities (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  name        VARCHAR(120) NOT NULL,
  kind        ENUM('Club','Sport','Sortie','Voyage','Compétition','Événement') NOT NULL,
  capacity    INT NULL,
  price_cents INT NOT NULL DEFAULT 0,
  starts_at   DATETIME NULL,
  schedule    VARCHAR(80) NULL,
  place       VARCHAR(80) NULL,
  teacher_id  BIGINT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_act_tid (tenant_id, id),
  CONSTRAINT fk_act_teacher FOREIGN KEY (tenant_id, teacher_id) REFERENCES teachers(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activity_enrollments (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  activity_id  BIGINT UNSIGNED NOT NULL,
  student_id   BIGINT UNSIGNED NOT NULL,
  consent_at   DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_act_enr (tenant_id, activity_id, student_id),
  CONSTRAINT fk_actenr_act     FOREIGN KEY (tenant_id, activity_id) REFERENCES activities(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_actenr_student FOREIGN KEY (tenant_id, student_id)  REFERENCES students(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Santé : les colonnes *_enc sont chiffrées en AES-256-GCM par l'application
CREATE TABLE health_records (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id     BIGINT UNSIGNED NOT NULL,
  student_id    BIGINT UNSIGNED NOT NULL,
  blood_type    VARCHAR(4) NULL,
  allergies_enc TEXT NULL,
  notes_enc     TEXT NULL,
  diet          VARCHAR(40) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_health_student (tenant_id, student_id),
  CONSTRAINT fk_health_student FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE infirmary_visits (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id        BIGINT UNSIGNED NOT NULL,
  student_id       BIGINT UNSIGNED NOT NULL,
  visited_at       DATETIME NOT NULL,
  kind             ENUM('visit','accident') NOT NULL DEFAULT 'visit',
  reason_enc       TEXT NOT NULL,
  care_enc         TEXT NULL,
  parents_notified TINYINT(1) NOT NULL DEFAULT 0,
  nurse_user_id    BIGINT UNSIGNED NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_visit_date (tenant_id, visited_at),
  CONSTRAINT fk_visit_student FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lost_items (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  kind         ENUM('lost','found') NOT NULL,
  category     ENUM('Téléphone','Sac','Cahier','Vêtement','Lunettes','Clés','Carte scolaire','Accessoires','Autre') NOT NULL,
  description  VARCHAR(255) NOT NULL,
  place        VARCHAR(120) NULL,
  on_date      DATE NOT NULL,
  photo_url    VARCHAR(255) NULL,
  status       ENUM('open','returned') NOT NULL DEFAULT 'open',
  reported_by  BIGINT UNSIGNED NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_lost (tenant_id, kind, category, status),
  FULLTEXT KEY ft_lost (description, place),
  CONSTRAINT fk_lost_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE documents (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  student_id  BIGINT UNSIGNED NULL,
  kind        VARCHAR(40) NOT NULL,
  title       VARCHAR(160) NOT NULL,
  file_url    VARCHAR(255) NULL,
  sha256      CHAR(64) NULL,
  signed_at   DATETIME NULL,
  created_by  BIGINT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_student FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE enrollment_applications (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id          BIGINT UNSIGNED NOT NULL,
  student_first_name VARCHAR(80) NOT NULL,
  student_last_name  VARCHAR(80) NOT NULL,
  birth_date         DATE NULL,
  level_id           BIGINT UNSIGNED NULL,
  guardian_name      VARCHAR(160) NOT NULL,
  guardian_phone     VARCHAR(30) NULL,
  guardian_email     VARCHAR(160) NULL,
  status             ENUM('new','review','accepted','enrolled','rejected') NOT NULL DEFAULT 'new',
  docs               LONGTEXT NULL CHECK (docs IS NULL OR JSON_VALID(docs)),
  paid               TINYINT(1) NOT NULL DEFAULT 0,
  source             VARCHAR(40) NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_app_status (tenant_id, status),
  CONSTRAINT fk_app_level FOREIGN KEY (tenant_id, level_id) REFERENCES levels(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------
CREATE TABLE invoices (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id     BIGINT UNSIGNED NOT NULL,
  number        VARCHAR(30) NOT NULL,
  student_id    BIGINT UNSIGNED NOT NULL,
  label         VARCHAR(160) NOT NULL,
  kind          ENUM('registration','tuition','transport','canteen','activity') NOT NULL,
  due_on        DATE NOT NULL,
  amount_cents  INT NOT NULL CHECK (amount_cents >= 0),
  status        ENUM('due','paid','overdue','cancelled') NOT NULL DEFAULT 'due',
  paid_at       DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_inv_tid (tenant_id, id),
  UNIQUE KEY uq_inv_number (tenant_id, number),
  KEY ix_inv_status (tenant_id, status, due_on),
  CONSTRAINT fk_inv_student FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id     BIGINT UNSIGNED NOT NULL,
  invoice_id    BIGINT UNSIGNED NOT NULL,
  amount_cents  INT NOT NULL CHECK (amount_cents > 0),
  method        ENUM('card','transfer','cash','cheque','direct_debit') NOT NULL,
  provider_ref  VARCHAR(80) NULL,
  paid_at       DATETIME NOT NULL,
  recorded_by   BIGINT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_pay_date (tenant_id, paid_at),
  CONSTRAINT fk_pay_invoice FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Communication, calendrier, support
-- ---------------------------------------------------------------------
CREATE TABLE conversations (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  title       VARCHAR(160) NULL,
  kind        ENUM('direct','group') NOT NULL DEFAULT 'direct',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conv_tid (tenant_id, id),
  CONSTRAINT fk_conv_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE conversation_members (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  conversation_id BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  last_read_at    DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_member (tenant_id, conversation_id, user_id),
  CONSTRAINT fk_member_conv FOREIGN KEY (tenant_id, conversation_id) REFERENCES conversations(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_member_user FOREIGN KEY (tenant_id, user_id)         REFERENCES users(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id       BIGINT UNSIGNED NOT NULL,
  body            TEXT NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_msg_conv (tenant_id, conversation_id, created_at),
  CONSTRAINT fk_msg_conv   FOREIGN KEY (tenant_id, conversation_id) REFERENCES conversations(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (tenant_id, sender_id)       REFERENCES users(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE announcements (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  title        VARCHAR(160) NOT NULL,
  body         TEXT NOT NULL,
  audience     VARCHAR(80) NOT NULL DEFAULT 'all',
  channels     LONGTEXT NULL CHECK (channels IS NULL OR JSON_VALID(channels)),
  pinned       TINYINT(1) NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  author_id    BIGINT UNSIGNED NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ann_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE events (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  title       VARCHAR(160) NOT NULL,
  kind        ENUM('Vacances','Examen','Contrôle','Réunion','Événement','Sortie','Activité','Conseil') NOT NULL,
  starts_at   DATETIME NOT NULL,
  ends_at     DATETIME NULL,
  audience    VARCHAR(80) NOT NULL DEFAULT 'all',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_events_date (tenant_id, starts_at),
  CONSTRAINT fk_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tickets (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  number      VARCHAR(20) NOT NULL,
  author_id   BIGINT UNSIGNED NOT NULL,
  category    VARCHAR(40) NOT NULL,
  priority    ENUM('low','normal','high') NOT NULL DEFAULT 'normal',
  status      ENUM('new','in_progress','resolved','closed') NOT NULL DEFAULT 'new',
  subject     VARCHAR(200) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tk_tid (tenant_id, id),
  UNIQUE KEY uq_tk_number (tenant_id, number),
  CONSTRAINT fk_tk_author FOREIGN KEY (tenant_id, author_id) REFERENCES users(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ticket_messages (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  ticket_id   BIGINT UNSIGNED NOT NULL,
  author_id   BIGINT UNSIGNED NOT NULL,
  body        TEXT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tkm_ticket FOREIGN KEY (tenant_id, ticket_id) REFERENCES tickets(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_tkm_author FOREIGN KEY (tenant_id, author_id) REFERENCES users(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Plans SaaS
INSERT INTO plans (id, name, price_cents, max_students, features) VALUES
  ('essentiel', 'Essentiel', 1900, 400,  '{"elearning":false,"transport":false,"analytics":false,"ai":false}'),
  ('premium',   'Premium',   2900, 1200, '{"elearning":true,"transport":true,"analytics":true,"ai":true}'),
  ('groupe',    'Groupe',    NULL, NULL, '{"elearning":true,"transport":true,"analytics":true,"ai":true,"sso":true,"multi_school":true}');
