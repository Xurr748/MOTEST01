require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const thaiBreakfasts = [
  { name: 'ข้าวต้มหมูสับเห็ดหอม', cal: 380, source: 'ai_scan' },
  { name: 'โจ๊กหมูใส่ไข่ออนเซ็น', cal: 420, source: 'ai_scan' },
  { name: 'แซนด์วิชทูน่าโฮลวีตและอเมริกาโน่', cal: 350, source: 'manual' },
  { name: 'ไข่กระทะทรงเครื่อง + ขนมปังปิ้ง', cal: 450, source: 'ai_scan' },
  { name: 'ข้าวเหนียวหมูปิ้ง 3 ไม้', cal: 480, source: 'manual' },
  { name: 'โยเกิร์ตผลไม้รวมและกราโนล่า', cal: 320, source: 'manual' },
  { name: 'ข้าวต้มปลาเก๋าใบขึ้นฉ่าย', cal: 390, source: 'ai_scan' },
];

const thaiLunches = [
  { name: 'ข้าวกะเพราไก่ไข่ดาวกรอบ', cal: 650, source: 'ai_scan' },
  { name: 'ข้าวมันไก่ตอนเนื้อน่องพิเศษ', cal: 680, source: 'ai_scan' },
  { name: 'ก๋วยเตี๋ยวต้มยำกุ้งน้ำข้น', cal: 540, source: 'ai_scan' },
  { name: 'ข้าวผัดคะน้าหมูกรอบ', cal: 720, source: 'ai_scan' },
  { name: 'ส้มตำไทย ไก่ย่าง ข้าวเหนียว', cal: 580, source: 'manual' },
  { name: 'ผัดไทยกุ้งสดโบราณ', cal: 650, source: 'ai_scan' },
  { name: 'ข้าวคลุกกะปิเครื่องครบ', cal: 590, source: 'ai_scan' },
  { name: 'บะหมี่หมูแดงแห้งต้มยำ', cal: 510, source: 'manual' },
  { name: 'ข้าวแกงเขียวหวานไก่ยอดมะพร้าว', cal: 630, source: 'ai_scan' },
];

const thaiDinners = [
  { name: 'สลัดอกไก่ย่างน้ำสลัดงาญี่ปุ่น', cal: 390, source: 'manual' },
  { name: 'สุกี้น้ำรวมมิตรทะเล', cal: 430, source: 'ai_scan' },
  { name: 'ปลากะพงนึ่งมะนาว + ข้าวกล้อง', cal: 450, source: 'ai_scan' },
  { name: 'แกงจืดเต้าหู้หมูสับสาหร่าย + ข้าวสวย', cal: 410, source: 'manual' },
  { name: 'ยำวุ้นเส้นหมูสับกุ้งสด', cal: 380, source: 'ai_scan' },
  { name: 'สเต็กอกไก่พริกไทยดำพร้อมผักย่าง', cal: 480, source: 'ai_scan' },
  { name: 'ต้มยำกุ้งน้ำใส + ข้าวสวยร้อนๆ', cal: 460, source: 'ai_scan' },
];

const thaiSnacks = [
  { name: 'ชาเขียวมัทฉะลาเต้เย็นหวานน้อย', cal: 170, source: 'manual' },
  { name: 'อัลมอนด์อบธรรมชาติ 1 กำมือ', cal: 160, source: 'manual' },
  { name: 'ผลไม้สดรวม (แตงโม ฝรั่ง กีวี่)', cal: 120, source: 'manual' },
  { name: 'กล้วยหอมทอง 1 ลูก', cal: 110, source: 'manual' },
  { name: 'ชานมไข่มุกหวานน้อย (Cheat day)', cal: 310, source: 'manual' },
];

async function seed() {
  const email = 'demo@momu.com';
  const password = 'Password123!';

  console.log('Signing in demo user...');
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr || !auth.user) {
    console.error('Auth error:', authErr);
    return;
  }
  const userId = auth.user.id;
  console.log('User ID:', userId);

  // Set Profile
  await supabase.from('user_profiles').upsert({
    id: userId,
    height: 175,
    weight: 68,
    bmi: 22.2,
    daily_calorie_goal: 2000,
    updated_at: new Date().toISOString()
  });
  console.log('Updated user profile');

  // Clear existing daily_logs & meal_entries for clean seed
  console.log('Clearing old logs for user...');
  await supabase.from('meal_entries').delete().eq('user_id', userId);
  await supabase.from('daily_logs').delete().eq('user_id', userId);

  // Dates: from 2026-09-01 to 2026-10-12 (42 days)
  const startDate = new Date('2026-09-01T00:00:00Z');
  const endDate = new Date('2026-10-12T00:00:00Z');

  let cur = new Date(startDate);
  let dayIndex = 0;

  while (cur <= endDate) {
    const yyyy = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(cur.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const b = thaiBreakfasts[dayIndex % thaiBreakfasts.length];
    const l = thaiLunches[(dayIndex * 2 + 1) % thaiLunches.length];
    const d = thaiDinners[(dayIndex * 3 + 2) % thaiDinners.length];

    const meals = [
      { name: b.name, calories: b.cal, source: b.source, hour: '08:30:00' },
      { name: l.name, calories: l.cal, source: l.source, hour: '12:30:00' },
      { name: d.name, calories: d.cal, source: d.source, hour: '18:45:00' }
    ];

    // Every 3-4 days add a snack/cheat day
    if (dayIndex % 3 === 0) {
      const s = thaiSnacks[dayIndex % thaiSnacks.length];
      meals.push({ name: s.name, calories: s.cal, source: s.source, hour: '15:15:00' });
    }

    const totalCal = meals.reduce((sum, m) => sum + m.calories, 0);

    // Insert daily_log
    const { data: log, error: logErr } = await supabase.from('daily_logs').insert({
      user_id: userId,
      log_date: dateStr,
      consumed_calories: totalCal
    }).select().single();

    if (logErr) {
      console.error('Error inserting log for', dateStr, logErr.message);
      cur.setUTCDate(cur.getUTCDate() + 1);
      dayIndex++;
      continue;
    }

    // Insert meal_entries
    const mealRows = meals.map(m => ({
      user_id: userId,
      daily_log_id: log.id,
      name: m.name,
      calories: m.calories,
      source: m.source,
      logged_at: `${dateStr}T${m.hour}Z`
    }));

    const { error: mealErr } = await supabase.from('meal_entries').insert(mealRows);
    if (mealErr) {
      console.error('Error inserting meals for', dateStr, mealErr.message);
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
    dayIndex++;
  }

  console.log(`Successfully seeded ${dayIndex} days of data for ${email}!`);
}

seed();
