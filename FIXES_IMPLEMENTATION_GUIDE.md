# MOTEST01 - Fixes Implementation Guide

## What Was Fixed

### Issue #1: BMI & User Profile Reset on Page Navigation ✅
**Before:** When users switched pages, their BMI calculation would reset to defaults
**After:** BMI and user profile now persist across page navigation

### Issue #2: Unauthenticated User Data Loss ✅
**Before:** Anonymous users' profiles weren't saved when they left the app
**After:** Profile data now saves to localStorage and persists across sessions

### Issue #3: Meal Logging Not Updating Summary ✅
**Before:** Adding meals didn't update the daily/weekly/monthly summaries
**After:** Summaries now automatically update when meals are logged

### Issue #4: No Summary Tables in Database ✅
**Before:** No persistent storage for daily/weekly/monthly summaries
**After:** Created three new tables with proper RLS policies in Supabase

### Issue #5: Chatbot & Functions Resetting ✅
**Before:** Chatbot messages and other data would reset when switching tabs
**After:** All data now persists properly with fixed useEffect dependency arrays

### Issue #6: Daily Calorie Goal Not Displayed ✅
**Before:** Calculated calorie goal wasn't shown in the daily summary
**After:** Goal shows in daily summary with progress bar (already in UI, now persists)

### Issue #7: Summary Reset on Page Switch ✅
**Before:** Weekly/monthly summaries would reset when closing/opening dialogs
**After:** Summaries now persist and auto-calculate from Supabase data

## How to Deploy These Changes

### Step 1: Push Migration to Supabase
Run one of these commands:

```bash
# If using Supabase CLI
supabase migration up

# Or manually copy the SQL and run in Supabase Dashboard:
# Go to: SQL Editor → paste content from supabase/migrations/20240306_create_summary_tables.sql
```

The migration creates:
- `daily_summaries` table - stores daily calorie totals
- `weekly_summaries` table - stores weekly aggregates  
- `monthly_summaries` table - stores monthly aggregates
- Proper indexes for performance
- Row-level security (RLS) policies

### Step 2: Verify Users Table
Ensure your `users` table has:
- `dailyCalorieGoal` (integer, nullable) - **ADD IF MISSING**

Run this in Supabase SQL Editor if needed:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS dailyCalorieGoal INTEGER;
```

### Step 3: Restart Development Server
```bash
npm run dev
```

Or kill the process and restart:
```bash
# Press Ctrl+C to stop
npm run dev
```

### Step 4: Test All Features

#### Test BMI Calculation & Persistence
1. Go to Profile section
2. Enter height: 169cm, weight: 70kg
3. Click "คำนวณและบันทึก"
4. Verify BMI displays (24.51) and calorie goal shows
5. Navigate to other pages and come back
6. **Expected:** BMI values should remain the same

#### Test Meal Logging
1. Upload a food image
2. Click "บันทึก" to add meal
3. Check daily summary - calories should update
4. Refresh page
5. **Expected:** Meal still appears in daily summary

#### Test Anonymous User Data
1. Open app in incognito window (no login)
2. Calculate BMI
3. Close tab
4. Open app in new incognito window
5. **Expected:** BMI data should still be there

#### Test Weekly/Monthly Summaries
1. Log multiple meals across different days
2. Click "รายสัปดาห์" button
3. See weekly total and average
4. Click "รายเดือน" button  
5. See monthly total and average
6. **Expected:** Data should match meal logs, not reset

## Database Schema Reference

### daily_summaries
```sql
Fields:
- id (UUID, PK)
- user_id (UUID, FK)
- summary_date (DATE)
- total_calories (INTEGER)
- daily_goal_calories (INTEGER)
- meals_count (INTEGER)
- created_at, updated_at (TIMESTAMPTZ)
```

### weekly_summaries
```sql
Fields:
- id (UUID, PK)
- user_id (UUID, FK)
- week_start_date (DATE)
- week_end_date (DATE)
- total_calories (INTEGER)
- average_daily_calories (INTEGER)
- meals_count (INTEGER)
```

### monthly_summaries
```sql
Fields:
- id (UUID, PK)
- user_id (UUID, FK)
- year (INTEGER)
- month (INTEGER)
- total_calories (INTEGER)
- average_daily_calories (INTEGER)
- meals_count (INTEGER)
```

## Code Changes Summary

### Files Modified:
1. **src/app/page.tsx** (main component)
   - Removed `resetState` from useEffect deps (prevents reset)
   - Added profile persistence from localStorage
   - Added `reloadDailyLog()` helper function
   - Integrated summary helper functions
   - Updated meal logging to trigger summary updates

2. **src/lib/auth-context.tsx**
   - Added `isAnonymous` state tracking

3. **src/lib/supabase-hooks.ts**
   - Fixed `useCollection()` to work without userId requirement

### Files Created:
1. **src/lib/summary-helpers.ts** (NEW)
   - `calculateAndSaveDailySummary()`
   - `calculateAndSaveWeeklySummary()`
   - `calculateAndSaveMonthlySummary()`
   - Utility functions for getting summary data

2. **supabase/migrations/20240306_create_summary_tables.sql** (NEW)
   - SQL migration with all table definitions
   - RLS policies for security

## Troubleshooting

### Issue: "daily_summaries table doesn't exist"
**Solution:** Make sure you ran the migration. Check Supabase dashboard Tables section.

### Issue: BMI still resets when switching pages
**Solution:** 
- Clear browser cache/localStorage
- Restart dev server
- Check browser console for errors

### Issue: Meals not showing in weekly/monthly
**Solution:**
- Make sure daily_logs are being created (check Supabase dashboard)
- Summaries auto-calculate when you open the weekly/monthly dialogs
- Each daily_log must have user_id to appear in summaries

### Issue: "User not authenticated" error in console
**Solution:** This is normal for unauthenticated users. App should still work with localStorage fallback.

## Next Steps (Optional Improvements)

- Add manual refresh button for summaries
- Add date range picker for custom reports
- Add export to CSV for summaries
- Add goal tracking charts
- Add meal history view
- Add nutritional breakdown (protein/carbs/fat)

## Support
If you encounter issues, check:
1. Browser console for errors (F12 → Console)
2. Supabase dashboard for table creation
3. Network tab to see API calls
4. Supabase logs for RLS policy errors
