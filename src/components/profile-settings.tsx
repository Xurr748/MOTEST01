"use client";

import React from "react";
import Link from "next/link";
import type { UserProfile } from "@/types/app";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Calculator, Loader2, LogOut, Mail, Moon, Palette, Ruler, Scale,
  Settings, Shield, Sun, Target, Weight,
} from "lucide-react";

interface ProfileSettingsProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: any;
  userProfile: UserProfile;
  height: string;
  weight: string;
  customCalorieGoal: string;
  onHeightChange: (value: string) => void;
  onWeightChange: (value: string) => void;
  onCalorieGoalChange: (value: string) => void;
  isCalculatingBmi: boolean;
  onCalculateBmi: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  getBmiInterpretation: (bmi?: number) => { text: string; color: string };
}

export default function ProfileSettings({
  isOpen, onOpenChange, currentUser, userProfile,
  height, weight, customCalorieGoal,
  onHeightChange, onWeightChange, onCalorieGoalChange,
  isCalculatingBmi, onCalculateBmi,
  isDarkMode, onToggleDarkMode, onLogout, getBmiInterpretation,
}: ProfileSettingsProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-primary" />
            ตั้งค่าโปรไฟล์
          </SheetTitle>
          <SheetDescription>จัดการข้อมูลส่วนตัวและการตั้งค่าของคุณ</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-2">
          {/* Avatar & Account Info */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border">
            <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">{currentUser.email?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">{currentUser.email?.split('@')[0]}</p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {currentUser.email}
              </p>
            </div>
          </div>

          <Separator />

          {/* Body Profile & BMI */}
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <Scale className="h-4 w-4 text-primary" />
              ข้อมูลร่างกาย & BMI
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sheet-height" className="text-xs flex items-center gap-1.5">
                  <Ruler className="h-3 w-3 text-muted-foreground" />ส่วนสูง (ซม.)
                </Label>
                <Input id="sheet-height" type="number" placeholder="เช่น 165" value={height} onChange={(e) => onHeightChange(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sheet-weight" className="text-xs flex items-center gap-1.5">
                  <Weight className="h-3 w-3 text-muted-foreground" />น้ำหนัก (กก.)
                </Label>
                <Input id="sheet-weight" type="number" placeholder="เช่น 55" value={weight} onChange={(e) => onWeightChange(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sheet-goal" className="text-xs flex items-center gap-1.5">
                  <Target className="h-3 w-3 text-muted-foreground" />เป้าหมายแคลอรี่ต่อวัน (ไม่บังคับ)
                </Label>
                <Input id="sheet-goal" type="number" placeholder="เช่น 2000" value={customCalorieGoal} onChange={(e) => onCalorieGoalChange(e.target.value)} className="h-9" />
                <p className="text-[11px] text-muted-foreground">หากไม่กรอก ระบบจะคำนวณอัตโนมัติจากน้ำหนักและส่วนสูง</p>
              </div>
              <Button onClick={onCalculateBmi} disabled={isCalculatingBmi} className="w-full mt-2" size="sm">
                {isCalculatingBmi ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Calculator className="mr-2 h-4 w-4" />}
                คำนวณและบันทึก
              </Button>
            </div>

            {/* BMI Result Card */}
            {userProfile.bmi && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">ดัชนีมวลกาย (BMI)</span>
                  <span className={`text-lg font-bold ${getBmiInterpretation(userProfile.bmi).color}`}>
                    {userProfile.bmi}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">สถานะ</span>
                  <Badge variant="secondary" className={getBmiInterpretation(userProfile.bmi).color}>
                    {getBmiInterpretation(userProfile.bmi).text}
                  </Badge>
                </div>
                {userProfile.dailyCalorieGoal && (
                  <div className="flex items-center justify-between pt-1 border-t">
                    <span className="text-xs text-muted-foreground">เป้าหมายต่อวัน</span>
                    <span className="text-sm font-bold text-primary">
                      {userProfile.dailyCalorieGoal.toLocaleString()} <span className="text-xs font-normal">kcal</span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Appearance */}
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <Palette className="h-4 w-4 text-primary" />การแสดงผล
            </h3>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-3">
                {isDarkMode ? <Moon className="h-4 w-4 text-indigo-400" /> : <Sun className="h-4 w-4 text-amber-500" />}
                <div>
                  <p className="text-sm font-medium">{isDarkMode ? 'โหมดมืด' : 'โหมดสว่าง'}</p>
                  <p className="text-[11px] text-muted-foreground">{isDarkMode ? 'ลดแสงสะท้อนหน้าจอ สบายตา' : 'สว่างสดใส เหมาะกับกลางวัน'}</p>
                </div>
              </div>
              <Switch checked={isDarkMode} onCheckedChange={onToggleDarkMode} aria-label="สลับโหมดมืด/สว่าง" />
            </div>
          </div>

          <Separator />

          {/* Account Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-primary" />บัญชี
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div>
                  <p className="text-sm font-medium">อีเมล</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">{currentUser.email}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">ยืนยันแล้ว</Badge>
              </div>
              <Button variant="destructive" size="sm" className="w-full mt-2 gap-2" onClick={() => { onLogout(); onOpenChange(false); }}>
                <LogOut className="h-4 w-4" />ออกจากระบบ
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
