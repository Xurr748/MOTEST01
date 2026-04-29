"use client";

import dynamic from "next/dynamic";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getLogsForDateRange, type DailyLogRecord } from "@/lib/db";
import { exportToPDF, exportToExcel, type ReportRow } from "@/lib/export-utils";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths,
  startOfDay, endOfDay, parseISO,
} from "date-fns";
import { th } from "date-fns/locale";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ScanLine, ChevronLeft, ChevronRight, FileText, FileSpreadsheet,
  Flame, TrendingUp, Calendar, Loader2, ArrowLeft, AlertCircle,
} from "lucide-react";

type ViewMode = "daily" | "weekly" | "monthly";

interface DayData {
  date: Date;
  consumedCalories: number;
  meals: { name: string; calories: number; logged_at?: string; source?: string }[];
}

const chartConfig = {
  calories: { label: "แคลอรี่", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

function ReportsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(0);

  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [anchorDate, setAnchorDate] = useState(new Date());

  const [rows, setRows] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingXls, setIsExportingXls] = useState(false);

  // ── Auth ───────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      setIsAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setCurrentUser(s?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load calorie goal from profile
  useEffect(() => {
    if (!currentUser) return;
    supabase.from("user_profiles").select("daily_calorie_goal").eq("id", currentUser.id).single()
      .then(({ data }) => { if (data?.daily_calorie_goal) setDailyGoal(data.daily_calorie_goal); });
  }, [currentUser]);

  // ── Date range from anchor + mode ─────────────────────────
  const dateRange = useMemo(() => {
    if (viewMode === "daily") {
      return { start: startOfDay(anchorDate), end: endOfDay(anchorDate) };
    }
    if (viewMode === "weekly") {
      return { start: startOfWeek(anchorDate, { weekStartsOn: 1 }), end: endOfWeek(anchorDate, { weekStartsOn: 1 }) };
    }
    return { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) };
  }, [viewMode, anchorDate]);

  const periodLabel = useMemo(() => {
    if (viewMode === "daily") return format(anchorDate, "d MMMM yyyy", { locale: th });
    if (viewMode === "weekly") {
      return `${format(dateRange.start, "d MMM", { locale: th })} – ${format(dateRange.end, "d MMM yyyy", { locale: th })}`;
    }
    return format(anchorDate, "MMMM yyyy", { locale: th });
  }, [viewMode, anchorDate, dateRange]);

  // ── Fetch data ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    const logs: DailyLogRecord[] = await getLogsForDateRange(currentUser.id, dateRange.start, dateRange.end);

    const allDays = viewMode === "daily"
      ? [dateRange.start]
      : eachDayOfInterval({ start: dateRange.start, end: dateRange.end });

    const mapped: DayData[] = allDays.map((day) => {
      const log = logs.find((l) => format(parseISO(l.log_date), "yyyy-MM-dd") === format(day, "yyyy-MM-dd"));
      return {
        date: day,
        consumedCalories: log?.consumed_calories ?? 0,
        meals: (log?.meal_entries ?? []).map((m: any) => ({
          name: m.name,
          calories: m.calories,
          logged_at: m.logged_at,
          source: m.source,
        })),
      };
    });

    setRows(mapped);
    setIsLoading(false);
  }, [currentUser, dateRange, viewMode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Nav ────────────────────────────────────────────────────
  const goBack = () => {
    if (viewMode === "daily") setAnchorDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
    else if (viewMode === "weekly") setAnchorDate((d) => subWeeks(d, 1));
    else setAnchorDate((d) => subMonths(d, 1));
  };
  const goForward = () => {
    if (viewMode === "daily") setAnchorDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });
    else if (viewMode === "weekly") setAnchorDate((d) => addWeeks(d, 1));
    else setAnchorDate((d) => addMonths(d, 1));
  };
  const isAtPresent = useMemo(() => {
    const today = new Date();
    if (viewMode === "daily") return format(anchorDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
    if (viewMode === "weekly") return format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd") === format(dateRange.start, "yyyy-MM-dd");
    return format(startOfMonth(today), "yyyy-MM-dd") === format(dateRange.start, "yyyy-MM-dd");
  }, [viewMode, anchorDate, dateRange]);

  // ── Stats ──────────────────────────────────────────────────
  const totalCalories = useMemo(() => rows.reduce((s, r) => s + r.consumedCalories, 0), [rows]);
  const daysWithData = useMemo(() => rows.filter((r) => r.consumedCalories > 0).length, [rows]);
  const avgCalories = useMemo(() => daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0, [totalCalories, daysWithData]);
  const daysOverLimit = useMemo(() => dailyGoal > 0 ? rows.filter((r) => r.consumedCalories > dailyGoal).length : 0, [rows, dailyGoal]);

  // ── Chart data ────────────────────────────────────────────
  const chartData = useMemo(() =>
    rows.map((r) => ({
      name: viewMode === "monthly" ? format(r.date, "d") : format(r.date, "E", { locale: th }),
      calories: r.consumedCalories,
    })), [rows, viewMode]);

  // ── Export ─────────────────────────────────────────────────
  const reportRows: ReportRow[] = rows.map((r) => ({
    date: r.date,
    consumedCalories: r.consumedCalories,
    dailyLimit: dailyGoal,
    meals: r.meals,
  }));

  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    await exportToPDF(reportRows, periodLabel, dailyGoal);
    setIsExportingPdf(false);
  };
  const handleExportExcel = async () => {
    setIsExportingXls(true);
    await exportToExcel(reportRows, periodLabel, dailyGoal);
    setIsExportingXls(false);
  };

  // ── Render states ─────────────────────────────────────────
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <ScanLine className="h-10 w-10 text-primary animate-pulse" />
      </div>
    );
  }
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">กรุณาเข้าสู่ระบบก่อน</p>
        <Link href="/"><Button>ไปหน้าหลัก</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <ScanLine className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">MOMU SCAN — รายงาน</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExportingPdf || rows.length === 0}>
              {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileText className="w-4 h-4 mr-1" />}
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isExportingXls || rows.length === 0}>
              {isExportingXls ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileSpreadsheet className="w-4 h-4 mr-1" />}
              Excel
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 sm:px-6 space-y-6 max-w-5xl">
        {/* Mode + Period Nav */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Tabs value={viewMode} onValueChange={(v) => { setViewMode(v as ViewMode); setAnchorDate(new Date()); }}>
            <TabsList>
              <TabsTrigger value="daily"><Calendar className="w-4 h-4 mr-1.5" />รายวัน</TabsTrigger>
              <TabsTrigger value="weekly"><TrendingUp className="w-4 h-4 mr-1.5" />รายสัปดาห์</TabsTrigger>
              <TabsTrigger value="monthly"><Flame className="w-4 h-4 mr-1.5" />รายเดือน</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[180px] text-center">{periodLabel}</span>
            <Button variant="outline" size="icon" onClick={goForward} disabled={isAtPresent}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "แคลอรี่รวม", value: `${totalCalories.toLocaleString()} kcal`, highlight: false },
                { label: "เฉลี่ยต่อวัน", value: `${avgCalories.toLocaleString()} kcal`, highlight: false },
                { label: "วันที่มีข้อมูล", value: `${daysWithData} วัน`, highlight: false },
                {
                  label: dailyGoal > 0 ? "วันที่เกินเป้า" : "เป้าหมาย",
                  value: dailyGoal > 0 ? `${daysOverLimit} วัน` : "ไม่ได้ตั้ง",
                  highlight: daysOverLimit > 0,
                },
              ].map((s, i) => (
                <Card key={i} className={s.highlight ? "border-destructive/50" : ""}>
                  <CardHeader className="pb-1 pt-4 px-4">
                    <CardDescription className="text-xs">{s.label}</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className={`text-xl font-bold ${s.highlight ? "text-destructive" : ""}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* vs Goal banner */}
            {dailyGoal > 0 && viewMode !== "daily" && (
              <div className="flex items-center gap-2 text-sm bg-muted/50 border rounded-lg px-4 py-2">
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">เส้นปะในกราฟแสดงเป้าหมาย {dailyGoal.toLocaleString()} kcal/วัน</span>
              </div>
            )}

            {/* Chart */}
            {viewMode !== "daily" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">กราฟแคลอรี่</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="min-h-[220px] w-full">
                    <BarChart data={chartData} accessibilityLayer>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="name" tickLine={false} tickMargin={8} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                      {dailyGoal > 0 && (
                        <ReferenceLine y={dailyGoal} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: "Limit", position: "right", fontSize: 10 }} />
                      )}
                      <Bar dataKey="calories" fill="var(--color-calories)" radius={viewMode === "monthly" ? 2 : 6} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {/* Data Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ตารางข้อมูล</CardTitle>
                <CardDescription>คลิกแต่ละแถวเพื่อดูรายละเอียดมื้ออาหาร</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[500px]">
                  {rows.filter(r => r.consumedCalories > 0).length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">ไม่มีข้อมูลสำหรับช่วงเวลานี้</p>
                  ) : (
                    <Accordion type="multiple" className="w-full">
                      {rows.filter(r => r.consumedCalories > 0).map((row, idx) => {
                        const isOver = dailyGoal > 0 && row.consumedCalories > dailyGoal;
                        return (
                          <AccordionItem key={idx} value={`day-${idx}`} className="border-b last:border-b-0">
                            <AccordionTrigger className="px-6 py-3 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-muted/30">
                              <div className="flex items-center justify-between w-full pr-3">
                                <div className="flex items-center gap-3">
                                  <span className="font-medium text-sm">{format(row.date, "d MMM yyyy", { locale: th })}</span>
                                  <span className="text-xs text-muted-foreground hidden sm:inline">{format(row.date, "EEEE", { locale: th })}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold text-sm ${isOver ? "text-destructive" : "text-foreground"}`}>
                                    {row.consumedCalories.toLocaleString()} kcal
                                  </span>
                                  {isOver && <Badge variant="destructive" className="text-xs">เกิน</Badge>}
                                  {!isOver && dailyGoal > 0 && <Badge variant="outline" className="text-xs text-green-600 border-green-600">ผ่าน</Badge>}
                                  <span className="text-xs text-muted-foreground">{row.meals.length} มื้อ</span>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="px-6 pb-4 space-y-1.5">
                                {row.meals.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">ไม่มีข้อมูลมื้ออาหาร</p>
                                ) : (
                                  row.meals.map((m, mi) => (
                                    <div key={mi} className="flex items-center justify-between text-sm border-l-2 border-primary/40 pl-3 py-0.5">
                                      <div>
                                        <span className="font-medium">{m.name}</span>
                                        {m.logged_at && (
                                          <span className="ml-2 text-xs text-muted-foreground">
                                            {format(new Date(m.logged_at), "HH:mm")}
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-semibold">{m.calories.toLocaleString()} kcal</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <footer className="text-center py-8 border-t mt-8">
        <p className="text-xs text-muted-foreground">MOMU SCAN Reports — {currentUser.email}</p>
      </footer>
    </div>
  );
}

export default dynamic(() => Promise.resolve(ReportsPage as React.ComponentType), { ssr: false });
