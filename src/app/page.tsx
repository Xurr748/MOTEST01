"use client";

import dynamic from "next/dynamic";
import ManualFoodEntry from "@/components/ManualFoodEntry";
import AuthScreen from "@/components/auth-screen";
import FoodAnalysis from "@/components/food-analysis";
import AIChatPanel from "@/components/ai-chat-panel";
import DailyOverview from "@/components/daily-overview";
import ChartDialogs from "@/components/chart-dialogs";
import ProfileSettings from "@/components/profile-settings";
import { AnimatePresence, motion } from "framer-motion";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  scanFoodImage,
  type ScanFoodImageInput,
  type ScanFoodImageOutput,
} from "@/ai/flows/food-image-analyzer";
import {
  chatWithBot,
  type ChatInput as AIChatInput,
  type ChatOutput as AIChatOutput,
  type ChatMessage,
} from "@/ai/flows/post-scan-chat";
import { supabase } from "@/lib/supabase";
import { calculateBmiProfile, validateCalorieGoal } from "@/app/utils/bmiHelpers";
import {
  getUserProfile, upsertUserProfile, getOrCreateDailyLog, updateDailyLogCalories,
  addMealEntry, deleteMealEntry, getLogsForDateRange, getChatMessages, addChatMessage,
  getFoodItems, type FoodItem, type DailyLogRecord,
} from "@/lib/db";
import type { UserProfile, Meal, DailyLog } from "@/types/app";
import { UNIDENTIFIED_FOOD_MESSAGE, CHAT_HISTORY_LIMIT } from "@/types/app";

import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";
import { th } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LogOut, Loader2, ScanLine, BarChart2, User, Moon, Sun, ChevronRight, Trash2,
} from "lucide-react";

