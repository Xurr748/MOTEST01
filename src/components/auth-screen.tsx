"use client";

import React, { useState } from "react";
import { HeroGeometric } from "@/components/hero-geometric";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, LogIn, UserPlus } from "lucide-react";

export default function AuthScreen({ onAuthSuccess }: { onAuthSuccess: () => void }) {
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
    <div className="min-h-screen bg-[#030303]">
      <HeroGeometric />
      <div className="relative z-20 flex flex-col items-center px-4 -mt-16 pb-12">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-white/10 bg-background/95 backdrop-blur-xl">
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
                  <Input id="auth-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auth-password">รหัสผ่าน</Label>
                  <Input id="auth-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
                </div>
                {mode === "register" && (
                  <div className="space-y-2">
                    <Label htmlFor="auth-confirm">ยืนยันรหัสผ่าน</Label>
                    <Input id="auth-confirm" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isLoading} />
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : mode === "login" ? <LogIn className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  {mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="justify-center pt-0">
              <p className="text-sm text-muted-foreground">
                {mode === "login" ? "ยังไม่มีบัญชี?" : "มีบัญชีอยู่แล้ว?"}
                <Button variant="link" className="px-2 py-0 h-auto" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} disabled={isLoading}>
                  {mode === "login" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
                </Button>
              </p>
            </CardFooter>
          </Card>
          <p className="text-center text-xs text-white/30 mt-6">MOMU SCAN v1.0 — ติดตามสุขภาพและแคลอรี่ด้วย AI</p>
        </div>
      </div>
    </div>
  );
}
