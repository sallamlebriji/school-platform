-- =====================================================================
-- Athénée School OS — Schéma PostgreSQL multi-tenant (extrait de référence)
-- Isolation : chaque table métier porte tenant_id + Row-Level Security.
-- L'API positionne `SET LOCAL app.tenant_id = '<uuid>'` au début de
-- chaque transaction (issu du JWT, jamais du client).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- EXCLUDE (uuid WITH =, ...)

-- ---------- Plateforme (hors tenant) ----------
CREATE TABLE plans (
  id            text PRIMARY KEY,                 -- 'essentiel' | 'premium' | 'groupe'
  price_cents   integer,                          -- par élève / mois
  max_students  integer,
  features      jsonb NOT NULL DEFAULT '{}'       -- {"elearning":true,"transport":true,"ai":true,...}
);

CREATE TABLE tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,             -- alfarabi
  name          text NOT NULL,
  plan_id       text NOT NULL REFERENCES plans(id),
  custom_domain text UNIQUE,
  branding      jsonb NOT NULL DEFAULT '{}',      -- {"logo_url":..,"primary":"#13254A"}
  settings      jsonb NOT NULL DEFAULT '{}',      -- règles de calcul, devise, périodes…
  kms_key_id    text NOT NULL,                    -- clé de chiffrement dédiée
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  plan_id       text NOT NULL REFERENCES plans(id),
  seats         integer NOT NULL,
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  provider_ref  text                               -- Stripe / CMI
);

-- ---------- Identité & RBAC ----------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  email         citext NOT NULL,
  password_hash text,                               -- argon2id ; NULL si SSO
  totp_secret   bytea,                              -- chiffré (pgcrypto / KMS)
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  status        text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  UNIQUE (tenant_id, email)
);

CREATE TABLE roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  name          text NOT NULL,                      -- direction, scolarite, enseignant, parent, eleve, infirmerie…
  permissions   jsonb NOT NULL,                     -- {"students":"write","health":"none",...}
  UNIQUE (tenant_id, name)
);

CREATE TABLE user_roles (
  tenant_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users(id), role_id uuid NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users(id),
  device text, ip inet, created_at timestamptz DEFAULT now(), expires_at timestamptz NOT NULL, revoked_at timestamptz
);

-- ---------- Scolarité ----------
CREATE TABLE levels   (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, name text NOT NULL, cycle text NOT NULL, position int);
CREATE TABLE subjects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, name text NOT NULL, coefficient numeric(4,2) NOT NULL DEFAULT 1, color text);
CREATE TABLE rooms    (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, name text NOT NULL, capacity int);

CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  school_year text NOT NULL, level_id uuid NOT NULL REFERENCES levels(id), name text NOT NULL,
  capacity int NOT NULL, room_id uuid REFERENCES rooms(id), main_teacher_id uuid
);

CREATE TABLE teachers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid REFERENCES users(id), hired_on date);
CREATE TABLE class_subject_teachers (tenant_id uuid NOT NULL, class_id uuid REFERENCES classes(id), subject_id uuid REFERENCES subjects(id), teacher_id uuid REFERENCES teachers(id), PRIMARY KEY (class_id, subject_id));

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  matricule text NOT NULL, first_name text NOT NULL, last_name text NOT NULL, birth_date date NOT NULL,
  gender char(1), class_id uuid REFERENCES classes(id), photo_url text, address text,
  status text NOT NULL DEFAULT 'enrolled', enrolled_on date,
  UNIQUE (tenant_id, matricule)
);

CREATE TABLE guardians (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid REFERENCES users(id), phone text, job text);
CREATE TABLE student_guardians (tenant_id uuid NOT NULL, student_id uuid REFERENCES students(id), guardian_id uuid REFERENCES guardians(id), relation text, is_emergency bool DEFAULT false, PRIMARY KEY (student_id, guardian_id));