// ============================================================
// MAIN APP ORCHESTRATOR
// ============================================================
function FSFAPageFn() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // User profile state
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [customCalorieGoal, setCustomCalorieGoal] = useState("");
  const [isCalculatingBmi, setIsCalculatingBmi] = useState(false);

  // Daily log state
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [dailyLogId, setDailyLogId] = useState<string | null>(null);
  const [isLogLoading, setIsLogLoading] = useState(false);

  // Image analysis state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageAnalysisResult, setImageAnalysisResult] = useState<ScanFoodImageOutput | null>(null);
  const [isLoadingImageAnalysis, setIsLoadingImageAnalysis] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Meal logging state
  const [isLoggingMeal, setIsLoggingMeal] = useState(false);
  const [pendingMeal, setPendingMeal] = useState<{ name: string; calories: number } | null>(null);
  const [mealToDelete, setMealToDelete] = useState<Meal | null>(null);
  const [isDeletingMeal, setIsDeletingMeal] = useState(false);
  const [isCalorieExceedOpen, setIsCalorieExceedOpen] = useState(false);
  const [exceedAmount, setExceedAmount] = useState(0);
  const [isFoodDbOpen, setIsFoodDbOpen] = useState(false);
  const [foodSearchTerm, setFoodSearchTerm] = useState("");
  const [isLoadingFoods, setIsLoadingFoods] = useState(false);
  const [databaseFoods, setDatabaseFoods] = useState<FoodItem[]>([]);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Weekly/Monthly state
  const [weeklyLogs, setWeeklyLogs] = useState<DailyLog[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<DailyLog[]>([]);
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);
  const [isWeeklyDialogOpen, setIsWeeklyDialogOpen] = useState(false);
  const [isMonthlyDialogOpen, setIsMonthlyDialogOpen] = useState(false);

  // UI state
  const [countdown, setCountdown] = useState("00:00:00");
  const [formattedToday, setFormattedToday] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);

  const { toast } = useToast();

  // ============================================================
  // DARK MODE
  // ============================================================
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = saved === "dark" || (!saved && prefersDark);
    setIsDarkMode(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.classList.toggle("dark", newMode);
    localStorage.setItem("theme", newMode ? "dark" : "light");
  };

  // ============================================================
  // AUTH EFFECT
  // ============================================================
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setCurrentUser(session?.user ?? null);
      setIsAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ============================================================
  // LOAD USER DATA
  // ============================================================
  useEffect(() => {
    if (!currentUser) {
      setUserProfile({}); setHeight(""); setWeight(""); setCustomCalorieGoal("");
      setDailyLog(null); setDailyLogId(null); setChatMessages([]);
      return;
    }
    const loadUserData = async () => {
      setIsLogLoading(true);
      try {
        const profile = await getUserProfile(currentUser.id);
        if (profile) {
          setUserProfile({ height: profile.height, weight: profile.weight, bmi: profile.bmi, dailyCalorieGoal: profile.daily_calorie_goal });
          setHeight(String(profile.height || "")); setWeight(String(profile.weight || ""));
          if (profile.daily_calorie_goal) setCustomCalorieGoal(String(profile.daily_calorie_goal));
        }
        const log = await getOrCreateDailyLog(currentUser.id, new Date());
        if (log) {
          setDailyLogId(log.id);
          const meals: Meal[] = (log.meal_entries || []).map((m: any) => ({ id: m.id, name: m.name, calories: m.calories, timestamp: new Date(m.logged_at) }));
          setDailyLog({ id: log.id, date: new Date(log.log_date), consumedCalories: log.consumed_calories, meals });
        }
        const msgs = await getChatMessages(currentUser.id, CHAT_HISTORY_LIMIT);
        setChatMessages(msgs as ChatMessage[]);
      } catch (e) { console.error("Error loading user data:", e); }
      finally { setIsLogLoading(false); }
    };
    loadUserData();
  }, [currentUser]);

  // ============================================================
  // FOOD SEARCH (debounced)
  // ============================================================
  const [debouncedFoodSearch, setDebouncedFoodSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebouncedFoodSearch(foodSearchTerm), 300); return () => clearTimeout(t); }, [foodSearchTerm]);
  useEffect(() => {
    if (!isFoodDbOpen) return;
    const load = async () => { setIsLoadingFoods(true); const foods = await getFoodItems(debouncedFoodSearch); setDatabaseFoods(foods); setIsLoadingFoods(false); };
    load();
  }, [isFoodDbOpen, debouncedFoodSearch]);

  // ============================================================
  // WEEKLY/MONTHLY LOGS
  // ============================================================
  useEffect(() => {
    if (!isWeeklyDialogOpen || !currentUser) return;
    const load = async () => {
      setIsWeeklyLoading(true);
      const logs = await getLogsForDateRange(currentUser.id, startOfWeek(new Date(), { weekStartsOn: 1 }), endOfWeek(new Date(), { weekStartsOn: 1 }));
      setWeeklyLogs(logs.map(l => ({ id: l.id, date: new Date(l.log_date), consumedCalories: l.consumed_calories, meals: (l.meal_entries || []).map((m: any) => ({ id: m.id, name: m.name, calories: m.calories, timestamp: new Date(m.logged_at) })) })));
      setIsWeeklyLoading(false);
    };
    load();
  }, [isWeeklyDialogOpen, currentUser]);

  useEffect(() => {
    if (!isMonthlyDialogOpen || !currentUser) return;
    const load = async () => {
      setIsMonthlyLoading(true);
      const logs = await getLogsForDateRange(currentUser.id, startOfMonth(new Date()), endOfMonth(new Date()));
      setMonthlyLogs(logs.map(l => ({ id: l.id, date: new Date(l.log_date), consumedCalories: l.consumed_calories, meals: (l.meal_entries || []).map((m: any) => ({ id: m.id, name: m.name, calories: m.calories, timestamp: new Date(m.logged_at) })) })));
      setIsMonthlyLoading(false);
    };
    load();
  }, [isMonthlyDialogOpen, currentUser]);

  // ============================================================
  // TIMERS
  // ============================================================
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      nextReset.setUTCDate(nextReset.getUTCDate() + 1);
      const diff = nextReset.getTime() - now.getTime();
      setCountdown(`${String(Math.floor(diff / 3600000)).padStart(2, "0")}:${String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0")}:${String(Math.floor((diff % 60000) / 1000)).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { setFormattedToday(format(new Date(), "d MMMM yyyy", { locale: th })); }, []);

  // Session storage for image analysis
  useEffect(() => { if (imageAnalysisResult) sessionStorage.setItem("imageAnalysisResult", JSON.stringify(imageAnalysisResult)); }, [imageAnalysisResult]);
  useEffect(() => { if (previewUrl) sessionStorage.setItem("previewUrl", previewUrl); }, [previewUrl]);
  useEffect(() => {
    const r = sessionStorage.getItem("imageAnalysisResult");
    const p = sessionStorage.getItem("previewUrl");
    if (r) try { setImageAnalysisResult(JSON.parse(r)); } catch {}
    if (p) setPreviewUrl(p);
  }, []);

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleLogout = async () => { await supabase.auth.signOut(); sessionStorage.clear(); toast({ title: "ออกจากระบบสำเร็จ" }); };

  const resetImageRelatedStates = () => {
    setSelectedFile(null); setPreviewUrl(null); setImageAnalysisResult(null); setImageError(null);
    sessionStorage.removeItem("previewUrl"); sessionStorage.removeItem("imageAnalysisResult");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) { resetImageRelatedStates(); setSelectedFile(file); const reader = new FileReader(); reader.onloadend = () => setPreviewUrl(reader.result as string); reader.readAsDataURL(file); }
  };

  const handleImageAnalysis = async () => {
    if (!selectedFile) { setImageError("โปรดเลือกไฟล์รูปภาพก่อน"); return; }
    setIsLoadingImageAnalysis(true); setImageError(null);
    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = async () => {
      try {
        const result = await scanFoodImage({ foodImage: reader.result as string } as ScanFoodImageInput);
        setImageAnalysisResult(result);
        toast({ title: "วิเคราะห์เสร็จสมบูรณ์", description: result.foodItem === UNIDENTIFIED_FOOD_MESSAGE ? "ไม่สามารถระบุอาหารได้ โปรดลองภาพอื่น" : `ระบุได้: ${result.foodItem}` });
      } catch (e: any) { setImageError(e.message || "วิเคราะห์รูปภาพไม่สำเร็จ"); toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" }); }
      finally { setIsLoadingImageAnalysis(false); }
    };
    reader.onerror = () => { setImageError("ไม่สามารถอ่านไฟล์"); setIsLoadingImageAnalysis(false); };
  };

  const logMealToDb = async (name: string, calories: number, source = "manual") => {
    if (!currentUser) return false;
    let logId = dailyLogId;
    if (!logId) {
      const log = await getOrCreateDailyLog(currentUser.id, new Date());
      if (!log) { toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" }); return false; }
      logId = log.id; setDailyLogId(logId);
    }
    const entry = await addMealEntry(currentUser.id, logId, { name, calories, source });
    if (!entry) { toast({ title: "ไม่สามารถบันทึกมื้ออาหารได้", variant: "destructive" }); return false; }
    const newCalories = (dailyLog?.consumedCalories ?? 0) + calories;
    await updateDailyLogCalories(logId, newCalories);
    const newMeal: Meal = { id: entry.id, name, calories, timestamp: new Date(entry.logged_at || new Date()) };
    setDailyLog(prev => ({ id: logId!, date: prev?.date ?? new Date(), consumedCalories: newCalories, meals: [...(prev?.meals ?? []), newMeal] }));
    return true;
  };

  const handleLogMeal = async () => {
    if (!imageAnalysisResult?.nutritionalInformation) { toast({ title: "โปรดวิเคราะห์รูปภาพก่อน", variant: "destructive" }); return; }
    const name = imageAnalysisResult.foodItem;
    const calories = imageAnalysisResult.nutritionalInformation.estimatedCalories ?? 0;
    if (calories <= 0) return;
    const currentConsumed = dailyLog?.consumedCalories ?? 0;
    const goal = userProfile.dailyCalorieGoal ?? 0;
    if (goal > 0 && currentConsumed + calories > goal) {
      setExceedAmount(currentConsumed + calories - goal); setPendingMeal({ name, calories }); setIsCalorieExceedOpen(true); return;
    }
    setIsLoggingMeal(true);
    const ok = await logMealToDb(name, calories, "ai_scan");
    setIsLoggingMeal(false);
    if (ok) toast({ title: "บันทึกมื้ออาหารสำเร็จ!" });
  };

  const handleLogMealFromDatabase = async (food: FoodItem) => {
    if (isLoggingMeal) return;
    const currentConsumed = dailyLog?.consumedCalories ?? 0;
    const goal = userProfile.dailyCalorieGoal ?? 0;
    if (goal > 0 && currentConsumed + food.calories > goal) {
      setExceedAmount(currentConsumed + food.calories - goal); setPendingMeal({ name: food.name, calories: food.calories }); setIsCalorieExceedOpen(true); setIsFoodDbOpen(false); return;
    }
    setIsLoggingMeal(true);
    const ok = await logMealToDb(food.name, food.calories, "database");
    setIsLoggingMeal(false);
    if (ok) { toast({ title: `เพิ่ม '${food.name}' สำเร็จ!` }); setIsFoodDbOpen(false); }
  };

  const handleConfirmLogMealExceed = async () => {
    if (!pendingMeal) return;
    setIsLoggingMeal(true); setIsCalorieExceedOpen(false);
    const ok = await logMealToDb(pendingMeal.name, pendingMeal.calories);
    setIsLoggingMeal(false);
    if (ok) toast({ title: "บันทึกมื้ออาหารสำเร็จ!" });
    setPendingMeal(null); setExceedAmount(0);
  };

  const handleDeleteMealClick = (meal: Meal) => setMealToDelete(meal);

  const handleConfirmDeleteMeal = async () => {
    if (!mealToDelete || !mealToDelete.id || !dailyLogId || !dailyLog) return;
    setIsDeletingMeal(true);
    const success = await deleteMealEntry(mealToDelete.id, dailyLogId, mealToDelete.calories, dailyLog.consumedCalories);
    if (success) {
      const newCalories = Math.max(0, dailyLog.consumedCalories - mealToDelete.calories);
      setDailyLog(prev => prev ? { ...prev, consumedCalories: newCalories, meals: prev.meals.filter(m => m.id !== mealToDelete.id) } : null);
      toast({ title: "ลบมื้ออาหารสำเร็จ" });
    } else { toast({ title: "เกิดข้อผิดพลาดในการลบ", variant: "destructive" }); }
    setIsDeletingMeal(false); setMealToDelete(null);
  };

  const handleRefreshDailyLog = async () => {
    if (!currentUser) return;
    setIsLogLoading(true);
    try {
      const log = await getOrCreateDailyLog(currentUser.id, new Date());
      if (log) {
        setDailyLogId(log.id);
        const meals: Meal[] = (log.meal_entries || []).map((m: any) => ({ id: m.id, name: m.name, calories: m.calories, timestamp: new Date(m.logged_at) }));
        setDailyLog({ id: log.id, date: new Date(log.log_date), consumedCalories: log.consumed_calories, meals });
      }
      toast({ title: "รีเฟรชข้อมูลสำเร็จ" });
    } catch (e) { console.error("Error refreshing:", e); toast({ title: "เกิดข้อผิดพลาดในการรีเฟรช", variant: "destructive" }); }
    finally { setIsLogLoading(false); }
  };

  const handleChatSubmit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    const msg = chatInput.trim();
    if (!msg || !currentUser) return;
    const userMsg: ChatMessage = { role: "user", content: msg };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated); setChatInput(""); setIsChatLoading(true);
    await addChatMessage(currentUser.id, "user", msg);
    try {
      const result: AIChatOutput = await chatWithBot({ message: msg, history: chatMessages.slice(-5) });
      const botMsg: ChatMessage = { role: "model", content: result.response };
      const final = [...updated, botMsg];
      const trimmed = final.length > CHAT_HISTORY_LIMIT ? final.slice(final.length - CHAT_HISTORY_LIMIT) : final;
      setChatMessages(trimmed);
      await addChatMessage(currentUser.id, "model", result.response);
    } catch { setChatMessages(prev => [...prev, { role: "model", content: "ขออภัย มีปัญหาในการเชื่อมต่อ AI โปรดลองอีกครั้ง" }]); toast({ title: "Chatbot Error", variant: "destructive" }); }
    finally { setIsChatLoading(false); }
  };

  const handleCalculateBmi = async () => {
    const profile = calculateBmiProfile(height, weight);
    if (!profile) { toast({ title: "ข้อมูลไม่ถูกต้อง", description: "โปรดกรอกส่วนสูงและน้ำหนักให้ถูกต้อง", variant: "destructive" }); return; }
    const customGoal = validateCalorieGoal(customCalorieGoal);
    if (customGoal !== null) profile.dailyCalorieGoal = customGoal;
    setIsCalculatingBmi(true);
    const newProfile: UserProfile = { height: profile.height, weight: profile.weight, bmi: profile.bmi, dailyCalorieGoal: profile.dailyCalorieGoal };
    setUserProfile(newProfile);
    if (currentUser) { await upsertUserProfile(currentUser.id, { height: profile.height, weight: profile.weight, bmi: profile.bmi, daily_calorie_goal: profile.dailyCalorieGoal } as any); }
    toast({ title: "บันทึกโปรไฟล์สำเร็จ", description: `BMI ของคุณคือ ${profile.bmi}` });
    setIsCalculatingBmi(false);
  };

  // ============================================================
  // COMPUTED VALUES
  // ============================================================
  const filteredFoods = useMemo(() => databaseFoods, [databaseFoods]);

  const weeklyChartData = useMemo(() => {
    return eachDayOfInterval({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) }).map(day => {
      const log = weeklyLogs.find(l => format(new Date(l.date), "yyyy-MM-dd") === format(day, "yyyy-MM-dd"));
      return { name: format(day, "E", { locale: th }), calories: log?.consumedCalories ?? 0 };
    });
  }, [weeklyLogs]);

  const monthlyChartData = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }).map(day => {
      const log = monthlyLogs.find(l => format(new Date(l.date), "yyyy-MM-dd") === format(day, "yyyy-MM-dd"));
      return { name: format(day, "d"), calories: log?.consumedCalories ?? 0 };
    });
  }, [monthlyLogs]);

  const weeklyTotalCalories = useMemo(() => weeklyLogs.reduce((s, l) => s + l.consumedCalories, 0), [weeklyLogs]);
  const weeklyAverageCalories = useMemo(() => weeklyLogs.length > 0 ? Math.round(weeklyTotalCalories / weeklyLogs.length) : 0, [weeklyLogs, weeklyTotalCalories]);
  const monthlyTotalCalories = useMemo(() => monthlyLogs.reduce((s, l) => s + l.consumedCalories, 0), [monthlyLogs]);
  const monthlyAverageCalories = useMemo(() => monthlyLogs.length > 0 ? Math.round(monthlyTotalCalories / monthlyLogs.length) : 0, [monthlyLogs, monthlyTotalCalories]);

  const getBmiInterpretation = (bmi?: number): { text: string; color: string } => {
    if (!bmi) return { text: "N/A", color: "text-muted-foreground" };
    if (bmi < 18.5) return { text: "ผอม", color: "text-blue-500" };
    if (bmi < 23) return { text: "สมส่วน", color: "text-green-500" };
    if (bmi < 25) return { text: "ท้วม", color: "text-yellow-500" };
    if (bmi < 30) return { text: "อ้วนระดับ 1", color: "text-orange-500" };
    return { text: "อ้วนระดับ 2 (อันตราย)", color: "text-red-500" };
  };

  const isFoodIdentified = imageAnalysisResult?.foodItem !== UNIDENTIFIED_FOOD_MESSAGE;

  // ============================================================
  // RENDER — Auth loading
  // ============================================================
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
          <ScanLine className="h-12 w-12 text-primary animate-pulse" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </motion.div>
      </div>
    );
  }

  // ============================================================
  // RENDER — Animated Page Transition (Auth ↔ Dashboard)
  // ============================================================
  return (
    <AnimatePresence mode="wait">
      {!currentUser ? (
        <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95, y: -20 }} transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] as const }}>
          <AuthScreen onAuthSuccess={() => {}} />
        </motion.div>
      ) : (
        <motion.div key="dashboard" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] as const, delay: 0.1 }}>
    <div className="min-h-screen bg-background text-foreground font-body pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <ScanLine className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">MOMU SCAN</span>
          </Link>
          <div className="flex items-center space-x-2">
            <Link href="/reports">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <BarChart2 className="h-4 w-4" /><span className="hidden sm:inline">รายงาน</span>
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full w-9 h-9 border-primary/30 hover:border-primary/60 transition-colors" aria-label="เมนูบัญชี">
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                    {currentUser.email?.charAt(0).toUpperCase()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{currentUser.email?.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">บัญชีของฉัน</p>
                      <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer gap-2 py-2.5" onClick={() => setIsProfileSettingsOpen(true)}>
                  <User className="h-4 w-4 text-muted-foreground" /><span>ตั้งค่าโปรไฟล์</span><ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2 py-2.5" onClick={(e) => { e.preventDefault(); toggleDarkMode(); }}>
                  {isDarkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-500" />}
                  <span>{isDarkMode ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{isDarkMode ? 'Light' : 'Dark'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2 py-2.5" asChild><Link href="/reports"><BarChart2 className="h-4 w-4 text-muted-foreground" /><span>รายงานสรุป</span></Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer gap-2 py-2.5 text-destructive focus:text-destructive"><LogOut className="h-4 w-4" /><span>ออกจากระบบ</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Profile Settings Sheet */}
      <ProfileSettings
        isOpen={isProfileSettingsOpen} onOpenChange={setIsProfileSettingsOpen}
        currentUser={currentUser} userProfile={userProfile}
        height={height} weight={weight} customCalorieGoal={customCalorieGoal}
        onHeightChange={setHeight} onWeightChange={setWeight} onCalorieGoalChange={setCustomCalorieGoal}
        isCalculatingBmi={isCalculatingBmi} onCalculateBmi={handleCalculateBmi}
        isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode}
        onLogout={handleLogout} getBmiInterpretation={getBmiInterpretation}
      />

      {/* Food DB Dialog */}
      <Dialog open={isFoodDbOpen} onOpenChange={(open) => { setIsFoodDbOpen(open); if (!open) setFoodSearchTerm(""); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>เลือกจากรายการอาหาร</DialogTitle>
            <DialogDescription>ค้นหาและเลือกอาหารจากฐานข้อมูลเพื่อบันทึกแคลอรี่อย่างรวดเร็ว</DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <Input placeholder="ค้นหาชื่ออาหาร..." value={foodSearchTerm} onChange={(e) => setFoodSearchTerm(e.target.value)} className="mb-4" />
            {isLoadingFoods ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <ScrollArea className="h-96">
                <div className="space-y-2 pr-4">
                  {filteredFoods.length > 0 ? filteredFoods.map((food) => (
                    <Card key={food.id} className="flex items-center p-3">
                      <div className="flex-grow"><p className="font-medium text-sm">{food.name}</p><p className="text-xs text-muted-foreground">{food.calories.toLocaleString()} kcal / เสิร์ฟ</p></div>
                      <Button size="sm" onClick={() => handleLogMealFromDatabase(food)} disabled={isLoggingMeal}>เพิ่ม</Button>
                    </Card>
                  )) : <p className="text-center text-muted-foreground py-8">ไม่พบรายการอาหาร</p>}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Calorie Exceed Dialog */}
      <Dialog open={isCalorieExceedOpen} onOpenChange={setIsCalorieExceedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-500">⚠️ แคลอรี่เกินเป้าหมาย</DialogTitle>
            <DialogDescription>การเพิ่มมื้ออาหารนี้จะทำให้คุณบริโภคแคลอรี่เกินเป้าหมาย {exceedAmount.toLocaleString()} kcal</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 text-sm text-muted-foreground">
            <p>เป้าหมาย: {userProfile.dailyCalorieGoal?.toLocaleString()} kcal</p>
            <p>ปัจจุบัน: {(dailyLog?.consumedCalories ?? 0).toLocaleString()} kcal</p>
            <p>ที่จะเพิ่ม: {pendingMeal?.calories.toLocaleString()} kcal</p>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setIsCalorieExceedOpen(false); setPendingMeal(null); setExceedAmount(0); }}>ยกเลิก</Button>
            <Button onClick={handleConfirmLogMealExceed} disabled={isLoggingMeal}>
              {isLoggingMeal ? <Loader2 className="animate-spin mr-2" /> : null}บันทึกเพิ่ม
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Content Grid */}
      <main className="container mx-auto grid grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-5 lg:px-8">
        <div className="lg:col-span-3 space-y-8">
          <FoodAnalysis
            previewUrl={previewUrl} imageAnalysisResult={imageAnalysisResult}
            isLoadingImageAnalysis={isLoadingImageAnalysis} isLoggingMeal={isLoggingMeal}
            onFileChange={handleFileChange} onScan={handleImageAnalysis}
            onReset={resetImageRelatedStates} onLogMeal={handleLogMeal}
            onOpenFoodDb={() => setIsFoodDbOpen(true)}
          />
          <ManualFoodEntry
            dailyCalorieGoal={userProfile.dailyCalorieGoal}
            currentConsumedCalories={dailyLog?.consumedCalories ?? 0}
            onLogMeal={async (name, calories) => await logMealToDb(name, calories, "manual")}
          />
          <AIChatPanel
            chatMessages={chatMessages} chatInput={chatInput} isChatLoading={isChatLoading}
            onInputChange={setChatInput} onSubmit={handleChatSubmit}
          />
        </div>
        <div className="lg:col-span-2 space-y-8">
          <DailyOverview
            dailyLog={dailyLog} userProfile={userProfile} isLogLoading={isLogLoading}
            countdown={countdown} formattedToday={formattedToday}
            onRefresh={handleRefreshDailyLog} onDeleteMeal={handleDeleteMealClick}
            onOpenWeekly={() => setIsWeeklyDialogOpen(true)} onOpenMonthly={() => setIsMonthlyDialogOpen(true)}
            onOpenFoodDb={() => setIsFoodDbOpen(true)} onScrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          />
          <ChartDialogs
            isWeeklyOpen={isWeeklyDialogOpen} onWeeklyChange={setIsWeeklyDialogOpen}
            isWeeklyLoading={isWeeklyLoading} weeklyChartData={weeklyChartData}
            weeklyTotal={weeklyTotalCalories} weeklyAverage={weeklyAverageCalories} weeklyHasData={weeklyLogs.length > 0}
            isMonthlyOpen={isMonthlyDialogOpen} onMonthlyChange={setIsMonthlyDialogOpen}
            isMonthlyLoading={isMonthlyLoading} monthlyChartData={monthlyChartData}
            monthlyTotal={monthlyTotalCalories} monthlyAverage={monthlyAverageCalories} monthlyHasData={monthlyLogs.length > 0}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 mt-8 border-t space-y-1">
        <p className="text-xs text-muted-foreground">MOMU SCAN v1.0 — ติดตามสุขภาพและแคลอรี่ด้วย AI</p>
        <p className="text-xs text-muted-foreground">
          <span>{currentUser.email}</span><span className="mx-1.5">·</span>
          <button className="underline underline-offset-2 hover:text-foreground transition-colors" onClick={() => toast({ title: "นโยบายความเป็นส่วนตัว", description: "เรารักษาข้อมูลของคุณอย่างปลอดภัย ข้อมูลทั้งหมดจัดเก็บใน Supabase ที่เข้ารหัส" })}>นโยบายความเป็นส่วนตัว</button>
        </p>
      </footer>

      {/* Delete Meal Dialog */}
      <Dialog open={!!mealToDelete} onOpenChange={(open) => !open && setMealToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบมื้ออาหาร</DialogTitle>
            <DialogDescription>คุณต้องการลบ <b>{mealToDelete?.name}</b> ({mealToDelete?.calories.toLocaleString()} kcal) ออกจากบันทึกของวันนี้ใช่หรือไม่?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setMealToDelete(null)} disabled={isDeletingMeal}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteMeal} disabled={isDeletingMeal}>
              {isDeletingMeal ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}ลบมื้ออาหาร
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t flex justify-around items-center h-16 pb-safe" aria-label="เมนูหลัก">
        <Button variant="ghost" className="flex flex-col items-center gap-1 h-full py-2 px-4 rounded-none hover:bg-transparent" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="กลับหน้าแรก">
          <ScanLine className="h-5 w-5 text-primary" /><span className="text-[10px] text-primary">หน้าแรก</span>
        </Button>
        <Link href="/reports" aria-label="ไปหน้ารายงาน">
          <Button variant="ghost" className="flex flex-col items-center gap-1 h-full py-2 px-4 rounded-none hover:bg-transparent text-muted-foreground hover:text-foreground">
            <BarChart2 className="h-5 w-5" /><span className="text-[10px]">รายงาน</span>
          </Button>
        </Link>
        <Button variant="ghost" className="flex flex-col items-center gap-1 h-full py-2 px-4 rounded-none hover:bg-transparent text-muted-foreground hover:text-foreground" onClick={() => setIsProfileSettingsOpen(true)} aria-label="เปิดโปรไฟล์">
          <User className="h-5 w-5" /><span className="text-[10px]">โปรไฟล์</span>
        </Button>
      </nav>
    </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default dynamic(
  () => Promise.resolve(FSFAPageFn as React.ComponentType),
  { ssr: false },
);
