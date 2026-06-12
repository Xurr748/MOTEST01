/**
 * Validates and calculates BMI profile with server-safe bounds checking.
 * Height: 50–300 cm, Weight: 10–500 kg
 * Returns null for invalid or out-of-range inputs.
 */
export function calculateBmiProfile(height: string, weight: string) {
  const h = parseFloat(height);
  const w = parseFloat(weight);

  // Basic type check
  if (isNaN(h) || isNaN(w)) return null;

  // Realistic bounds — reject obviously bad data
  if (h < 50 || h > 300) return null;   // cm
  if (w < 10 || w > 500) return null;   // kg

  const heightM = h / 100;
  const bmi = w / (heightM * heightM);

  // BMI sanity check (anything outside 5–100 is data entry error)
  if (bmi < 5 || bmi > 100) return null;

  // Mifflin-St Jeor equation (male default, moderate activity x1.2)
  const calorieGoal = (10 * w) + (6.25 * h) - (5 * 30) + 5;
  const roundedCalorieGoal = Math.round(calorieGoal * 1.2);

  return {
    height: h,
    weight: w,
    bmi: parseFloat(bmi.toFixed(2)),
    dailyCalorieGoal: roundedCalorieGoal,
  };
}

/**
 * Validates a custom calorie goal value.
 * Returns the parsed number if valid (500–10,000), or null.
 */
export function validateCalorieGoal(value: string): number | null {
  const n = parseFloat(value);
  if (isNaN(n) || n < 500 || n > 10000) return null;
  return Math.round(n);
}