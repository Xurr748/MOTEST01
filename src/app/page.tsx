"use client";

import dynamic from 'next/dynamic';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; 
import { 
  scanFoodImage, 
  type ScanFoodImageInput, 
  type ScanFoodImageOutput 
} from '@/ai/flows/food-image-analyzer';
import {
  chatWithBot,
  type ChatInput as AIChatInput, 
  type ChatOutput as AIChatOutput, 
  type ChatMessage
} from '@/ai/flows/post-scan-chat';
import { useAuth, useSupabase, useUser, useCollection } from '@/lib/supabase-hooks';
import { calculateBmiProfile } from '@/app/utils/bmiHelpers';
import { handleAuthError as helperHandleAuthError } from '@/app/utils/authHelpers';
import { logMeal as helperLogMeal, reloadDailyLog as helperReloadDailyLog } from '@/app/utils/mealHelpers';
import { calculateAndSaveDailySummary, calculateAndSaveWeeklySummary, calculateAndSaveMonthlySummary } from '@/lib/summary-helpers';

// date-fns for date calculations
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, format, isWithinInterval } from 'date-fns';
import { th } from 'date-fns/locale';

// Recharts for charts
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

// ShadCN UI Components
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
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
} from "@/components/ui/accordion"
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

// Lucide Icons
import { Camera, Brain, AlertCircle, CheckCircle, Info, UserCircle, LogIn, UserPlus, LogOut, Loader2, Send, MessageCircle, ScanLine, Flame, Calculator, PlusCircle, BookCheck, Clock, CalendarDays, BarChart as BarChartIcon, Wheat, Sparkles, Trash2, AreaChart, PieChart, UploadCloud, Database, RotateCw } from 'lucide-react';

const UNIDENTIFIED_FOOD_MESSAGE = "ไม่สามารถระบุชนิดอาหารได้";
const CHAT_HISTORY_LIMIT = 50;

// Helper to get the start of the current day in UTC
const getStartOfUTCDay = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

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
    date: Date;
    consumedCalories: number;
    meals: Meal[];
}

interface ChatSession {
    userId: string;
    createdAt: Date;
    messages: ChatMessage[];
}

interface FoodItem {
  id: string;
  name: string;
  calories: number;
}

const safeJsonParse = (item: string | null): any => {
  if (!item) return null;
  try {
    return JSON.parse(item);
  } catch (e) {
    console.error("Failed to parse JSON from localStorage", e);
    return null;
  }
};

