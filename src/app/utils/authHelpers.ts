/**
 * Handle Supabase authentication errors and show a localized toast message.
 *
 * NOTE: This helper is kept for potential reuse but is currently not called
 * anywhere — the AuthScreen in page.tsx handles errors inline.
 */
export function handleAuthError(
  error: any,
  authDialogMode: string,
  toastFunc: (opts: { title: string; description: string; variant?: string }) => void
) {
  console.error('Authentication error:', error);

  let errorMessage = "เกิดข้อผิดพลาดที่ไม่รู้จัก";
  const msg: string = error?.message ?? '';

  if (msg === 'Invalid login credentials') {
    errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  } else if (msg === 'Email not confirmed') {
    errorMessage = "อีเมลยังไม่ได้รับการยืนยัน";
  } else if (msg.includes('already registered') || msg.includes('already been registered')) {
    errorMessage = "อีเมลนี้ถูกใช้งานแล้ว";
  } else if (msg.includes('Password should be at least')) {
    errorMessage = "รหัสผ่านต้องมี 6 ตัวอักษรขึ้นไป";
  } else if (msg.includes('rate limit') || msg.includes('too many')) {
    errorMessage = "คุณลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
  } else if (msg) {
    errorMessage = msg;
  } else {
    errorMessage = "การยืนยันตัวตนล้มเหลว โปรดลองอีกครั้ง";
  }

  toastFunc({
    title: authDialogMode === 'login' ? "เข้าสู่ระบบไม่สำเร็จ" : "ลงทะเบียนไม่สำเร็จ",
    description: errorMessage,
    variant: "destructive",
  });
}