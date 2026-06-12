export interface UserProfile {
  height?: number;
  weight?: number;
  bmi?: number;
  dailyCalorieGoal?: number;
}

export interface Meal {
  id?: string;
  name: string;
  calories: number;
  timestamp: Date;
}

export interface DailyLog {
  id?: string;
  date: Date;
  consumedCalories: number;
  meals: Meal[];
}

export const UNIDENTIFIED_FOOD_MESSAGE = "ไม่สามารถระบุชนิดอาหารได้";
export const CHAT_HISTORY_LIMIT = 50;
