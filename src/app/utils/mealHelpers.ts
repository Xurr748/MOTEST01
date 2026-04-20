import { format } from 'date-fns';
import { useSupabase } from '@/lib/supabase-hooks';
import { calculateAndSaveDailySummary } from '@/lib/summary-helpers';

export const getStartOfUTCDay = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export async function logMeal(
  currentUser: any,
  mealToLog: any
) {
  const startOfTodayUTC = getStartOfUTCDay();
  const todayStr = format(startOfTodayUTC, 'yyyy-MM-dd');

  try {
    const { data: existing, error: existErr } = await useSupabase()
      .from('daily_logs')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('log_date', todayStr)
      .single();
    if (existErr && existErr.code !== 'PGRST116') throw existErr;

    if (!existing) {
      await useSupabase().from('daily_logs').insert({
        user_id: currentUser.id,
        log_date: todayStr,
        consumed_calories: mealToLog.calories,
        meals: [mealToLog],
      });
    } else {
      const currentLogData = existing as any;
      const updatedMeals = [...(currentLogData.meals || []), mealToLog];
      const updatedCalories = (currentLogData.consumedCalories || 0) + mealToLog.calories;
      await useSupabase()
        .from('daily_logs')
        .update({ meals: updatedMeals, consumed_calories: updatedCalories })
        .eq('id', (existing as any).id);
    }
  } catch (error) {
    console.error('Error writing to dailyLog:', error);
    throw error;
  }
}

export async function reloadDailyLog(
  currentUser: any,
  setDailyLog: any,
  setDailyLogId: any,
  userProfile: any
) {
  if (!currentUser) return;

  try {
    const todayStr = format(getStartOfUTCDay(), 'yyyy-MM-dd');
    const { data: logData, error: logErr } = await useSupabase()
      .from('daily_logs')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('log_date', todayStr)
      .single();
    if (logErr && logErr.code !== 'PGRST116') throw logErr;
    if (logData) {
      setDailyLog(logData);
      setDailyLogId(String((logData as any).id));
    } else {
      setDailyLog(null);
      setDailyLogId(null);
    }

    await calculateAndSaveDailySummary(
      currentUser.id,
      new Date(),
      userProfile.dailyCalorieGoal,
      useSupabase()
    );
  } catch (error) {
    console.error('Error reloading daily log:', error);
  }
}