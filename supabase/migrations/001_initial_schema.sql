-- ============================================================
-- MOMU SCAN - Supabase Database Setup Script
-- รันใน Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- 1. user_profiles — โปรไฟล์และ BMI ของผู้ใช้
CREATE TABLE IF NOT EXISTS user_profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  height              NUMERIC,
  weight              NUMERIC,
  bmi                 NUMERIC,
  daily_calorie_goal  INTEGER,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON user_profiles
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. daily_logs — บันทึกรายวัน (1 วัน / 1 คน)
CREATE TABLE IF NOT EXISTS daily_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date            DATE NOT NULL,
  consumed_calories   INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own daily logs" ON daily_logs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. meal_entries — รายการอาหารแต่ละมื้อ
CREATE TABLE IF NOT EXISTS meal_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_log_id  UUID NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  calories      INTEGER NOT NULL,
  logged_at     TIMESTAMPTZ DEFAULT NOW(),
  source        TEXT DEFAULT 'manual'
);

ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meals" ON meal_entries
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS meal_entries_log_id ON meal_entries(daily_log_id);
CREATE INDEX IF NOT EXISTS meal_entries_user_date ON meal_entries(user_id, logged_at DESC);

-- 4. chat_messages — ประวัติสนทนากับ AI
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'model')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chat" ON chat_messages
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS chat_messages_user_created ON chat_messages(user_id, created_at DESC);

-- 5. food_items — ฐานข้อมูลอาหาร (ทุกคนอ่านได้ admin จัดการ)
CREATE TABLE IF NOT EXISTS food_items (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,
  calories  INTEGER NOT NULL,
  category  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read food items" ON food_items
  FOR SELECT USING (true);

-- ข้อมูลตัวอย่างอาหารไทย
INSERT INTO food_items (name, calories, category) VALUES
  ('ข้าวสวย (1 ทัพพี)', 206, 'คาร์โบไฮเดรต'),
  ('ข้าวเหนียว (1 ก้อน)', 180, 'คาร์โบไฮเดรต'),
  ('ขนมปังแผ่น', 80, 'คาร์โบไฮเดรต'),
  ('ก๋วยเตี๋ยวน้ำ', 220, 'อาหารจานเดียว'),
  ('ผัดไทย', 400, 'อาหารจานเดียว'),
  ('ข้าวผัด', 350, 'อาหารจานเดียว'),
  ('ต้มยำกุ้ง', 180, 'ซุป'),
  ('แกงเขียวหวาน', 280, 'แกง'),
  ('แกงมัสมั่น', 320, 'แกง'),
  ('ไก่ทอด (1 ชิ้น)', 320, 'เนื้อสัตว์'),
  ('ไก่ย่าง (1 ชิ้น)', 200, 'เนื้อสัตว์'),
  ('หมูทอดกระเทียม', 250, 'เนื้อสัตว์'),
  ('ปลาทอด (1 ชิ้น)', 180, 'เนื้อสัตว์'),
  ('กุ้งผัดผักบุ้ง', 150, 'เนื้อสัตว์'),
  ('ไข่ดาว (1 ฟอง)', 90, 'ไข่'),
  ('ไข่เจียว (1 ฟอง)', 120, 'ไข่'),
  ('ไข่ขาว (1 ฟอง)', 17, 'ไข่'),
  ('ผักบุ้งผัดน้ำมันหอย', 120, 'ผัก'),
  ('ต้มจืดผักรวม', 80, 'ผัก'),
  ('สลัดผักรวม', 50, 'ผัก'),
  ('นมวัวสด (1 แก้ว)', 150, 'นมและผลิตภัณฑ์'),
  ('โยเกิร์ตธรรมชาติ', 100, 'นมและผลิตภัณฑ์'),
  ('กล้วยหอม (1 ลูก)', 89, 'ผลไม้'),
  ('แอปเปิ้ล (1 ลูก)', 80, 'ผลไม้'),
  ('ส้ม (1 ลูก)', 62, 'ผลไม้'),
  ('มะม่วง (1/2 ลูก)', 120, 'ผลไม้'),
  ('ทุเรียน (1 เม็ด)', 357, 'ผลไม้'),
  ('น้ำเต้าหู้ไม่หวาน (1 แก้ว)', 80, 'เครื่องดื่ม'),
  ('ชาเขียวไม่หวาน', 0, 'เครื่องดื่ม'),
  ('กาแฟดำไม่หวาน', 5, 'เครื่องดื่ม'),
  ('ชานมไข่มุก (1 แก้ว)', 350, 'เครื่องดื่ม'),
  ('น้ำอัดลม (1 กระป๋อง)', 140, 'เครื่องดื่ม'),
  ('โรตีกล้วย', 380, 'ของหวาน'),
  ('ขนมปังกรอบ (1 ชิ้น)', 120, 'ของว่าง'),
  ('มันฝรั่งทอด (1 ถุง 30g)', 160, 'ของว่าง')
ON CONFLICT DO NOTHING;
