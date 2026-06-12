"use client";

import React from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const chartConfig = {
  calories: { label: "แคลอรี่", color: "var(--chart-1)" },
} satisfies ChartConfig;

interface ChartDialogsProps {
  // Weekly
  isWeeklyOpen: boolean;
  onWeeklyChange: (open: boolean) => void;
  isWeeklyLoading: boolean;
  weeklyChartData: { name: string; calories: number }[];
  weeklyTotal: number;
  weeklyAverage: number;
  weeklyHasData: boolean;
  // Monthly
  isMonthlyOpen: boolean;
  onMonthlyChange: (open: boolean) => void;
  isMonthlyLoading: boolean;
  monthlyChartData: { name: string; calories: number }[];
  monthlyTotal: number;
  monthlyAverage: number;
  monthlyHasData: boolean;
}

export default function ChartDialogs({
  isWeeklyOpen, onWeeklyChange, isWeeklyLoading, weeklyChartData, weeklyTotal, weeklyAverage, weeklyHasData,
  isMonthlyOpen, onMonthlyChange, isMonthlyLoading, monthlyChartData, monthlyTotal, monthlyAverage, monthlyHasData,
}: ChartDialogsProps) {
  return (
    <>
      {/* Weekly Dialog */}
      <Dialog open={isWeeklyOpen} onOpenChange={onWeeklyChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ภาพรวมแคลอรี่สัปดาห์นี้</DialogTitle>
            <DialogDescription>กราฟแสดงผลแคลอรี่ที่คุณบริโภคในสัปดาห์นี้</DialogDescription>
          </DialogHeader>
          {isWeeklyLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
          ) : weeklyHasData ? (
            <div className="py-4 space-y-4">
              <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                <BarChart accessibilityLayer data={weeklyChartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} stroke="var(--muted-foreground)" />
                  <YAxis stroke="var(--muted-foreground)" />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  <Bar dataKey="calories" fill="var(--color-calories)" radius={8} />
                </BarChart>
              </ChartContainer>
              <div className="grid grid-cols-2 gap-4 text-center">
                <Card className="p-4">
                  <CardHeader className="p-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">แคลอรี่รวม</CardTitle></CardHeader>
                  <CardContent className="p-0"><p className="text-2xl font-bold">{weeklyTotal.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span></p></CardContent>
                </Card>
                <Card className="p-4">
                  <CardHeader className="p-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">เฉลี่ยต่อวัน</CardTitle></CardHeader>
                  <CardContent className="p-0"><p className="text-2xl font-bold">{weeklyAverage.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span></p></CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">ยังไม่มีข้อมูลสำหรับสัปดาห์นี้</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Monthly Dialog */}
      <Dialog open={isMonthlyOpen} onOpenChange={onMonthlyChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>ภาพรวมแคลอรี่เดือนนี้</DialogTitle>
            <DialogDescription>กราฟแสดงผลแคลอรี่ในเดือน {format(new Date(), "MMMM yyyy", { locale: th })}</DialogDescription>
          </DialogHeader>
          {isMonthlyLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
          ) : monthlyHasData ? (
            <div className="py-4 space-y-4">
              <ChartContainer config={chartConfig} className="min-h-[250px] w-full h-80">
                <BarChart accessibilityLayer data={monthlyChartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} stroke="var(--muted-foreground)" fontSize={10} />
                  <YAxis stroke="var(--muted-foreground)" />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  <Bar dataKey="calories" fill="var(--color-calories)" radius={4} />
                </BarChart>
              </ChartContainer>
              <div className="grid grid-cols-2 gap-4 text-center">
                <Card className="p-4">
                  <CardHeader className="p-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">แคลอรี่รวม</CardTitle></CardHeader>
                  <CardContent className="p-0"><p className="text-2xl font-bold">{monthlyTotal.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span></p></CardContent>
                </Card>
                <Card className="p-4">
                  <CardHeader className="p-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">เฉลี่ยต่อวัน</CardTitle></CardHeader>
                  <CardContent className="p-0"><p className="text-2xl font-bold">{monthlyAverage.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span></p></CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">ยังไม่มีข้อมูลสำหรับเดือนนี้</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