CREATE TABLE timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES classes(id), subject_id uuid NOT NULL, teacher_id uuid NOT NULL, room_id uuid,
  weekday smallint NOT NULL, starts_at time NOT NULL, ends_at time NOT NULL,
  -- un enseignant / une salle ne peut pas être à deux endroits en même temps :
  EXCLUDE USING gist (tenant_id WITH =, teacher_id WITH =, weekday WITH =, tsrange('2000-01-01'::date + starts_at, '2000-01-01'::date + ends_at) WITH &&)
);
CREATE TABLE timetable_exceptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, slot_id uuid REFERENCES timetable_slots(id), on_date date NOT NULL, kind text NOT NULL, substitute_teacher_id uuid, room_id uuid, note text);

CREATE TABLE attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES students(id), on_date date NOT NULL, slot_id uuid,
  status text NOT NULL CHECK (status IN ('present','absent','late')),
  minutes_late int, justified bool DEFAULT false, reason text, proof_url text, recorded_by uuid
);

CREATE TABLE evaluations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, class_id uuid NOT NULL, subject_id uuid NOT NULL, kind text NOT NULL, title text NOT NULL, coefficient numeric(4,2) NOT NULL DEFAULT 1, max_score numeric(5,2) NOT NULL DEFAULT 20, held_on date, published bool DEFAULT false);
CREATE TABLE grades (tenant_id uuid NOT NULL, evaluation_id uuid REFERENCES evaluations(id), student_id uuid REFERENCES students(id), score numeric(5,2), comment text, PRIMARY KEY (evaluation_id, student_id));

CREATE TABLE homework (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, class_id uuid NOT NULL, subject_id uuid NOT NULL, teacher_id uuid NOT NULL, title text NOT NULL, instructions text, due_at timestamptz NOT NULL);
CREATE TABLE homework_submissions (tenant_id uuid NOT NULL, homework_id uuid REFERENCES homework(id), student_id uuid REFERENCES students(id), submitted_at timestamptz, file_url text, score numeric(5,2), feedback text, status text, PRIMARY KEY (homework_id, student_id));

-- ---------- E-learning & bibliothèque ----------
CREATE TABLE courses  (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, subject_id uuid, level_id uuid, teacher_id uuid, title text NOT NULL, status text DEFAULT 'draft');
CREATE TABLE chapters (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, course_id uuid REFERENCES courses(id), position int, title text);
CREATE TABLE lessons  (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, chapter_id uuid REFERENCES chapters(id), kind text, asset_url text, quiz jsonb);
CREATE TABLE lesson_progress (tenant_id uuid NOT NULL, lesson_id uuid, student_id uuid, completed_at timestamptz, score numeric(5,2), PRIMARY KEY (lesson_id, student_id));
CREATE TABLE library_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, title text, author text, kind text, subject_id uuid, level text, asset_url text);

-- ---------- Transport ----------
CREATE TABLE buses       (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, plate text, model text, capacity int, gps_device_id text);
CREATE TABLE bus_routes  (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, bus_id uuid REFERENCES buses(id), name text, driver_id uuid, attendant_id uuid);
CREATE TABLE bus_stops   (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, route_id uuid REFERENCES bus_routes(id), position int, name text, lat numeric(9,6), lng numeric(9,6), scheduled_time time);
CREATE TABLE bus_assignments (tenant_id uuid NOT NULL, student_id uuid REFERENCES students(id), route_id uuid REFERENCES bus_routes(id), stop_id uuid REFERENCES bus_stops(id), PRIMARY KEY (student_id, route_id));
CREATE TABLE bus_positions (tenant_id uuid NOT NULL, bus_id uuid NOT NULL, at timestamptz NOT NULL, lat numeric(9,6), lng numeric(9,6), speed numeric(5,1)) PARTITION BY RANGE (at);
CREATE TABLE bus_boardings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, student_id uuid, bus_id uuid, event text CHECK (event IN ('board','alight')), method text CHECK (method IN ('qr','rfid','nfc','manual')), at timestamptz DEFAULT now(), lat numeric(9,6), lng numeric(9,6));