function FSFAPageFn() {
  // ============================================================================
  // STATE DECLARATIONS (All at top of component)
  // ============================================================================
  
  // Auth-related state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authDialogMode, setAuthDialogMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAuthOpLoading, setIsAuthOpLoading] = useState(false);
  const [showUnauthWarning, setShowUnauthWarning] = useState(false);
  const [hasShownUnauthWarning, setHasShownUnauthWarning] = useState(false);

  // User profile and logging state
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [customCalorieGoal, setCustomCalorieGoal] = useState('');
  const [isCalculatingBmi, setIsCalculatingBmi] = useState(false);
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [dailyLogId, setDailyLogId] = useState<string | null>(null);

  // Image analysis state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageAnalysisResult, setImageAnalysisResult] = useState<ScanFoodImageOutput | null>(null);
  const [isLoadingImageAnalysis, setIsLoadingImageAnalysis] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Meal logging state
  const [isLoggingMeal, setIsLoggingMeal] = useState(false);
  const [pendingMeal, setPendingMeal] = useState<Meal | null>(null);
  const [isCalorieExceedOpen, setIsCalorieExceedOpen] = useState(false);
  const [exceedAmount, setExceedAmount] = useState(0);
  const [isFoodDbOpen, setIsFoodDbOpen] = useState(false);
  const [foodSearchTerm, setFoodSearchTerm] = useState('');
  const [isLoadingFoods, setIsLoadingFoods] = useState(false);
  const [databaseFoods, setDatabaseFoods] = useState<FoodItem[]>([
    { id: '1', name: 'ข้าวสวย', calories: 206 },
    { id: '2', name: 'ไก่ทอด', calories: 320 },
    { id: '3', name: 'ไข่ขาว', calories: 17 },
    { id: '4', name: 'นมวัว', calories: 61 },
    { id: '5', name: 'กล้วย', calories: 89 },
  ]);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);

  // Weekly/Monthly logs state
  const [weeklyLogs, setWeeklyLogs] = useState<DailyLog[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<DailyLog[]>([]);
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);
  const [isWeeklyDialogOpen, setIsWeeklyDialogOpen] = useState(false);
  const [isMonthlyDialogOpen, setIsMonthlyDialogOpen] = useState(false);

  // UI state
  const [countdown, setCountdown] = useState('00:00:00');
  const [formattedToday, setFormattedToday] = useState('');

  // Refs
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);

  // Get toast hook
  const { toast } = useToast();

  // Auth functions (local-only implementations)
  const signIn = async (email: string, password: string) => {
    // Local-only login: just mark as logged in
    setCurrentUser({ email, is_anonymous: false });
  };

  const signUp = async (email: string, password: string) => {
    // Local-only signup: just mark as logged in
    setCurrentUser({ email, is_anonymous: false });
  };

  const authSignOut = async () => {
    // Local-only logout
    setCurrentUser(null);
    resetState();
  };

  const resetState = () => {
    setUserProfile({});
    setHeight('');
    setWeight('');
    setCustomCalorieGoal('');
    setDailyLog(null);
    setDailyLogId(null);
    setChatMessages([]);
    setChatId(null);
  };

  // ============================================================================
  // HANDLERS & COMPUTED VALUES (After all state)
  // ============================================================================

  const openAuthDialog = (mode: 'login' | 'register') => {
    setAuthDialogMode(mode);
    setAuthDialogOpen(true);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setIsAuthOpLoading(false);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      toast({ title: "ข้อมูลไม่ครบถ้วน", description: "โปรดกรอกอีเมลและรหัสผ่าน", variant: "destructive" });
      return;
    }
    setIsAuthOpLoading(true);
    try {
      await signIn(email, password);
      toast({ title: "เข้าสู่ระบบสำเร็จ" });
      setAuthDialogOpen(false);
    } catch (e: any) {
      helperHandleAuthError(e, authDialogMode, toast);
    } finally {
      setIsAuthOpLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "ลงทะเบียนไม่สำเร็จ", description: "รหัสผ่านไม่ตรงกัน", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "ลงทะเบียนไม่สำเร็จ", description: "รหัสผ่านต้องมี 6 ตัวอักษรขึ้นไป", variant: "destructive" });
      return;
    }
    setIsAuthOpLoading(true);
    try {
      await signUp(email, password);
      toast({ title: "สมัครสมาชิกสำเร็จ" });
      setAuthDialogOpen(false);
    } catch (e: any) {
      helperHandleAuthError(e, authDialogMode, toast);
    } finally {
      setIsAuthOpLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!authSignOut) return;
    try {
      await authSignOut();
      toast({
        title: "ออกจากระบบสำเร็จ",
        description: "คุณออกจากระบบแล้ว",
      });
    } catch (error: unknown) {
      console.error("Logout error:", error);
      toast({ title: "เกิดข้อผิดพลาดในการออกจากระบบ", variant: "destructive" });
    }
  };

  const resetImageRelatedStates = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageAnalysisResult(null);
    setImageError(null);
    localStorage.removeItem('previewUrl');
    localStorage.removeItem('imageAnalysisResult');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      resetImageRelatedStates(); 
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageAnalysis = async () => {
    if (!selectedFile) {
      setImageError('โปรดเลือกไฟล์รูปภาพก่อน');
      return;
    }
    setIsLoadingImageAnalysis(true);
    setImageError(null);
    
    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = async () => {
      const foodImage = reader.result as string;
      try {
        const result = await scanFoodImage({ foodImage } as ScanFoodImageInput);
        setImageAnalysisResult(result); 
        
        toast({
          title: "การวิเคราะห์เสร็จสมบูรณ์",
          description: result.foodItem === UNIDENTIFIED_FOOD_MESSAGE 
            ? "ไม่สามารถระบุรายการอาหารได้ โปรดลองภาพอื่น" 
            : `ระบุได้ว่าเป็น: ${result.foodItem}`,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'วิเคราะห์รูปภาพไม่สำเร็จ โปรดลองอีกครั้ง';
        setImageError(errorMessage);
        setImageAnalysisResult(null); 
        toast({
          title: "เกิดข้อผิดพลาดในการวิเคราะห์",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsLoadingImageAnalysis(false);
      }
    };
    reader.onerror = () => {
      setImageError('ไม่สามารถอ่านไฟล์รูปภาพที่เลือก');
      setIsLoadingImageAnalysis(false);
      setImageAnalysisResult(null); 
      toast({ title: "ข้อผิดพลาดในการอ่านไฟล์", variant: "destructive" });
    };
  };

  const ensureDate = (dateInput: string | Date | undefined): Date | undefined => {
    if (!dateInput) return undefined;
    if (dateInput instanceof Date) return dateInput;
    return new Date(dateInput);
  };

  const getMealPeriod = (date: Date | string | undefined): string => {
    if (!date) return 'ไม่ทราบ';
    const dateObj = ensureDate(date);
    if (!dateObj || isNaN(dateObj.getTime())) return 'ไม่ทราบ';
    const hour = dateObj.getHours();
    if (hour >= 6 && hour < 9) return 'เช้า';
    if (hour >= 9 && hour < 12) return 'สาย';
    if (hour >= 12 && hour < 14) return 'เที่ยง';
    if (hour >= 14 && hour < 17) return 'บ่าย';
    if (hour >= 17 && hour < 20) return 'เย็น';
    if (hour >= 20 && hour < 23) return 'ค่ำ';
    return 'ดึก';
  };

  const groupedMeals = useMemo(() => {
    if (!dailyLog?.meals) return {};
    return dailyLog.meals.reduce((acc: Record<string, Meal[]>, meal: Meal) => {
      const mealDate = meal.timestamp;
      const period = getMealPeriod(mealDate);
      if (!acc[period]) {
        acc[period] = [];
      }
      acc[period].push(meal);
      acc[period].sort((a, b) => {
        const dateA = ensureDate(a.timestamp);
        const dateB = ensureDate(b.timestamp);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      });
      return acc;
    }, {} as Record<string, Meal[]>);
  }, [dailyLog]);

  const mealPeriodOrder = ['เช้า', 'สาย', 'เที่ยง', 'บ่าย', 'เย็น', 'ค่ำ', 'ดึก'];

  const filteredFoods = useMemo(() => {
    if (!foodSearchTerm) return databaseFoods;
    return databaseFoods.filter((food: FoodItem) => 
      food.name.toLowerCase().includes(foodSearchTerm.toLowerCase())
    );
  }, [databaseFoods, foodSearchTerm]);

  const chartConfig = {
    calories: { label: "แคลอรี่", color: "hsl(var(--chart-1))" },
  } satisfies ChartConfig;

  const calorieProgress = useMemo(() => {
    const goal = userProfile.dailyCalorieGoal;
    const consumed = dailyLog?.consumedCalories || 0;
    if (!goal || goal === 0) return 0;
    return Math.min((consumed / goal) * 100, 100);
  }, [userProfile.dailyCalorieGoal, dailyLog?.consumedCalories]);

  const weeklyChartData = useMemo(() => {
    if (!weeklyLogs) return [];
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
    return daysInWeek.map(day => {
      const logForDay = weeklyLogs.find(log => format(new Date(log.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
      return {
        name: format(day, 'E', { locale: th }),
        calories: logForDay ? logForDay.consumedCalories : 0,
      };
    });
  }, [weeklyLogs]);

  const monthlyChartData = useMemo(() => {
    if (!monthlyLogs) return [];
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return daysInMonth.map(day => {
      const logForDay = monthlyLogs.find(log => {
        const logDate = format(new Date(log.date), 'yyyy-MM-dd');
        const currentDay = format(day, 'yyyy-MM-dd');
        return logDate === currentDay;
      });
      return {
        name: format(day, 'd'),
        calories: logForDay ? logForDay.consumedCalories : 0,
      };
    });
  }, [monthlyLogs]);

  const weeklyTotalCalories = useMemo(() => weeklyLogs?.reduce((sum, log) => sum + log.consumedCalories, 0) || 0, [weeklyLogs]);
  const weeklyAverageCalories = useMemo(() => (weeklyLogs && weeklyLogs.length > 0) ? Math.round(weeklyTotalCalories / weeklyLogs.length) : 0, [weeklyLogs, weeklyTotalCalories]);
  const monthlyTotalCalories = useMemo(() => monthlyLogs?.reduce((sum, log) => sum + log.consumedCalories, 0) || 0, [monthlyLogs]);
  const monthlyAverageCalories = useMemo(() => (monthlyLogs && monthlyLogs.length > 0) ? Math.round(monthlyTotalCalories / monthlyLogs.length) : 0, [monthlyLogs, monthlyTotalCalories]);

  const getBmiInterpretation = (bmi: number | undefined): {text: string, color: string} => {
    if (bmi === undefined) return {text: 'N/A', color: 'text-muted-foreground'};
    if (bmi < 18.5) return { text: 'ผอม', color: 'text-blue-500' };
    if (bmi < 23) return { text: 'สมส่วน', color: 'text-green-500' };
    if (bmi < 25) return { text: 'ท้วม', color: 'text-yellow-500' };
    if (bmi < 30) return { text: 'อ้วนระดับ 1', color: 'text-orange-500' };
    return { text: 'อ้วนระดับ 2 (อันตราย)', color: 'text-red-500' };
  };

  const isFoodIdentified = imageAnalysisResult?.foodItem !== UNIDENTIFIED_FOOD_MESSAGE;

  const handleLogMealFromDatabase = async (food: FoodItem) => {
    if (isLoggingMeal) return;
    setIsLoggingMeal(true);
    try {
      const newMeal: Meal = {
        name: food.name,
        calories: food.calories,
        timestamp: new Date(),
      };
      const currentConsumed = dailyLog?.consumedCalories ?? 0;
      const goal = userProfile.dailyCalorieGoal ?? 0;
      if (goal > 0 && currentConsumed + food.calories > goal) {
        const exceed = currentConsumed + food.calories - goal;
        setExceedAmount(exceed);
        setPendingMeal(newMeal);
        setIsCalorieExceedOpen(true);
        setIsLoggingMeal(false);
        return;
      }
      let meals = dailyLog?.meals ? [...dailyLog.meals] : [];
      meals.push(newMeal);
      const logDate = dailyLog?.date instanceof Date ? dailyLog.date : new Date();
      const newLog = {
        ...dailyLog,
        meals,
        consumedCalories: (dailyLog?.consumedCalories ?? 0) + food.calories,
        date: logDate,
      };
      setDailyLog(newLog);
      localStorage.setItem('dailyLog', JSON.stringify(newLog));
      if (currentUser) {
        toast({ title: `เพิ่ม '${food.name}' สำเร็จ!`, description: "บันทึกมื้ออาหารของคุณแล้ว" });
      } else {
        toast({ title: `เพิ่ม '${food.name}' สำเร็จ!`, description: "ข้อมูลจะถูกบันทึกเมื่อคุณเข้าสู่ระบบ" });
      }
      setIsFoodDbOpen(false);
    } catch (error) {
      console.error("Error logging meal from database:", error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึกมื้ออาหารได้", variant: "destructive" });
    } finally {
      setIsLoggingMeal(false);
    }
  };

  const handleConfirmLogMealExceed = async () => {
    if (!pendingMeal) return;
    setIsLoggingMeal(true);
    setIsCalorieExceedOpen(false);
    try {
      let meals = dailyLog?.meals ? [...dailyLog.meals] : [];
      meals.push(pendingMeal);
      const logDate = dailyLog?.date instanceof Date ? dailyLog.date : new Date();
      const newLog = {
        ...dailyLog,
        meals,
        consumedCalories: (dailyLog?.consumedCalories ?? 0) + pendingMeal.calories,
        date: logDate,
      };
      setDailyLog(newLog);
      localStorage.setItem('dailyLog', JSON.stringify(newLog));
      toast({ title: "บันทึกมื้ออาหารสำเร็จ!" });
    } catch (error) {
      console.error("Error logging meal:", error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึกมื้ออาหารได้", variant: "destructive" });
    } finally {
      setIsLoggingMeal(false);
      setPendingMeal(null);
      setExceedAmount(0);
    }
  };

  const handleLogMeal = async () => {
    if (!currentUser && !hasShownUnauthWarning) {
      setShowUnauthWarning(true);
      setHasShownUnauthWarning(true);
      return;
    }
    
    setIsLoggingMeal(true);
    try {
      if (!imageAnalysisResult || !imageAnalysisResult.nutritionalInformation) {
        toast({ title: "ไม่มีข้อมูลการวิเคราะห์", description: "โปรดวิเคราะห์รูปภาพก่อนบันทึก", variant: "destructive" });
        setIsLoggingMeal(false);
        return;
      }
      const mealName = imageAnalysisResult.foodItem;
      const mealCalories = imageAnalysisResult.nutritionalInformation.estimatedCalories ?? 0;
      const currentConsumed = dailyLog?.consumedCalories ?? 0;
      const goal = userProfile.dailyCalorieGoal ?? 0;
      if (goal > 0 && currentConsumed + mealCalories > goal) {
        const exceed = currentConsumed + mealCalories - goal;
        setExceedAmount(exceed);
        setPendingMeal({
          name: mealName,
          calories: mealCalories,
          timestamp: new Date(),
        });
        setIsCalorieExceedOpen(true);
        setIsLoggingMeal(false);
        return;
      }
      let meals = dailyLog?.meals ? [...dailyLog.meals] : [];
      meals.push({ name: mealName, calories: mealCalories, timestamp: new Date() });
      const logDate = dailyLog?.date instanceof Date ? dailyLog.date : new Date();
      const newLog = {
        ...dailyLog,
        meals,
        consumedCalories: (dailyLog?.consumedCalories ?? 0) + mealCalories,
        date: logDate,
      };
      setDailyLog(newLog);
      localStorage.setItem('dailyLog', JSON.stringify(newLog));
      toast({ title: "บันทึกมื้ออาหารสำเร็จ!" });
    } catch (error) {
      console.error("Error logging meal:", error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึกมื้ออาหารได้", variant: "destructive" });
    } finally {
      setIsLoggingMeal(false);
    }
  };

  const handleChatSubmit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    const messageContent = chatInput.trim();
    if (!messageContent) return;
    
    if (!currentUser && !hasShownUnauthWarning) {
      setShowUnauthWarning(true);
      setHasShownUnauthWarning(true);
      return;
    }

    const newUserMessage: ChatMessage = { role: 'user', content: messageContent };
    const newMessagesWithUser = [...chatMessages, newUserMessage];
    setChatMessages(newMessagesWithUser);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const result: AIChatOutput = await chatWithBot({ message: messageContent, history: chatMessages.slice(-5) });
      const newBotMessage: ChatMessage = { role: 'model', content: result.response };
      
      let finalMessages = [...newMessagesWithUser, newBotMessage];

      if (finalMessages.length > CHAT_HISTORY_LIMIT) {
        finalMessages = finalMessages.slice(finalMessages.length - CHAT_HISTORY_LIMIT);
      }

      setChatMessages(finalMessages);
      localStorage.setItem('chatMessages', JSON.stringify(finalMessages));
    } catch (error) {
      console.error("Error in chatWithBot:", error);
      const errorMessage: ChatMessage = { role: 'model', content: "ขออภัยค่ะ มีปัญหาในการเชื่อมต่อกับ AI โปรดลองอีกครั้ง" };
      setChatMessages(prev => [...prev, errorMessage]);
      toast({ title: "Chatbot Error", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
      if(chatInputRef.current) chatInputRef.current.focus();
    }
  };

  const handleCalculateBmi = async () => {
    const profile = calculateBmiProfile(height, weight);
    if (!profile) {
      toast({ title: "ข้อมูลไม่ถูกต้อง", description: "โปรดกรอกส่วนสูงและน้ำหนักให้ถูกต้อง", variant: "destructive"});
      return;
    }

    const customGoal = parseFloat(customCalorieGoal);
    if (!isNaN(customGoal) && customGoal > 0) {
      profile.dailyCalorieGoal = customGoal;
    }

    setIsCalculatingBmi(true);
    setUserProfile(profile);
    localStorage.setItem('userProfile', JSON.stringify(profile));
    toast({ title: "คำนวณสำเร็จ (โหมดออฟไลน์)", description: `BMI ของคุณคือ ${profile.bmi}` });
    setIsCalculatingBmi(false);
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initialize on mount
  useEffect(() => {
    const cached = localStorage.getItem('userProfile');
    if (cached) {
      try {
        const profile = JSON.parse(cached);
        setUserProfile(profile);
        setHeight(String(profile.height || ''));
        setWeight(String(profile.weight || ''));
      } catch (e) { console.error('failed parsing cached profile', e); }
    }
    const cachedLog = localStorage.getItem('dailyLog');
    if (cachedLog) {
      try {
        const parsedLog = JSON.parse(cachedLog);
        if (parsedLog) {
          // Convert date strings back to Date objects
          const convertedLog = {
            ...parsedLog,
            date: parsedLog.date ? new Date(parsedLog.date) : new Date(),
            meals: (parsedLog.meals || []).map((meal: any) => ({
              ...meal,
              timestamp: meal.timestamp ? new Date(meal.timestamp) : new Date(),
            })),
          };
          setDailyLog(convertedLog);
        }
      } catch (e) { setDailyLog(null); }
    }
    const cachedChat = localStorage.getItem('chatMessages');
    if (cachedChat) {
      try {
        setChatMessages(JSON.parse(cachedChat));
      } catch (e) { setChatMessages([]); }
    }
  }, []);

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
      setCountdown(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setFormattedToday(format(new Date(), 'd MMMM yyyy', { locale: th }));
  }, []);

  useEffect(() => {
    if (!isAuthLoading && !currentUser && !showUnauthWarning && !hasShownUnauthWarning) {
      setTimeout(() => {
        setShowUnauthWarning(true);
        setHasShownUnauthWarning(true);
      }, 1000);
    }
  }, [isAuthLoading, currentUser, showUnauthWarning, hasShownUnauthWarning]);

  useEffect(() => {
    const savedAnalysisResult = safeJsonParse(localStorage.getItem('imageAnalysisResult'));
    if (savedAnalysisResult) setImageAnalysisResult(savedAnalysisResult);
    const savedPreviewUrl = localStorage.getItem('previewUrl');
    if (savedPreviewUrl) setPreviewUrl(savedPreviewUrl);
  }, []);

  useEffect(() => {
    if (imageAnalysisResult) localStorage.setItem('imageAnalysisResult', JSON.stringify(imageAnalysisResult));
  }, [imageAnalysisResult]);

  useEffect(() => {
    if (previewUrl) localStorage.setItem('previewUrl', previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (chatScrollAreaRef.current) {
      chatScrollAreaRef.current.scrollTop = chatScrollAreaRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('userProfile', JSON.stringify(userProfile || {}));
    } else {
      localStorage.removeItem('userProfile');
    }
  }, [currentUser, userProfile]);

  useEffect(() => {
    const fetchWeeklyLogs = () => {
      setIsWeeklyLoading(true);
      try {
        const logsRaw = localStorage.getItem('allDailyLogs');
        let allLogs: DailyLog[] = [];
        if (logsRaw) {
          allLogs = JSON.parse(logsRaw).map((log: any) => ({
            ...log,
            date: log.date ? new Date(log.date) : undefined,
            meals: (log.meals || []).map((meal: any) => ({
              ...meal,
              timestamp: meal.timestamp ? new Date(meal.timestamp) : new Date(),
            })),
          }));
        }
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
        const weekLogs = allLogs.filter(log => {
          if (!log.date) return false;
          const d = new Date(log.date);
          return d >= weekStart && d <= weekEnd;
        });
        setWeeklyLogs(weekLogs);
      } catch (error) {
        console.error("Error fetching weekly logs:", error);
        toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดข้อมูลรายสัปดาห์ได้", variant: "destructive" });
        setWeeklyLogs([]);
      } finally {
        setIsWeeklyLoading(false);
      }
    };
    if (isWeeklyDialogOpen) {
      fetchWeeklyLogs();
    }
  }, [isWeeklyDialogOpen, toast]);

  useEffect(() => {
    const fetchMonthlyLogs = () => {
      setIsMonthlyLoading(true);
      try {
        const logsRaw = localStorage.getItem('allDailyLogs');
        let allLogs: DailyLog[] = [];
        if (logsRaw) {
          allLogs = JSON.parse(logsRaw).map((log: any) => ({
            ...log,
            date: log.date ? new Date(log.date) : undefined,
            meals: (log.meals || []).map((meal: any) => ({
              ...meal,
              timestamp: meal.timestamp ? new Date(meal.timestamp) : new Date(),
            })),
          }));
        }
        const today = new Date();
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);
        const monthLogs = allLogs.filter(log => {
          if (!log.date) return false;
          const d = new Date(log.date);
          return d >= monthStart && d <= monthEnd;
        });
        setMonthlyLogs(monthLogs);
      } catch (error) {
        console.error("Error fetching monthly logs:", error);
        toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดข้อมูลรายเดือนได้", variant: "destructive" });
        setMonthlyLogs([]);
      } finally {
        setIsMonthlyLoading(false);
      }
    };
    if (isMonthlyDialogOpen) {
      fetchMonthlyLogs();
    }
  }, [isMonthlyDialogOpen, toast]);

  // ============================================================================
  // RENDER
  // ============================================================================

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
                <DropdownMenuLabel>
                  {currentUser && !currentUser.is_anonymous ? "บัญชีของฉัน" : "บัญชี"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAuthLoading ? (
                  <DropdownMenuItem disabled><Loader2 className="animate-spin mr-2"/>กำลังโหลด...</DropdownMenuItem>
                ) : currentUser && !currentUser.is_anonymous ? (
                  <>
                    <DropdownMenuItem disabled>
                      <span className="truncate">{currentUser.email}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>ออกจากระบบ</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem disabled>
                      <span className="italic">โหมดไม่ระบุตัวตน</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => openAuthDialog('login')} className="cursor-pointer">
                      <LogIn className="mr-2 h-4 w-4" />
                      <span>เข้าสู่ระบบ</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openAuthDialog('register')} className="cursor-pointer">
                      <UserPlus className="mr-2 h-4 w-4" />
                      <span>ลงทะเบียน</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Auth Dialog */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              {authDialogMode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชีใหม่'}
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              {authDialogMode === 'login' ? 'ยินดีต้อนรับกลับสู่ MOMU SCAN!' : 'กรอกข้อมูลเพื่อเริ่มต้นใช้งาน'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={authDialogMode === 'login' ? handleLogin : handleRegister} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="auth-email">อีเมล</Label>
              <Input id="auth-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">รหัสผ่าน</Label>
              <Input id="auth-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {authDialogMode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="auth-confirmPassword">ยืนยันรหัสผ่าน</Label>
                <Input id="auth-confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={isAuthOpLoading}>
              {isAuthOpLoading ? <Loader2 className="animate-spin mr-2"/> : (authDialogMode === 'login' ? <LogIn className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />) }
              {authDialogMode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}
            </Button>
          </form>
          <DialogFooter className="pt-4">
            <p className="text-sm text-muted-foreground text-center w-full">
              {authDialogMode === 'login' ? 'ยังไม่มีบัญชี?' : 'มีบัญชีอยู่แล้ว?'}
              <Button variant="link" onClick={() => setAuthDialogMode(authDialogMode === 'login' ? 'register' : 'login')} className="p-1">
                {authDialogMode === 'login' ? 'ลงทะเบียน' : 'เข้าสู่ระบบ'}
              </Button>
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unauthenticated User Warning Modal */}
      <Dialog open={showUnauthWarning} onOpenChange={setShowUnauthWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              ข้อความเตือน
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              คุณยังไม่ได้เข้าสู่ระบบ ข้อมูลที่คุณบันทึกในปัจจุบันจะถูกเก็บไว้ในเครื่องเท่านั้น
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>หลังจากออกจากเบราว์เซอร์ ข้อมูลของคุณจะหายไป</strong>
            </p>
            <p className="text-sm text-foreground font-medium">
              โปรดทำการเข้าสู่ระบบหรือสมัครสมาชิกเพื่อบันทึกข้อมูลอย่างถาวร
            </p>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowUnauthWarning(false)}>
              ปิด
            </Button>
            <Button onClick={() => {
              setShowUnauthWarning(false);
              openAuthDialog('register');
            }}>
              <UserPlus className="w-4 h-4 mr-2" />
              สมัครสมาชิก
            </Button>
            <Button variant="outline" onClick={() => {
              setShowUnauthWarning(false);
              openAuthDialog('login');
            }}>
              <LogIn className="w-4 h-4 mr-2" />
              เข้าสู่ระบบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Food DB Dialog */}
      <Dialog open={isFoodDbOpen} onOpenChange={setIsFoodDbOpen}>
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
                  {filteredFoods && filteredFoods.length > 0 ? filteredFoods.map(food => (
                    <Card key={food.id} className="flex items-center p-3">
                      <div className="flex-grow">
                        <p className="font-semibold">{food.name}</p>
                        <p className="text-sm text-muted-foreground">{food.calories.toLocaleString()} kcal</p>
                      </div>
                      <Button size="sm" onClick={() => handleLogMealFromDatabase(food)} disabled={isLoggingMeal}>
                        {isLoggingMeal ? <Loader2 className="w-4 h-4 animate-spin"/> : 'เพิ่ม'}
                      </Button>
                    </Card>
                  )) : (
                    <p className="text-center text-muted-foreground pt-10">ไม่พบรายการอาหารที่ตรงกัน</p>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Calorie Exceed Warning Dialog */}
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
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              เป้าหมายแคลอรี่ต่อวัน: {userProfile.dailyCalorieGoal?.toLocaleString()} kcal
            </p>
            <p className="text-sm text-muted-foreground">
              แคลอรี่ปัจจุบัน: {(dailyLog?.consumedCalories ?? 0).toLocaleString()} kcal
            </p>
            <p className="text-sm text-muted-foreground">
              แคลอรี่ที่จะเพิ่ม: {pendingMeal?.calories.toLocaleString()} kcal
            </p>
            <p className="text-sm font-medium">
              รวมทั้งสิ้น: {((dailyLog?.consumedCalories ?? 0) + (pendingMeal?.calories ?? 0)).toLocaleString()} kcal
            </p>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => {
              setIsCalorieExceedOpen(false);
              setPendingMeal(null);
              setExceedAmount(0);
            }}>
              ยกเลิก
            </Button>
            <Button onClick={handleConfirmLogMealExceed} disabled={isLoggingMeal}>
              {isLoggingMeal ? <Loader2 className="animate-spin mr-2" /> : null}
              บันทึกเพิ่ม
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="container mx-auto grid grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-5 lg:px-8">
        <div className="lg:col-span-3 space-y-8">
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
                  <input
                    id="food-image-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  <Label
                    htmlFor="food-image-upload"
                    className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center text-center pt-5 pb-6">
                      <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-primary">คลิกเพื่ออัปโหลด</span> หรือลากไฟล์มาวาง
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG (สูงสุด 5MB)
                      </p>
                    </div>
                  </Label>
                </div>
              ) : (
                <div className="relative group w-full aspect-video rounded-lg overflow-hidden border-2 border-dashed flex items-center justify-center bg-muted/50">
                  <Image src={previewUrl} alt="Food preview" fill className="object-contain p-2" data-ai-hint="food meal" />
                  <Button variant="destructive" size="icon" className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={resetImageRelatedStates}>
                    <Trash2 className="w-4 h-4"/>
                    <span className="sr-only">ลบรูปภาพ</span>
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleImageAnalysis} disabled={isLoadingImageAnalysis || !previewUrl} className="w-full" size="lg">
                {isLoadingImageAnalysis ? (
                  <><Loader2 className="animate-spin mr-2 h-5 w-5" />กำลังวิเคราะห์...</>
                ) : (
                  <> <Sparkles className="mr-2 h-5 w-5" /> วิเคราะห์รูปภาพ </>
                )}
              </Button>
              <Button variant="secondary" className="w-full" size="lg" onClick={() => setIsFoodDbOpen(true)}>
                <Database className="mr-2 h-5 w-5" /> เลือกจากรายการอาหาร
              </Button>
            </CardFooter>
          </Card>

          {isLoadingImageAnalysis && (
            <Card>
              <CardHeader>
                <Skeleton className="h-7 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-16 w-full" />
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
                    {imageAnalysisResult.cuisineType && imageAnalysisResult.cuisineType !== 'ไม่สามารถระบุประเภทได้' && (
                      <Badge variant="outline">{imageAnalysisResult.cuisineType}</Badge>
                    )}
                  </div>
                </div>
                
                <>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-foreground flex items-center gap-2 mb-2"><Flame className="w-5 h-5 text-orange-500" />แคลอรี่โดยประมาณ</h4>
                      <p className="text-2xl font-bold">{(imageAnalysisResult.nutritionalInformation.estimatedCalories ?? 0) > 0 ? imageAnalysisResult.nutritionalInformation.estimatedCalories.toLocaleString() : 'N/A'} <span className="text-sm font-normal text-muted-foreground">kcal</span></p>
                      {imageAnalysisResult.nutritionalInformation.reasoning && <p className="text-xs text-muted-foreground mt-1">{imageAnalysisResult.nutritionalInformation.reasoning}</p>}
                    </div>
                    {imageAnalysisResult.nutritionalInformation.visibleIngredients && imageAnalysisResult.nutritionalInformation.visibleIngredients.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-foreground flex items-center gap-2 mb-2"><Wheat className="w-5 h-5 text-yellow-600" />ส่วนผสมที่พบ</h4>
                        <div className="flex flex-wrap gap-2">
                          {imageAnalysisResult.nutritionalInformation.visibleIngredients.map((ingredient, index) => (
                            <Badge key={index} variant="secondary">{ingredient}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              </CardContent>
              {isFoodIdentified && (
                <CardFooter>
                  <Button size="lg" onClick={handleLogMeal} disabled={isLoggingMeal || (imageAnalysisResult.nutritionalInformation.estimatedCalories ?? 0) <= 0} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                    {isLoggingMeal ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2"/>}
                    เพิ่มในบันทึกแคลอรี่
                  </Button>
                </CardFooter>
              )}
            </Card>
          )}

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
                    <Brain className="w-12 h-12 mb-4"/>
                    <p className="text-lg font-medium">เริ่มต้นการสนทนา</p>
                    <p className="text-sm">ถามคำถามเกี่ยวกับอาหารที่สแกนได้เลย!</p>
                  </div>
                )}
                <div className="space-y-4">
                  {chatMessages.map((msg, index) => (
                    <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'model' && <UserCircle className="w-6 h-6 text-primary flex-shrink-0"/>}
                      <div className={`p-3 rounded-lg max-w-[85%] shadow-sm ${ msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-secondary text-secondary-foreground rounded-bl-none'}`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {isChatLoading && (
                  <div className="flex items-end gap-2 justify-start mt-4">
                    <UserCircle className="w-6 h-6 text-primary flex-shrink-0"/>
                    <div className="p-3 rounded-lg bg-secondary text-secondary-foreground rounded-bl-none shadow-sm">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
            <CardFooter>
              <form onSubmit={handleChatSubmit} className="flex w-full items-center space-x-2">
                <Textarea ref={chatInputRef} value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="พิมพ์ข้อความของคุณ..." className="flex-grow resize-none" rows={1} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }} />
                <Button type="submit" size="icon" className="flex-shrink-0" disabled={isChatLoading || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Send</span>
                </Button>
              </form>
            </CardFooter>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Calculator className="w-6 h-6 text-primary"/>โปรไฟล์และ BMI</CardTitle>
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
                  <p className={`text-3xl font-bold ${getBmiInterpretation(userProfile.bmi).color}`}>{userProfile.bmi} <span className="text-lg font-normal">({getBmiInterpretation(userProfile.bmi).text})</span></p>
                </div>
                {userProfile.dailyCalorieGoal && (
                  <div className="w-full pt-2 border-t">
                    <h4 className="font-semibold text-muted-foreground">เป้าหมายแคลอรี่ต่อวัน</h4>
                    <p className="text-2xl font-bold text-primary">{userProfile.dailyCalorieGoal.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span></p>
                  </div>
                )}
              </CardFooter>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">ภาพรวมวันนี้</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsWeeklyDialogOpen(true)}><AreaChart className="h-4 w-4 lg:mr-2"/> <span className="hidden lg:inline">สัปดาห์</span></Button>
                  <Button variant="outline" size="sm" onClick={() => setIsMonthlyDialogOpen(true)}><BarChartIcon className="h-4 w-4 lg:mr-2"/> <span className="hidden lg:inline">เดือน</span></Button>
                </div>
              </div>
              <CardDescription>{formattedToday || <Skeleton className="h-5 w-32" />}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm text-muted-foreground">แคลอรี่ที่บริโภค</span>
                  <span className="text-sm text-muted-foreground">เป้าหมาย: {userProfile.dailyCalorieGoal?.toLocaleString() || 'N/A'} kcal</span>
                </div>
                <Progress value={calorieProgress} className="h-3" />
                <div className="flex justify-between items-baseline mt-1">
                  <span className={`text-lg font-bold ${(dailyLog?.consumedCalories ?? 0) > (userProfile.dailyCalorieGoal ?? 9999) ? 'text-destructive' : 'text-accent'}`}>{dailyLog?.consumedCalories.toLocaleString() ?? 0} kcal</span>
                  <span className="text-sm font-semibold text-muted-foreground">{Math.round(calorieProgress)}%</span>
                </div>
              </div>
              
              <Separator/>

              <div>
                <h3 className="text-md font-semibold mb-3">มื้อที่บันทึกแล้ว</h3>
                {dailyLog && dailyLog.meals && dailyLog.meals.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full" defaultValue={mealPeriodOrder.find(p => groupedMeals[p]) ? `period-${mealPeriodOrder.find(p => groupedMeals[p])}`: undefined}>
                    {mealPeriodOrder.map(period => (
                      groupedMeals[period] && (
                      <AccordionItem value={`period-${period}`} key={period}>
                        <AccordionTrigger className="py-2">
                          <div className="flex justify-between w-full pr-4 items-center">
                            <span className="font-semibold">{period}</span>
                            <span className="text-sm text-muted-foreground">{groupedMeals[period].reduce((sum, meal) => sum + meal.calories, 0).toLocaleString()} kcal</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2">
                          <div className="pl-2 space-y-3 border-l-2 border-primary/50 ml-2">
                            {groupedMeals[period].map((meal, index) => {
                              const mealDate = ensureDate(meal.timestamp);
                              const timeStr = mealDate ? mealDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                              return (
                              <div key={index} className="flex justify-between items-center text-sm text-muted-foreground pl-4">
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
                      )
                    ))}
                  </Accordion>
                ) : (
                  <div className="text-center text-muted-foreground py-10">
                    <p>ยังไม่มีการบันทึกมื้ออาหารสำหรับวันนี้</p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-center">
              <p className="text-xs text-muted-foreground flex items-center justify-center">
                <Clock className="mr-1.5 h-3 w-3" />
                บันทึกข้อมูลในอีก: <span className="font-semibold ml-1 tabular-nums">{countdown}</span>
              </p>
            </CardFooter>
          </Card>

          <Dialog open={isWeeklyDialogOpen} onOpenChange={setIsWeeklyDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>ภาพรวมแคลอรี่สัปดาห์นี้</DialogTitle>
                <DialogDescription>กราฟแสดงผลแคลอรี่ที่คุณบริโภคในสัปดาห์นี้</DialogDescription>
              </DialogHeader>
              {isWeeklyLoading ? (
                <div className="py-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
              ) : weeklyLogs && weeklyLogs.length > 0 ? (
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

          <Dialog open={isMonthlyDialogOpen} onOpenChange={setIsMonthlyDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>ภาพรวมแคลอรี่เดือนนี้</DialogTitle>
                <DialogDescription>กราฟแสดงผลแคลอรี่ที่คุณบริโภคในเดือนนี้ ({format(new Date(), 'MMMM yyyy', { locale: th })})</DialogDescription>
              </DialogHeader>
              {isMonthlyLoading ? (
                <div className="py-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
              ) : monthlyLogs && monthlyLogs.length > 0 ? (
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
                      <CardHeader className="p-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">เฉลี่ยต่อวัน (ที่มีข้อมูล)</CardTitle></CardHeader>
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
        <p className="text-sm text-muted-foreground">MOMU SCAN</p>
      </footer>
    </div>
  );
}

export default dynamic(() => Promise.resolve(FSFAPageFn as React.ComponentType), { ssr: false });
