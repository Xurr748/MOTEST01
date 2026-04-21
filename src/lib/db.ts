import { supabase } from './supabase';
import { format } from 'date-fns';

// ============================================================
// TYPES
// ============================================================
export interface UserProfile {
  height?: number;
  weight?: number;
  bmi?: number;
  daily_calorie_goal?: number;
}

export interface MealEntry {
  id?: string;
  user_id?: string;
  daily_log_id?: string;
  name: string;
  calories: number;
  logged_at?: string;
  source?: string;
}

export interface DailyLogRecord {
  id: string;
  user_id: string;
  log_date: string;
  consumed_calories: number;
  meal_entries?: MealEntry[];
}

export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  category?: string;
}

// ============================================================
// USER PROFILE
// ============================================================

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error('getUserProfile error:', error);
    return null;
  }
  return data as UserProfile | null;
}

export async function upsertUserProfile(userId: string, profile: UserProfile): Promise<boolean> {
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ id: userId, ...profile, updated_at: new Date().toISOString() });
  if (error) {
    console.error('upsertUserProfile error:', error);
    return false;
  }
  return true;
}

// ============================================================
// DAILY LOGS
// ============================================================

export async function getDailyLog(userId: string, date: Date): Promise<DailyLogRecord | null> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*, meal_entries(*)')
    .eq('user_id', userId)
    .eq('log_date', dateStr)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error('getDailyLog error:', error);
    return null;
  }
  return data as DailyLogRecord | null;
}

export async function getOrCreateDailyLog(userId: string, date: Date): Promise<DailyLogRecord | null> {
  const dateStr = format(date, 'yyyy-MM-dd');

  // Try to get existing
  const { data: existing } = await supabase
    .from('daily_logs')
    .select('*, meal_entries(*)')
    .eq('user_id', userId)
    .eq('log_date', dateStr)
    .single();

  if (existing) return existing as DailyLogRecord;

  // Create new
  const { data: created, error } = await supabase
    .from('daily_logs')
    .insert({ user_id: userId, log_date: dateStr, consumed_calories: 0 })
    .select('*, meal_entries(*)')
    .single();

  if (error) {
    console.error('getOrCreateDailyLog error:', error);
    return null;
  }
  return created as DailyLogRecord;
}

export async function updateDailyLogCalories(logId: string, consumedCalories: number): Promise<boolean> {
  const { error } = await supabase
    .from('daily_logs')
    .update({ consumed_calories: consumedCalories, updated_at: new Date().toISOString() })
    .eq('id', logId);
  if (error) {
    console.error('updateDailyLogCalories error:', error);
    return false;
  }
  return true;
}

export async function getLogsForDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<DailyLogRecord[]> {
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*, meal_entries(*)')
    .eq('user_id', userId)
    .gte('log_date', startStr)
    .lte('log_date', endStr)
    .order('log_date', { ascending: true });
  if (error) {
    console.error('getLogsForDateRange error:', error);
    return [];
  }
  return (data || []) as DailyLogRecord[];
}

// ============================================================
// MEAL ENTRIES
// ============================================================

export async function addMealEntry(
  userId: string,
  dailyLogId: string,
  meal: { name: string; calories: number; source?: string }
): Promise<MealEntry | null> {
  const { data, error } = await supabase
    .from('meal_entries')
    .insert({
      user_id: userId,
      daily_log_id: dailyLogId,
      name: meal.name,
      calories: meal.calories,
      source: meal.source || 'manual',
      logged_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) {
    console.error('addMealEntry error:', error);
    return null;
  }
  return data as MealEntry;
}

// ============================================================
// CHAT MESSAGES
// ============================================================

export async function getChatMessages(userId: string, limit = 50): Promise<{ role: string; content: string }[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('getChatMessages error:', error);
    return [];
  }
  return (data || []) as { role: string; content: string }[];
}

export async function addChatMessage(
  userId: string,
  role: 'user' | 'model',
  content: string
): Promise<boolean> {
  const { error } = await supabase
    .from('chat_messages')
    .insert({ user_id: userId, role, content });
  if (error) {
    console.error('addChatMessage error:', error);
    return false;
  }
  return true;
}

export async function clearOldChatMessages(userId: string, keepCount = 50): Promise<void> {
  // Get IDs to keep (last 50)
  const { data } = await supabase
    .from('chat_messages')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(keepCount);

  if (!data || data.length === 0) return;

  const keepIds = data.map((d: any) => d.id);

  await supabase
    .from('chat_messages')
    .delete()
    .eq('user_id', userId)
    .not('id', 'in', `(${keepIds.join(',')})`);
}

// ============================================================
// FOOD ITEMS
// ============================================================

export async function getFoodItems(search?: string): Promise<FoodItem[]> {
  let query = supabase
    .from('food_items')
    .select('id, name, calories, category')
    .order('name', { ascending: true });

  if (search && search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('getFoodItems error:', error);
    return [];
  }
  return (data || []) as FoodItem[];
}
