"use client";

import dynamic from "next/dynamic";
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Image from "next/image";
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
import { calculateBmiProfile } from "@/app/utils/bmiHelpers";
import { handleAuthError as helperHandleAuthError } from "@/app/utils/authHelpers";
import {
  getUserProfile,
  upsertUserProfile,
  getOrCreateDailyLog,
  updateDailyLogCalories,
  addMealEntry,
  getLogsForDateRange,
  getChatMessages,
  addChatMessage,
  getFoodItems,
  type FoodItem,
  type DailyLogRecord,
} from "@/lib/db";

// date-fns for date calculations
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
} from "date-fns";
import { th } from "date-fns/locale";

// Recharts for charts
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// ShadCN UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

// Lucide Icons
import {
  Camera,
  Brain,
  AlertCircle,
  CheckCircle,
  Info,
  UserCircle,
  LogIn,
  UserPlus,
  LogOut,
  Loader2,
  Send,
  MessageCircle,
  ScanLine,
  Flame,
  Calculator,
  PlusCircle,
  BookCheck,
  Clock,
  CalendarDays,
  BarChart as BarChartIcon,
  Wheat,
  Sparkles,
  Trash2,
  AreaChart,
  PieChart,
  UploadCloud,
  Database,
  RotateCw,
} from "lucide-react";

const UNIDENTIFIED_FOOD_MESSAGE = "ไม่สามารถระบุชนิดอาหารได้";
const CHAT_HISTORY_LIMIT = 50;

interface UserProfile {
  height?: number;
  weight?: number;
  bmi?: number;
  dailyCalorieGoal?: number;
}

interface Meal {
  name: string;
  calories: number;
  timestamp: Date;
}

interface DailyLog {
  id?: string;
  date: Date;
  consumedCalories: number;
  meals: Meal[];
}

