"use client";

import React, { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  PlusCircle,
  Loader2,
  AlertCircle,
  Pencil,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

interface ManualFoodEntryProps {
  dailyCalorieGoal?: number;
  currentConsumedCalories: number;
  onLogMeal: (name: string, calories: number) => Promise<boolean>;
}

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function ManualFoodEntry({
  dailyCalorieGoal,
  currentConsumedCalories,
  onLogMeal,
}: ManualFoodEntryProps) {
  // UI state
  const [isOpen, setIsOpen] = useState(false);

  // Form state
  const [foodName, setFoodName] = useState("");
  const [amount, setAmount] = useState("");
  const [calories, setCalories] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Over-limit dialog state
  const [isOverLimitOpen, setIsOverLimitOpen] = useState(false);
  const [overAmount, setOverAmount] = useState(0);
  const [pendingEntry, setPendingEntry] = useState<{ name: string; calories: number } | null>(null);

  const { toast } = useToast();

  const resetForm = () => {
    setFoodName("");
    setAmount("");
    setCalories("");
    setFormError("");
  };

  const buildFoodName = () => {
    const trimName = foodName.trim();
    const trimAmount = amount.trim();
    return trimAmount ? `${trimName} (${trimAmount})` : trimName;
  };

  const doLog = async (name: string, cal: number): Promise<boolean> => {
    setIsLoading(true);
    const ok = await onLogMeal(name, cal);
    setIsLoading(false);
    if (ok) {
      toast({
        title: "✅ เพิ่มในบันทึกสำเร็จ",
        description: `${name} — ${cal.toLocaleString()} kcal`,
      });
      resetForm();
    }
    return ok;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const cal = parseInt(calories, 10);
    if (!foodName.trim()) { setFormError("กรุณากรอกชื่ออาหาร"); return; }
    if (isNaN(cal) || cal <= 0) { setFormError("กรุณากรอกแคลอรี่ที่ถูกต้อง (มากกว่า 0)"); return; }

    const name = buildFoodName();

    // Only warn if user has explicitly set a calorie goal AND new total would exceed it
    if (dailyCalorieGoal && dailyCalorieGoal > 0) {
      const newTotal = currentConsumedCalories + cal;
      if (newTotal > dailyCalorieGoal) {
        setOverAmount(newTotal - dailyCalorieGoal);
        setPendingEntry({ name, calories: cal });
        setIsOverLimitOpen(true);
        return;
      }
    }

    const ok = await doLog(name, cal);
    if (ok) setIsOpen(false);
  };

  const handleConfirmOverLimit = async () => {
    if (!pendingEntry) return;
    setIsOverLimitOpen(false);
    const ok = await doLog(pendingEntry.name, pendingEntry.calories);
    if (ok) setIsOpen(false);
    setPendingEntry(null);
    setOverAmount(0);
  };

  const handleCancelOverLimit = () => {
    setIsOverLimitOpen(false);
    setPendingEntry(null);
    setOverAmount(0);
  };

  return (
    <>
      {/* ── Over-limit Warning Dialog ── */}
      <Dialog open={isOverLimitOpen} onOpenChange={setIsOverLimitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-orange-500">
              <AlertCircle className="w-5 h-5" />
              เกินเป้าหมายแคลอรี่
            </DialogTitle>
            <DialogDescription>
              การเพิ่มรายการนี้จะทำให้คุณบริโภคเกินเป้าหมายรายวัน{" "}
              <span className="font-bold text-destructive">
                {overAmount.toLocaleString()} kcal
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-1.5 text-sm text-muted-foreground">
            <p>เป้าหมายต่อวัน: <span className="font-semibold text-foreground">{dailyCalorieGoal?.toLocaleString()} kcal</span></p>
            <p>บริโภคแล้ว: <span className="font-semibold text-foreground">{currentConsumedCalories.toLocaleString()} kcal</span></p>
            <p>ที่จะเพิ่ม: <span className="font-semibold text-foreground">{pendingEntry?.calories.toLocaleString()} kcal</span></p>
            <p>รวมหลังเพิ่ม: <span className="font-bold text-destructive">{(currentConsumedCalories + (pendingEntry?.calories ?? 0)).toLocaleString()} kcal</span></p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelOverLimit}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleConfirmOverLimit} disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              บันทึกเพิ่ม
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Collapsible Card ── */}
      <Card className="overflow-hidden">
        {/* Compact header row — always visible, click to toggle */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-muted/40 transition-colors"
          onClick={() => { setIsOpen((v) => !v); setFormError(""); }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Pencil className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-sm font-semibold truncate">บันทึกอาหารด้วยตนเอง</span>
            {dailyCalorieGoal && dailyCalorieGoal > 0 && !isOpen && (
              <span className="text-xs text-muted-foreground hidden sm:inline whitespace-nowrap">
                — {currentConsumedCalories.toLocaleString()} / {dailyCalorieGoal.toLocaleString()} kcal
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isOpen && (
              <Button size="sm" className="h-7 px-3 text-xs gap-1.5 pointer-events-none" tabIndex={-1}>
                <PlusCircle className="w-3.5 h-3.5" />
                เพิ่มอาหาร
              </Button>
            )}
            {isOpen
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />
            }
          </div>
        </div>

        {/* Expandable form */}
        {isOpen && (
          <form onSubmit={handleSubmit}>
            <CardContent className="pt-0 pb-4 px-4 space-y-4 border-t">
              <div className="pt-4 space-y-2">
                <Label htmlFor="manual-food-name">ชื่ออาหาร *</Label>
                <input
                  id="manual-food-name"
                  type="text"
                  placeholder="เช่น ข้าวผัด, ไก่ย่าง"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="manual-food-amount">ปริมาณ / จำนวน</Label>
                  <input
                    id="manual-food-amount"
                    type="text"
                    placeholder="เช่น 1 จาน, 200g"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isLoading}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-food-calories">แคลอรี่ (kcal) *</Label>
                  <input
                    id="manual-food-calories"
                    type="number"
                    placeholder="เช่น 350"
                    min={1}
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    disabled={isLoading}
                    className={inputClass}
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {dailyCalorieGoal && dailyCalorieGoal > 0 && (
                <p className="text-xs text-muted-foreground">
                  บริโภคแล้ว{" "}
                  <span className="font-semibold text-foreground">{currentConsumedCalories.toLocaleString()}</span>
                  {" "}/ เป้าหมาย{" "}
                  <span className="font-semibold text-foreground">{dailyCalorieGoal.toLocaleString()}</span>
                  {" "}kcal
                </p>
              )}
            </CardContent>
            <CardFooter className="px-4 pb-4 gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => { setIsOpen(false); resetForm(); }}
                disabled={isLoading}
              >
                <X className="mr-2 h-4 w-4" />
                ยกเลิก
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading
                  ? <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  : <PlusCircle className="mr-2 h-4 w-4" />
                }
                เพิ่มในบันทึก
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </>
  );
}
