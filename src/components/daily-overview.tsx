"use client";

import React, { useMemo } from "react";
import type { DailyLog, Meal, UserProfile } from "@/types/app";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AreaChart, BarChart as BarChartIcon, Camera, Clock, Database, Flame,
  RotateCw, Trash2,
} from "lucide-react";

interface DailyOverviewProps {
  dailyLog: DailyLog | null;
  userProfile: UserProfile;
  isLogLoading: boolean;
  countdown: string;
  formattedToday: string;
  onRefresh: () => void;
  onDeleteMeal: (meal: Meal) => void;
  onOpenWeekly: () => void;
  onOpenMonthly: () => void;
  onOpenFoodDb: () => void;
  onScrollToTop: () => void;
}

const mealPeriodOrder = ["เช้า", "สาย", "เที่ยง", "บ่าย", "เย็น", "ค่ำ", "ดึก"];

export default function DailyOverview({
  dailyLog, userProfile, isLogLoading, countdown, formattedToday,
  onRefresh, onDeleteMeal, onOpenWeekly, onOpenMonthly, onOpenFoodDb, onScrollToTop,
}: DailyOverviewProps) {
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

  const consumed = dailyLog?.consumedCalories ?? 0;
  const goal = userProfile.dailyCalorieGoal ?? 0;
  const percent = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">ภาพรวมวันนี้</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLogLoading} aria-label="รีเฟรชข้อมูล">
              <RotateCw className={`h-4 w-4 ${isLogLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenWeekly} aria-label="ดูข้อมูลสัปดาห์">
              <AreaChart className="h-4 w-4 lg:mr-2" /><span className="hidden lg:inline">สัปดาห์</span>
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenMonthly} aria-label="ดูข้อมูลเดือน">
              <BarChartIcon className="h-4 w-4 lg:mr-2" /><span className="hidden lg:inline">เดือน</span>
            </Button>
          </div>
        </div>
        <CardDescription>{formattedToday || <Skeleton className="h-5 w-32" />}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLogLoading ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-32" /></div>
              <Skeleton className="h-3 w-full" />
              <div className="flex justify-between"><Skeleton className="h-5 w-20" /><Skeleton className="h-4 w-10" /></div>
            </div>
            <Separator />
            <div className="space-y-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ) : (
          <>
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm text-muted-foreground">แคลอรี่ที่บริโภค</span>
                <span className="text-sm text-muted-foreground">เป้าหมาย: {goal?.toLocaleString() || "N/A"} kcal</span>
              </div>
              <Progress value={percent} className="h-3" />
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-lg font-bold">{consumed.toLocaleString()} kcal</span>
                <span className="text-sm text-muted-foreground">{Math.round(percent)}%</span>
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
                                <div className="flex items-center gap-2">
                                  <span className="font-medium whitespace-nowrap text-foreground/90">{meal.calories.toLocaleString()} kcal</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDeleteMeal(meal)} aria-label={`ลบ ${meal.name}`}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-10 gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Flame className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">ยังไม่มีการบันทึกมื้ออาหาร</p>
                    <p className="text-sm text-muted-foreground mt-1">เริ่มต้นบันทึกสิ่งที่คุณกินวันนี้</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onScrollToTop}>
                      <Camera className="h-4 w-4 mr-1.5" />สแกนอาหาร
                    </Button>
                    <Button variant="outline" size="sm" onClick={onOpenFoodDb}>
                      <Database className="h-4 w-4 mr-1.5" />เลือกจากรายการ
                    </Button>
                  </div>
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
  );
}