-- ---------- Vie scolaire ----------
CREATE TABLE canteen_menus (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, on_date date, starter text, main text, side text, dessert text, vegetarian text);
CREATE TABLE activities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, name text, kind text, capacity int, price_cents int, starts_at timestamptz);
CREATE TABLE activity_enrollments (tenant_id uuid NOT NULL, activity_id uuid, student_id uuid, consent_signed_at timestamptz, PRIMARY KEY (activity_id, student_id));
CREATE TABLE lost_found (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, kind text CHECK (kind IN ('lost','found')), category text, description text, place text, on_date date, photo_url text, status text DEFAULT 'open', reported_by uuid, search tsvector);
CREATE INDEX ON lost_found USING gin (search);

-- Santé : colonnes sensibles chiffrées côté application (enveloppe KMS)
CREATE TABLE health_records (tenant_id uuid NOT NULL, student_id uuid PRIMARY KEY REFERENCES students(id), allergies_enc bytea, conditions_enc bytea, blood_type_enc bytea, diet text);
CREATE TABLE infirmary_visits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, student_id uuid, at timestamptz, kind text, reason_enc bytea, care_enc bytea, parents_notified bool, nurse_id uuid);

-- ---------- Finance ----------
CREATE TABLE fee_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, kind text, label text, amount_cents int, level_id uuid);
CREATE TABLE invoices  (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, number text NOT NULL, student_id uuid, guardian_id uuid, due_on date, total_cents int, status text CHECK (status IN ('draft','due','paid','overdue','cancelled')), UNIQUE (tenant_id, number));
CREATE TABLE invoice_lines (tenant_id uuid NOT NULL, invoice_id uuid REFERENCES invoices(id), fee_item_id uuid, label text, amount_cents int);
CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, invoice_id uuid REFERENCES invoices(id), amount_cents int, method text, provider_ref text, paid_at timestamptz);

-- ---------- Communication, support, documents ----------
CREATE TABLE conversations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, kind text, title text);
CREATE TABLE conversation_members (tenant_id uuid NOT NULL, conversation_id uuid, user_id uuid, PRIMARY KEY (conversation_id, user_id));
CREATE TABLE messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, conversation_id uuid, sender_id uuid, body text, sent_at timestamptz DEFAULT now());
CREATE TABLE announcements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, title text, body text, audience jsonb, channels text[], pinned bool, published_at timestamptz);
CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid, kind text, payload jsonb, channels text[], read_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, number text, author_id uuid, category text, priority text, status text CHECK (status IN ('new','in_progress','resolved','closed')), subject text, created_at timestamptz DEFAULT now());
CREATE TABLE ticket_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, ticket_id uuid, author_id uuid, body text, created_at timestamptz DEFAULT now());
CREATE TABLE documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, owner_student_id uuid, kind text, storage_key text, sha256 text, signed_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE enrollment_applications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, data jsonb, status text CHECK (status IN ('new','review','accepted','enrolled','rejected')), created_at timestamptz DEFAULT now());
CREATE TABLE events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, title text, kind text, starts_at timestamptz, ends_at timestamptz, audience jsonb);

-- ---------- Audit (append-only) ----------
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY, tenant_id uuid NOT NULL, actor_id uuid, action text NOT NULL,
  entity text, entity_id uuid, ip inet, user_agent text, diff jsonb, at timestamptz NOT NULL DEFAULT now()
);
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

-- =====================================================================
-- Row-Level Security : appliquée automatiquement à toutes les tables
-- possédant une colonne tenant_id.
-- =====================================================================
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns
           WHERE column_name = 'tenant_id' AND table_schema = 'public' AND table_name <> 'subscriptions'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
                    USING (tenant_id = current_setting('app.tenant_id')::uuid)
                    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)$p$, t.table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)', t.table_name || '_tenant_idx', t.table_name);
  END LOOP;
END $$;

-- Exemple de politique fine : un parent ne voit que les notes de ses enfants.
-- RESTRICTIVE : combinée en ET avec tenant_isolation (une politique permissive
-- serait combinée en OU et affaiblirait l'isolation).
CREATE POLICY guardian_reads_own_children ON grades AS RESTRICTIVE FOR SELECT
  USING (
    current_setting('app.role') <> 'parent'
    OR student_id IN (SELECT sg.student_id FROM student_guardians sg
                      JOIN guardians g ON g.id = sg.guardian_id
                      WHERE g.user_id = current_setting('app.user_id')::uuid)
  );
