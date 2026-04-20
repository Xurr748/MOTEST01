export function calculateBmiProfile(height: string, weight: string) {
  const h = parseFloat(height);
  const w = parseFloat(weight);
  if (isNaN(h) || isNaN(w) || h <= 0 || w <= 0) return null;
  const bmi = w / ((h / 100) * (h / 100));
  const calorieGoal = (10 * w) + (6.25 * h) - (5 * 30) + 5;
  const roundedCalorieGoal = Math.round(calorieGoal * 1.2);
  return {
    height: h,
    weight: w,
    bmi: parseFloat(bmi.toFixed(2)),
    dailyCalorieGoal: roundedCalorieGoal,
  };
}