// ============================================================
// AUTH SCREEN COMPONENT
// ============================================================
function AuthScreen({
  onAuthSuccess,
}: {
  onAuthSuccess: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("โปรดกรอกข้อมูลให้ครบ"); return; }
    setIsLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (authError) {
      const msg = authError.message;
      if (msg === "Invalid login credentials") {
        setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      } else if (msg === "Email not confirmed") {
        setError("อีเมลยังไม่ได้รับการยืนยัน — กรุณาตรวจสอบกล่องจดหมายของคุณ หรือขอให้ Admin ปิดการยืนยัน Email ใน Supabase Dashboard");
      } else if (msg.includes("rate limit") || msg.includes("too many")) {
        setError("คุณลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่");
      } else {
        setError(msg);
      }
      return;
    }
    toast({ title: "เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ!" });
    onAuthSuccess();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("โปรดกรอกข้อมูลให้ครบ"); return; }
    if (password !== confirmPassword) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    if (password.length < 6) { setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setIsLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) {
      setIsLoading(false);
      setError(authError.message);
      return;
    }
    // Create user_profiles row
    if (data.user) {
      await supabase.from('user_profiles').upsert({ id: data.user.id });
    }
    setIsLoading(false);
    toast({ title: "สมัครสมาชิกสำเร็จ!", description: "กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี หรือเข้าสู่ระบบได้เลย" });
    setMode("login");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <ScanLine className="h-10 w-10 text-primary" />
          <span className="text-3xl font-bold tracking-tight">MOMU SCAN</span>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">
              {mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชีใหม่"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "ยินดีต้อนรับกลับ! กรอกข้อมูลเพื่อเข้าสู่ระบบ"
                : "สร้างบัญชีเพื่อเริ่มติดตามสุขภาพของคุณ"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="auth-email">อีเมล</Label>
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-password">รหัสผ่าน</Label>
                <Input
                  id="auth-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="auth-confirm">ยืนยันรหัสผ่าน</Label>
                  <Input
                    id="auth-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                ) : mode === "login" ? (
                  <LogIn className="mr-2 h-4 w-4" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center pt-0">
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "ยังไม่มีบัญชี?" : "มีบัญชีอยู่แล้ว?"}
              <Button
                variant="link"
                className="px-2 py-0 h-auto"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError("");
                }}
                disabled={isLoading}
              >
                {mode === "login" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
              </Button>
            </p>
          </CardFooter>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-6">
          MOMU SCAN — ติดตามสุขภาพและแคลอรี่ด้วย AI
        </p>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
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

  // Refs
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // ============================================================
  // AUTH EFFECT — Listen to Supabase auth state
  // ============================================================
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ============================================================
  // LOAD USER DATA when logged in
  // ============================================================
  useEffect(() => {
    if (!currentUser) {
      // Reset state on logout
      setUserProfile({});
      setHeight("");
      setWeight("");
      setCustomCalorieGoal("");
      setDailyLog(null);
      setDailyLogId(null);
      setChatMessages([]);
      return;
    }

    // Load all user data
    const loadUserData = async () => {
      setIsLogLoading(true);
      try {
        // Load profile
        const profile = await getUserProfile(currentUser.id);
        if (profile) {
          setUserProfile({
            height: profile.height,
            weight: profile.weight,
            bmi: profile.bmi,
            dailyCalorieGoal: profile.daily_calorie_goal,
          });
          setHeight(String(profile.height || ""));
          setWeight(String(profile.weight || ""));
          if (profile.daily_calorie_goal) {
            setCustomCalorieGoal(String(profile.daily_calorie_goal));
          }
        }

        // Load today's log
        const log = await getOrCreateDailyLog(currentUser.id, new Date());
        if (log) {
          setDailyLogId(log.id);
          const meals: Meal[] = (log.meal_entries || []).map((m: any) => ({
            name: m.name,
            calories: m.calories,
            timestamp: new Date(m.logged_at),
          }));
          setDailyLog({
            id: log.id,
            date: new Date(log.log_date),
            consumedCalories: log.consumed_calories,
            meals,
          });
        }

        // Load chat messages
        const msgs = await getChatMessages(currentUser.id, CHAT_HISTORY_LIMIT);
        setChatMessages(msgs as ChatMessage[]);
      } catch (e) {
        console.error("Error loading user data:", e);
      } finally {
        setIsLogLoading(false);
      }
    };

    loadUserData();
  }, [currentUser]);

  // ============================================================
  // LOAD FOOD ITEMS when dialog opens
  // ============================================================
  useEffect(() => {
    if (!isFoodDbOpen) return;
    const load = async () => {
      setIsLoadingFoods(true);
      const foods = await getFoodItems(foodSearchTerm);
      setDatabaseFoods(foods);
      setIsLoadingFoods(false);
    };
    load();
  }, [isFoodDbOpen, foodSearchTerm]);

  // ============================================================
  // WEEKLY LOGS
  // ============================================================
  useEffect(() => {
    if (!isWeeklyDialogOpen || !currentUser) return;
    const load = async () => {
      setIsWeeklyLoading(true);
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      const logs = await getLogsForDateRange(currentUser.id, weekStart, weekEnd);
      setWeeklyLogs(logs.map(l => ({
        id: l.id,
        date: new Date(l.log_date),
        consumedCalories: l.consumed_calories,
        meals: (l.meal_entries || []).map((m: any) => ({
          name: m.name, calories: m.calories, timestamp: new Date(m.logged_at),
        })),
      })));
      setIsWeeklyLoading(false);
    };
    load();
  }, [isWeeklyDialogOpen, currentUser]);

  // ============================================================
  // MONTHLY LOGS
  // ============================================================
  useEffect(() => {
    if (!isMonthlyDialogOpen || !currentUser) return;
    const load = async () => {
      setIsMonthlyLoading(true);
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());
      const logs = await getLogsForDateRange(currentUser.id, monthStart, monthEnd);
      setMonthlyLogs(logs.map(l => ({
        id: l.id,
        date: new Date(l.log_date),
        consumedCalories: l.consumed_calories,
        meals: (l.meal_entries || []).map((m: any) => ({
          name: m.name, calories: m.calories, timestamp: new Date(m.logged_at),
        })),
      })));
      setIsMonthlyLoading(false);
    };
    load();
  }, [isMonthlyDialogOpen, currentUser]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      nextReset.setUTCDate(nextReset.getUTCDate() + 1);
      const diff = nextReset.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setFormattedToday(format(new Date(), "d MMMM yyyy", { locale: th }));
  }, []);

  useEffect(() => {
    if (chatScrollAreaRef.current) {
      chatScrollAreaRef.current.scrollTop = chatScrollAreaRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Save image analysis result to sessionStorage (short-lived, no need DB)
  useEffect(() => {
    if (imageAnalysisResult) sessionStorage.setItem("imageAnalysisResult", JSON.stringify(imageAnalysisResult));
  }, [imageAnalysisResult]);
  useEffect(() => {
    if (previewUrl) sessionStorage.setItem("previewUrl", previewUrl);
  }, [previewUrl]);
  useEffect(() => {
    const r = sessionStorage.getItem("imageAnalysisResult");
    const p = sessionStorage.getItem("previewUrl");
    if (r) try { setImageAnalysisResult(JSON.parse(r)); } catch {}
    if (p) setPreviewUrl(p);
  }, []);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.clear();
    toast({ title: "ออกจากระบบสำเร็จ" });
  };

  const resetImageRelatedStates = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageAnalysisResult(null);
    setImageError(null);
    sessionStorage.removeItem("previewUrl");
    sessionStorage.removeItem("imageAnalysisResult");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      resetImageRelatedStates();
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleImageAnalysis = async () => {
    if (!selectedFile) { setImageError("โปรดเลือกไฟล์รูปภาพก่อน"); return; }
    setIsLoadingImageAnalysis(true);
    setImageError(null);
    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = async () => {
      try {
        const result = await scanFoodImage({ foodImage: reader.result as string } as ScanFoodImageInput);
        setImageAnalysisResult(result);
        toast({
          title: "วิเคราะห์เสร็จสมบูรณ์",
          description: result.foodItem === UNIDENTIFIED_FOOD_MESSAGE ? "ไม่สามารถระบุอาหารได้ โปรดลองภาพอื่น" : `ระบุได้: ${result.foodItem}`,
        });
      } catch (e: any) {
        setImageError(e.message || "วิเคราะห์รูปภาพไม่สำเร็จ");
        toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
      } finally {
        setIsLoadingImageAnalysis(false);
      }
    };
    reader.onerror = () => { setImageError("ไม่สามารถอ่านไฟล์"); setIsLoadingImageAnalysis(false); };
  };

  const ensureDate = (d: string | Date | undefined): Date | undefined => {
    if (!d) return undefined;
    if (d instanceof Date) return d;
    return new Date(d);
  };

  const getMealPeriod = (date: Date | string | undefined): string => {
    if (!date) return "ไม่ทราบ";
    const d = ensureDate(date);
    if (!d || isNaN(d.getTime())) return "ไม่ทราบ";
    const h = d.getHours();
    if (h >= 6 && h < 9) return "เช้า";
    if (h >= 9 && h < 12) return "สาย";
    if (h >= 12 && h < 14) return "เที่ยง";
    if (h >= 14 && h < 17) return "บ่าย";
    if (h >= 17 && h < 20) return "เย็น";
    if (h >= 20 && h < 23) return "ค่ำ";
    return "ดึก";
  };

  // Core function to log a meal to Supabase
  const logMealToDb = async (name: string, calories: number, source = "manual") => {
    if (!currentUser) return false;

    // Ensure we have a log ID
    let logId = dailyLogId;
    if (!logId) {
      const log = await getOrCreateDailyLog(currentUser.id, new Date());
      if (!log) { toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" }); return false; }
      logId = log.id;
      setDailyLogId(logId);
    }

    // Add meal entry
    const entry = await addMealEntry(currentUser.id, logId, { name, calories, source });
    if (!entry) { toast({ title: "ไม่สามารถบันทึกมื้ออาหารได้", variant: "destructive" }); return false; }

    // Update local state
    const newCalories = (dailyLog?.consumedCalories ?? 0) + calories;
    await updateDailyLogCalories(logId, newCalories);

    const newMeal: Meal = { name, calories, timestamp: new Date(entry.logged_at || new Date()) };
    setDailyLog(prev => ({
      id: logId!,
      date: prev?.date ?? new Date(),
      consumedCalories: newCalories,
      meals: [...(prev?.meals ?? []), newMeal],
    }));
    return true;
  };

  const handleLogMeal = async () => {
    if (!imageAnalysisResult?.nutritionalInformation) {
      toast({ title: "โปรดวิเคราะห์รูปภาพก่อน", variant: "destructive" });
      return;
    }
    const name = imageAnalysisResult.foodItem;
    const calories = imageAnalysisResult.nutritionalInformation.estimatedCalories ?? 0;
    if (calories <= 0) return;

    const currentConsumed = dailyLog?.consumedCalories ?? 0;
    const goal = userProfile.dailyCalorieGoal ?? 0;
    if (goal > 0 && currentConsumed + calories > goal) {
      setExceedAmount(currentConsumed + calories - goal);
      setPendingMeal({ name, calories });
      setIsCalorieExceedOpen(true);
      return;
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
      setExceedAmount(currentConsumed + food.calories - goal);
      setPendingMeal({ name: food.name, calories: food.calories });
      setIsCalorieExceedOpen(true);
      setIsFoodDbOpen(false);
      return;
    }
    setIsLoggingMeal(true);
    const ok = await logMealToDb(food.name, food.calories, "database");
    setIsLoggingMeal(false);
    if (ok) {
      toast({ title: `เพิ่ม '${food.name}' สำเร็จ!` });
      setIsFoodDbOpen(false);
    }
  };

  const handleConfirmLogMealExceed = async () => {
    if (!pendingMeal) return;
    setIsLoggingMeal(true);
    setIsCalorieExceedOpen(false);
    const ok = await logMealToDb(pendingMeal.name, pendingMeal.calories);
    setIsLoggingMeal(false);
    if (ok) toast({ title: "บันทึกมื้ออาหารสำเร็จ!" });
    setPendingMeal(null);
    setExceedAmount(0);
  };

  const handleChatSubmit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    const msg = chatInput.trim();
    if (!msg || !currentUser) return;

    const userMsg: ChatMessage = { role: "user", content: msg };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput("");
    setIsChatLoading(true);

    // Save user message
    await addChatMessage(currentUser.id, "user", msg);

    try {
      const result: AIChatOutput = await chatWithBot({ message: msg, history: chatMessages.slice(-5) });
      const botMsg: ChatMessage = { role: "model", content: result.response };
      const final = [...updated, botMsg];
      const trimmed = final.length > CHAT_HISTORY_LIMIT ? final.slice(final.length - CHAT_HISTORY_LIMIT) : final;
      setChatMessages(trimmed);
      await addChatMessage(currentUser.id, "model", result.response);
    } catch {
      const errMsg: ChatMessage = { role: "model", content: "ขออภัย มีปัญหาในการเชื่อมต่อ AI โปรดลองอีกครั้ง" };
      setChatMessages(prev => [...prev, errMsg]);
      toast({ title: "Chatbot Error", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
      chatInputRef.current?.focus();
    }
  };

  const handleCalculateBmi = async () => {
    const profile = calculateBmiProfile(height, weight);
    if (!profile) {
      toast({ title: "ข้อมูลไม่ถูกต้อง", description: "โปรดกรอกส่วนสูงและน้ำหนักให้ถูกต้อง", variant: "destructive" });
      return;
    }
    const customGoal = parseFloat(customCalorieGoal);
    if (!isNaN(customGoal) && customGoal > 0) profile.dailyCalorieGoal = customGoal;

    setIsCalculatingBmi(true);
    const newProfile: UserProfile = {
      height: profile.height,
      weight: profile.weight,
      bmi: profile.bmi,
      dailyCalorieGoal: profile.dailyCalorieGoal,
    };
    setUserProfile(newProfile);

    if (currentUser) {
      await upsertUserProfile(currentUser.id, {
        height: profile.height,
        weight: profile.weight,
        bmi: profile.bmi,
        daily_calorie_goal: profile.dailyCalorieGoal,
      } as any);
    }

    toast({ title: "บันทึกโปรไฟล์สำเร็จ", description: `BMI ของคุณคือ ${profile.bmi}` });
    setIsCalculatingBmi(false);
  };

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  const groupedMeals = useMemo(() => {
    if (!dailyLog?.meals) return {};
    return dailyLog.meals.reduce((acc: Record<string, Meal[]>, meal) => {
      const period = getMealPeriod(meal.timestamp);
      if (!acc[period]) acc[period] = [];
      acc[period].push(meal);
      acc[period].sort((a, b) => {
        const da = ensureDate(a.timestamp), db = ensureDate(b.timestamp);
        return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
      });
      return acc;
    }, {});
  }, [dailyLog]);

  const mealPeriodOrder = ["เช้า", "สาย", "เที่ยง", "บ่าย", "เย็น", "ค่ำ", "ดึก"];

  const filteredFoods = useMemo(() => {
    if (!foodSearchTerm) return databaseFoods;
    return databaseFoods.filter(f => f.name.toLowerCase().includes(foodSearchTerm.toLowerCase()));
  }, [databaseFoods, foodSearchTerm]);

  const chartConfig = { calories: { label: "แคลอรี่", color: "hsl(var(--chart-1))" } } satisfies ChartConfig;

  const calorieProgress = useMemo(() => {
    const goal = userProfile.dailyCalorieGoal;
    const consumed = dailyLog?.consumedCalories || 0;
    if (!goal || goal === 0) return 0;
    return Math.min((consumed / goal) * 100, 100);
  }, [userProfile.dailyCalorieGoal, dailyLog?.consumedCalories]);

  const weeklyChartData = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd }).map(day => {
      const log = weeklyLogs.find(l => format(new Date(l.date), "yyyy-MM-dd") === format(day, "yyyy-MM-dd"));
      return { name: format(day, "E", { locale: th }), calories: log?.consumedCalories ?? 0 };
    });
  }, [weeklyLogs]);

  const monthlyChartData = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    return eachDayOfInterval({ start: monthStart, end: monthEnd }).map(day => {
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
        <div className="flex flex-col items-center gap-4">
          <ScanLine className="h-12 w-12 text-primary animate-pulse" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER — Not logged in → Show Auth Screen
  // ============================================================
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={() => {}} />;
  }

  // ============================================================
  // RENDER — Main App (logged in)
  // ============================================================
  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <ScanLine className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">MOMU SCAN</span>
          </Link>
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full w-9 h-9">
                  <UserCircle className="w-5 h-5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>บัญชีของฉัน</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <span className="truncate text-xs text-muted-foreground">{currentUser.email}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>ออกจากระบบ</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Food DB Dialog */}
      <Dialog open={isFoodDbOpen} onOpenChange={(open) => { setIsFoodDbOpen(open); if (!open) setFoodSearchTerm(""); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>เลือกจากรายการอาหาร</DialogTitle>
            <DialogDescription>ค้นหาและเลือกอาหารจากฐานข้อมูลเพื่อบันทึกแคลอรี่อย่างรวดเร็ว</DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <Input
              placeholder="ค้นหาชื่ออาหาร..."
              value={foodSearchTerm}
              onChange={(e) => setFoodSearchTerm(e.target.value)}
              className="mb-4"
            />
            {isLoadingFoods ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <ScrollArea className="h-96">
                <div className="space-y-2 pr-4">
                  {filteredFoods.length > 0 ? (
                    filteredFoods.map((food) => (
                      <Card key={food.id} className="flex items-center p-3">
                        <div className="flex-grow">
                          <p className="font-semibold">{food.name}</p>
                          <p className="text-sm text-muted-foreground">{food.calories.toLocaleString()} kcal
                            {food.category && <span className="ml-2 text-xs">· {food.category}</span>}
                          </p>
                        </div>
                        <Button size="sm" onClick={() => handleLogMealFromDatabase(food)} disabled={isLoggingMeal}>
                          {isLoggingMeal ? <Loader2 className="w-4 h-4 animate-spin" /> : "เพิ่ม"}
                        </Button>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground pt-10">ไม่พบรายการอาหารที่ตรงกัน</p>
                  )}
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
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              แคลอรี่เกินเป้าหมาย
            </DialogTitle>
            <DialogDescription>
              การเพิ่มมื้ออาหารนี้จะทำให้คุณบริโภคแคลอรี่เกินเป้าหมาย {exceedAmount.toLocaleString()} kcal
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 text-sm text-muted-foreground">
            <p>เป้าหมาย: {userProfile.dailyCalorieGoal?.toLocaleString()} kcal</p>
            <p>ปัจจุบัน: {(dailyLog?.consumedCalories ?? 0).toLocaleString()} kcal</p>
            <p>ที่จะเพิ่ม: {pendingMeal?.calories.toLocaleString()} kcal</p>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setIsCalorieExceedOpen(false); setPendingMeal(null); setExceedAmount(0); }}>ยกเลิก</Button>
            <Button onClick={handleConfirmLogMealExceed} disabled={isLoggingMeal}>
              {isLoggingMeal ? <Loader2 className="animate-spin mr-2" /> : null}
              บันทึกเพิ่ม
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="container mx-auto grid grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-5 lg:px-8">
        <div className="lg:col-span-3 space-y-8">
          {/* AI Food Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Camera className="w-6 h-6 text-primary" />
                AI วิเคราะห์อาหาร
              </CardTitle>
              <CardDescription>อัปโหลดรูปภาพอาหาร แล้ว AI จะประเมินข้อมูลโภชนาการให้คุณ</CardDescription>
            </CardHeader>
            <CardContent>
              {!previewUrl ? (
                <div className="relative">
                  <input id="food-image-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  <Label htmlFor="food-image-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex flex-col items-center justify-center text-center pt-5 pb-6">
                      <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-primary">คลิกเพื่ออัปโหลด</span> หรือลากไฟล์มาวาง
                      </p>
                      <p className="text-xs text-muted-foreground">PNG, JPG (สูงสุด 5MB)</p>
                    </div>
                  </Label>
                </div>
              ) : (
                <div className="relative group w-full aspect-video rounded-lg overflow-hidden border-2 border-dashed flex items-center justify-center bg-muted/50">
                  <Image src={previewUrl} alt="Food preview" fill className="object-contain p-2" data-ai-hint="food meal" />
                  <Button variant="destructive" size="icon" className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={resetImageRelatedStates}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleImageAnalysis} disabled={isLoadingImageAnalysis || !previewUrl} className="w-full" size="lg">
                {isLoadingImageAnalysis ? <><Loader2 className="animate-spin mr-2 h-5 w-5" />กำลังวิเคราะห์...</> : <><Sparkles className="mr-2 h-5 w-5" />วิเคราะห์รูปภาพ</>}
              </Button>
              <Button variant="secondary" className="w-full" size="lg" onClick={() => setIsFoodDbOpen(true)}>
                <Database className="mr-2 h-5 w-5" /> เลือกจากรายการอาหาร
              </Button>
            </CardFooter>
          </Card>

          {isLoadingImageAnalysis && (
            <Card>
              <CardHeader><Skeleton className="h-7 w-48" /></CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          )}

          {imageAnalysisResult && (
            <Card className="border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  {isFoodIdentified ? <CheckCircle className="w-6 h-6 text-accent" /> : <Info className="w-6 h-6 text-yellow-500" />}
                  ผลการวิเคราะห์
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">อาหารที่ระบุได้:</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-lg text-primary font-bold">{imageAnalysisResult.foodItem}</p>
                    {imageAnalysisResult.cuisineType && imageAnalysisResult.cuisineType !== "ไม่สามารถระบุประเภทได้" && (
                      <Badge variant="outline">{imageAnalysisResult.cuisineType}</Badge>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2"><Flame className="w-5 h-5 text-orange-500" />แคลอรี่โดยประมาณ</h4>
                    <p className="text-2xl font-bold">
                      {(imageAnalysisResult.nutritionalInformation.estimatedCalories ?? 0) > 0
                        ? imageAnalysisResult.nutritionalInformation.estimatedCalories.toLocaleString()
                        : "N/A"}
                      <span className="text-sm font-normal text-muted-foreground ml-1">kcal</span>
                    </p>
                    {imageAnalysisResult.nutritionalInformation.reasoning && (
                      <p className="text-xs text-muted-foreground mt-1">{imageAnalysisResult.nutritionalInformation.reasoning}</p>
                    )}
                  </div>
                  {imageAnalysisResult.nutritionalInformation.visibleIngredients?.length > 0 && (
                    <div>
                      <h4 className="font-semibold flex items-center gap-2 mb-2"><Wheat className="w-5 h-5 text-yellow-600" />ส่วนผสมที่พบ</h4>
                      <div className="flex flex-wrap gap-2">
                        {imageAnalysisResult.nutritionalInformation.visibleIngredients.map((ing, i) => (
                          <Badge key={i} variant="secondary">{ing}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              {isFoodIdentified && (
                <CardFooter>
                  <Button size="lg" onClick={handleLogMeal} disabled={isLoggingMeal || (imageAnalysisResult.nutritionalInformation.estimatedCalories ?? 0) <= 0} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                    {isLoggingMeal ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2" />}
                    เพิ่มในบันทึกแคลอรี่
                  </Button>
                </CardFooter>
              )}
            </Card>
          )}

          {/* AI Chat */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <MessageCircle className="w-6 h-6 text-primary" />
                Momu AI Assistant
              </CardTitle>
              <CardDescription>สอบถามเกี่ยวกับอาหาร โภชนาการ หรือข้อสงสัยอื่นๆ</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-72 w-full rounded-lg border bg-muted/30 p-4" viewportRef={chatScrollAreaRef}>
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <Brain className="w-12 h-12 mb-4" />
                    <p className="text-lg font-medium">เริ่มต้นการสนทนา</p>
                    <p className="text-sm">ถามคำถามเกี่ยวกับอาหารที่สแกนได้เลย!</p>
                  </div>
                )}
                <div className="space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "model" && <UserCircle className="w-6 h-6 text-primary flex-shrink-0" />}
                      <div className={`p-3 rounded-lg max-w-[85%] shadow-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-none" : "bg-secondary text-secondary-foreground rounded-bl-none"}`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {isChatLoading && (
                  <div className="flex items-end gap-2 justify-start mt-4">
                    <UserCircle className="w-6 h-6 text-primary flex-shrink-0" />
                    <div className="p-3 rounded-lg bg-secondary rounded-bl-none shadow-sm">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
            <CardFooter>
              <form onSubmit={handleChatSubmit} className="flex w-full items-center space-x-2">
                <Textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="พิมพ์ข้อความของคุณ..."
                  className="flex-grow resize-none"
                  rows={1}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }}
                />
                <Button type="submit" size="icon" disabled={isChatLoading || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </CardFooter>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
          {/* Profile & BMI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Calculator className="w-6 h-6 text-primary" />
                โปรไฟล์และ BMI
              </CardTitle>
              <CardDescription>คำนวณดัชนีมวลกายและเป้าหมายแคลอรี่ของคุณ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="height">ส่วนสูง (ซม.)</Label>
                <Input id="height" type="number" placeholder="เช่น 165" value={height} onChange={(e) => setHeight(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">น้ำหนัก (กก.)</Label>
                <Input id="weight" type="number" placeholder="เช่น 55" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customCalorieGoal">เป้าหมายแคลอรี่ต่อวัน (ไม่บังคับ)</Label>
                <Input id="customCalorieGoal" type="number" placeholder="เช่น 2000" value={customCalorieGoal} onChange={(e) => setCustomCalorieGoal(e.target.value)} />
                <p className="text-xs text-muted-foreground">หากไม่กรอก ระบบจะคำนวณอัตโนมัติจากน้ำหนักและส่วนสูง</p>
              </div>
              <Button onClick={handleCalculateBmi} disabled={isCalculatingBmi} className="w-full">
                {isCalculatingBmi ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Calculator className="mr-2 h-4 w-4" />}
                คำนวณและบันทึก
              </Button>
            </CardContent>
            {userProfile.bmi && (
              <CardFooter className="flex flex-col items-start space-y-4 pt-4 border-t">
                <div className="w-full">
                  <h4 className="font-semibold text-muted-foreground">ดัชนีมวลกาย (BMI)</h4>
                  <p className={`text-3xl font-bold ${getBmiInterpretation(userProfile.bmi).color}`}>
                    {userProfile.bmi} <span className="text-lg font-normal">({getBmiInterpretation(userProfile.bmi).text})</span>
                  </p>
                </div>
                {userProfile.dailyCalorieGoal && (
                  <div className="w-full pt-2 border-t">
                    <h4 className="font-semibold text-muted-foreground">เป้าหมายแคลอรี่ต่อวัน</h4>
                    <p className="text-2xl font-bold text-primary">
                      {userProfile.dailyCalorieGoal.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span>
                    </p>
                  </div>
                )}
              </CardFooter>
            )}
          </Card>

          {/* Daily Overview */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">ภาพรวมวันนี้</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsWeeklyDialogOpen(true)}>
                    <AreaChart className="h-4 w-4 lg:mr-2" /><span className="hidden lg:inline">สัปดาห์</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsMonthlyDialogOpen(true)}>
                    <BarChartIcon className="h-4 w-4 lg:mr-2" /><span className="hidden lg:inline">เดือน</span>
                  </Button>
                </div>
              </div>
              <CardDescription>{formattedToday || <Skeleton className="h-5 w-32" />}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLogLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
              ) : (
                <>
                  <div>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-sm text-muted-foreground">แคลอรี่ที่บริโภค</span>
                      <span className="text-sm text-muted-foreground">เป้าหมาย: {userProfile.dailyCalorieGoal?.toLocaleString() || "N/A"} kcal</span>
                    </div>
                    <Progress value={calorieProgress} className="h-3" />
                    <div className="flex justify-between items-baseline mt-1">
                      <span className={`text-lg font-bold ${(dailyLog?.consumedCalories ?? 0) > (userProfile.dailyCalorieGoal ?? 9999) ? "text-destructive" : "text-accent"}`}>
                        {dailyLog?.consumedCalories.toLocaleString() ?? 0} kcal
                      </span>
                      <span className="text-sm font-semibold text-muted-foreground">{Math.round(calorieProgress)}%</span>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-md font-semibold mb-3">มื้อที่บันทึกแล้ว</h3>
                    {dailyLog?.meals && dailyLog.meals.length > 0 ? (
                      <Accordion type="single" collapsible className="w-full" defaultValue={mealPeriodOrder.find(p => groupedMeals[p]) ? `period-${mealPeriodOrder.find(p => groupedMeals[p])}` : undefined}>
                        {mealPeriodOrder.map(period => groupedMeals[period] && (
                          <AccordionItem value={`period-${period}`} key={period}>
                            <AccordionTrigger className="py-2">
                              <div className="flex justify-between w-full pr-4 items-center">
                                <span className="font-semibold">{period}</span>
                                <span className="text-sm text-muted-foreground">{groupedMeals[period].reduce((s, m) => s + m.calories, 0).toLocaleString()} kcal</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2">
                              <div className="pl-2 space-y-3 border-l-2 border-primary/50 ml-2">
                                {groupedMeals[period].map((meal, idx) => {
                                  const d = ensureDate(meal.timestamp);
                                  const timeStr = d ? d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "--:--";
                                  return (
                                    <div key={idx} className="flex justify-between items-center text-sm text-muted-foreground pl-4">
                                      <div className="flex-grow truncate pr-2">
                                        <p className="font-medium text-foreground truncate">{meal.name}</p>
                                        <p className="text-xs">{timeStr} น.</p>
                                      </div>
                                      <span className="font-medium whitespace-nowrap text-foreground/90">{meal.calories.toLocaleString()} kcal</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    ) : (
                      <div className="text-center text-muted-foreground py-10">
                        <p>ยังไม่มีการบันทึกมื้ออาหารสำหรับวันนี้</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex items-center justify-center">
              <p className="text-xs text-muted-foreground flex items-center">
                <Clock className="mr-1.5 h-3 w-3" />
                บันทึกข้อมูลในอีก: <span className="font-semibold ml-1 tabular-nums">{countdown}</span>
              </p>
            </CardFooter>
          </Card>

          {/* Weekly Dialog */}
          <Dialog open={isWeeklyDialogOpen} onOpenChange={setIsWeeklyDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>ภาพรวมแคลอรี่สัปดาห์นี้</DialogTitle>
                <DialogDescription>กราฟแสดงผลแคลอรี่ที่คุณบริโภคในสัปดาห์นี้</DialogDescription>
              </DialogHeader>
              {isWeeklyLoading ? (
                <div className="py-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
              ) : weeklyLogs.length > 0 ? (
                <div className="py-4 space-y-4">
                  <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                    <BarChart accessibilityLayer data={weeklyChartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                      <Bar dataKey="calories" fill="var(--color-calories)" radius={8} />
                    </BarChart>
                  </ChartContainer>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <Card className="p-4">
                      <CardHeader className="p-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">แคลอรี่รวม</CardTitle></CardHeader>
                      <CardContent className="p-0"><p className="text-2xl font-bold">{weeklyTotalCalories.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span></p></CardContent>
                    </Card>
                    <Card className="p-4">
                      <CardHeader className="p-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">เฉลี่ยต่อวัน</CardTitle></CardHeader>
                      <CardContent className="p-0"><p className="text-2xl font-bold">{weeklyAverageCalories.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span></p></CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-muted-foreground">ยังไม่มีข้อมูลสำหรับสัปดาห์นี้</p>
              )}
            </DialogContent>
          </Dialog>

          {/* Monthly Dialog */}
          <Dialog open={isMonthlyDialogOpen} onOpenChange={setIsMonthlyDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>ภาพรวมแคลอรี่เดือนนี้</DialogTitle>
                <DialogDescription>กราฟแสดงผลแคลอรี่ในเดือน {format(new Date(), "MMMM yyyy", { locale: th })}</DialogDescription>
              </DialogHeader>
              {isMonthlyLoading ? (
                <div className="py-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
              ) : monthlyLogs.length > 0 ? (
                <div className="py-4 space-y-4">
                  <ChartContainer config={chartConfig} className="min-h-[250px] w-full h-80">
                    <BarChart accessibilityLayer data={monthlyChartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                      <Bar dataKey="calories" fill="var(--color-calories)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <Card className="p-4">
                      <CardHeader className="p-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">แคลอรี่รวม</CardTitle></CardHeader>
                      <CardContent className="p-0"><p className="text-2xl font-bold">{monthlyTotalCalories.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span></p></CardContent>
                    </Card>
                    <Card className="p-4">
                      <CardHeader className="p-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">เฉลี่ยต่อวัน</CardTitle></CardHeader>
                      <CardContent className="p-0"><p className="text-2xl font-bold">{monthlyAverageCalories.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span></p></CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-muted-foreground">ยังไม่มีข้อมูลสำหรับเดือนนี้</p>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </main>

      <footer className="text-center py-8 mt-8 border-t">
        <p className="text-sm text-muted-foreground">MOMU SCAN — {currentUser.email}</p>
      </footer>
    </div>
  );
}

export default dynamic(
  () => Promise.resolve(FSFAPageFn as React.ComponentType),
  { ssr: false },
);
