import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from './supabase';

export interface DailySummary {
  id?: string;
  user_id: string;
  summary_date: string;
  total_calories: number;
  daily_goal_calories?: number;
  meals_count: number;
}

export interface WeeklySummary {
  id?: string;
  user_id: string;
  week_start_date: string;
  week_end_date: string;
  total_calories: number;
  average_daily_calories: number;
  meals_count: number;
}

export interface MonthlySummary {
  id?: string;
  user_id: string;
  year: number;
  month: number;
  total_calories: number;
  average_daily_calories: number;
  meals_count: number;
}

/**
 * Calculate and save/update daily summary
 */
export async function calculateAndSaveDailySummary(
  userId: string,
  date: Date,
  dailyGoal?: number,
  client?: typeof supabase // optional Supabase client (use hook in components)
) {
  try {
    if (!userId) {
      console.warn('calculateAndSaveDailySummary called without userId');
      return null;
    }

    const sb = client || supabase;
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Fetch meals for this day
    const { data: dailyLog, error } = await sb
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', dateStr)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching daily log:', error);
      return null;
    }

    const totalCalories = dailyLog?.consumed_calories || 0;
    const mealsCount = dailyLog?.meals?.length || 0;

    // Upsert summary
    const { data: summary, error: summaryError } = await sb
      .from('daily_summaries')
      .upsert({
        user_id: userId,
        summary_date: dateStr,
        total_calories: totalCalories,
        daily_goal_calories: dailyGoal,
        meals_count: mealsCount,
      })
      .select()
      .single();

    if (summaryError) {
      console.error('Error saving daily summary:', JSON.stringify(summaryError), summaryError);
      return null;
    }

    return summary as DailySummary;
  } catch (e) {
    console.error('Unexpected error in calculateAndSaveDailySummary:', e);
    return null;
  }
}

/**
 * Calculate and save/update weekly summary
 */
export async function calculateAndSaveWeeklySummary(
  userId: string,
  date: Date,
  client?: typeof supabase
) {
  try {
    if (!userId) {
      console.warn('calculateAndSaveWeeklySummary called without userId');
      return null;
    }
    const sb = client || supabase;

    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(weekEnd, 'yyyy-MM-dd');

    // Fetch logs for this week
    const { data: weeklyLogs, error } = await sb
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('log_date', startStr)
      .lte('log_date', endStr);

    if (error) {
      console.error('Error fetching weekly logs:', error);
      return null;
    }

    const logs = weeklyLogs || [];
    const totalCalories = logs.reduce((sum, log) => sum + (log.consumed_calories || 0), 0);
    const averageCalories = logs.length > 0 ? Math.round(totalCalories / logs.length) : 0;
    const mealsCount = logs.reduce((count, log) => count + (log.meals?.length || 0), 0);

    // Upsert summary
    const { data: summary, error: summaryError } = await sb
      .from('weekly_summaries')
      .upsert({
        user_id: userId,
        week_start_date: startStr,
        week_end_date: endStr,
        total_calories: totalCalories,
        average_daily_calories: averageCalories,
        meals_count: mealsCount,
      })
      .select()
      .single();

    if (summaryError) {
      console.error('Error saving weekly summary:', JSON.stringify(summaryError), summaryError);
      return null;
    }

    return summary as WeeklySummary;
  } catch (e) {
    console.error('Unexpected error in calculateAndSaveWeeklySummary:', e);
    return null;
  }
}

/**
 * Calculate and save/update monthly summary
 */
export async function calculateAndSaveMonthlySummary(
  userId: string,
  date: Date,
  client?: typeof supabase
) {
  try {
    if (!userId) {
      console.warn('calculateAndSaveMonthlySummary called without userId');
      return null;
    }
    const sb = client || supabase;

    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const startStr = format(monthStart, 'yyyy-MM-dd');
    const endStr = format(monthEnd, 'yyyy-MM-dd');
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth() + 1;

    // Fetch logs for this month
    const { data: monthlyLogs, error } = await sb
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('log_date', startStr)
      .lte('log_date', endStr);

    if (error) {
      console.error('Error fetching monthly logs:', error);
      return null;
    }

    const logs = monthlyLogs || [];
    const totalCalories = logs.reduce((sum, log) => sum + (log.consumed_calories || 0), 0);
    const averageCalories = logs.length > 0 ? Math.round(totalCalories / logs.length) : 0;
    const mealsCount = logs.reduce((count, log) => count + (log.meals?.length || 0), 0);

    // Upsert summary
    const { data: summary, error: summaryError } = await sb
      .from('monthly_summaries')
      .upsert({
        user_id: userId,
        year,
        month,
        total_calories: totalCalories,
        average_daily_calories: averageCalories,
        meals_count: mealsCount,
      })
      .select()
      .single();

    if (summaryError) {
      console.error('Error saving monthly summary:', JSON.stringify(summaryError), summaryError);
      return null;
    }

    return summary as MonthlySummary;
  } catch (e) {
    console.error('Unexpected error in calculateAndSaveMonthlySummary:', e);
    return null;
  }
}

/**
 * Get daily summary with user profile info
 */
export async function getDailySummaryWithGoal(
  userId: string,
  date: Date,
  client?: typeof supabase
) {
  const sb = client || supabase;
  const dateStr = format(date, 'yyyy-MM-dd');

  // Get summary and user profile
  const [summaryRes, profileRes] = await Promise.all([
    sb
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('summary_date', dateStr)
      .single(),
    sb
      .from('users')
      .select('dailyCalorieGoal')
      .eq('id', userId)
      .single(),
  ]);

  const summary = summaryRes.data as DailySummary | null;
  const dailyGoal = profileRes.data?.dailyCalorieGoal as number | null;

  return {
    summary,
    dailyGoal,
  };
}

/**
 * Fetch all daily summaries for a month
 */
export async function getDailySummariesForMonth(
  userId: string,
  year: number,
  month: number,
  client?: typeof supabase
) {
  const sb = client || supabase;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const startStr = format(monthStart, 'yyyy-MM-dd');
  const endStr = format(monthEnd, 'yyyy-MM-dd');

  const { data, error } = await sb
    .from('daily_summaries')
    .select('*')
    .eq('user_id', userId)
    .gte('summary_date', startStr)
    .lte('summary_date', endStr)
    .order('summary_date', { ascending: true });

  if (error) {
    console.error('Error fetching daily summaries:', error);
    return [];
  }

  return (data || []) as DailySummary[];
}
