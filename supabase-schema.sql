-- ─────────────────────────────────────────────────────────────
-- Supabase Schema for MediSauti
-- Run this in the Supabase SQL Editor (https://supabase.com)
-- ─────────────────────────────────────────────────────────────

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE users (
  id UUID PRIMARY KEY,
  phone TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE prescriptions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE adherence_logs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ DEFAULT now(),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE doctors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  phone TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE my_doctor (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_uid UUID,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE condition_presets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX idx_prescriptions_user_id ON prescriptions(user_id);
CREATE INDEX idx_adherence_logs_user_id ON adherence_logs(user_id);
CREATE INDEX idx_adherence_logs_logged_at ON adherence_logs(logged_at DESC);
CREATE INDEX idx_schedules_user_id ON schedules(user_id);
CREATE INDEX idx_doctors_phone ON doctors(phone);
CREATE INDEX idx_my_doctor_user_id ON my_doctor(user_id);
CREATE INDEX idx_my_doctor_doctor_uid ON my_doctor(doctor_uid);

-- ── Row-Level Security ──────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE adherence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_doctor ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE condition_presets ENABLE ROW LEVEL SECURITY;

-- Users: authenticated users can manage their own row
CREATE POLICY "users_own_row" ON users
  FOR ALL USING (auth.uid() = id);

-- Prescriptions: authenticated users can manage their own
CREATE POLICY "prescriptions_own" ON prescriptions
  FOR ALL USING (auth.uid() = user_id);

-- Prescriptions: doctors can read their patients' prescriptions
CREATE POLICY "prescriptions_doctor_read" ON prescriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM my_doctor
      WHERE my_doctor.user_id = prescriptions.user_id
        AND my_doctor.doctor_uid = auth.uid()
    )
  );

-- Adherence logs: authenticated users can manage their own
CREATE POLICY "logs_own" ON adherence_logs
  FOR ALL USING (auth.uid() = user_id);

-- Adherence logs: doctors can read their patients' logs
CREATE POLICY "logs_doctor_read" ON adherence_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM my_doctor
      WHERE my_doctor.user_id = adherence_logs.user_id
        AND my_doctor.doctor_uid = auth.uid()
    )
  );

-- Schedules: authenticated users can manage their own
CREATE POLICY "schedules_own" ON schedules
  FOR ALL USING (auth.uid() = user_id);

-- My doctor: authenticated users can manage their own
CREATE POLICY "my_doctor_own" ON my_doctor
  FOR ALL USING (auth.uid() = user_id);

-- My doctor: doctors can read rows where they are the assigned doctor
CREATE POLICY "my_doctor_doctor_read" ON my_doctor
  FOR SELECT USING (auth.uid() = doctor_uid);

-- Doctors: all authenticated users can read
CREATE POLICY "doctors_read_all" ON doctors
  FOR SELECT USING (auth.role() = 'authenticated');

-- Doctors: any authenticated user can insert/update
CREATE POLICY "doctors_write_all" ON doctors
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "doctors_update_all" ON doctors
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Condition presets: all authenticated users can read
CREATE POLICY "presets_read_all" ON condition_presets
  FOR SELECT USING (auth.role() = 'authenticated');
