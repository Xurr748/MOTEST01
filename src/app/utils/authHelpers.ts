import { toast } from '@/components/ui/toast'; // adjust import if necessary

export function handleAuthError(error: any, authDialogMode: string, toastFunc: any) {
  console.error('Authentication error:', error);
  let errorMessage = "เกิดข้อผิดพลาดที่ไม่รู้จัก";
  switch (error.code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      break;
    case 'auth/email-already-in-use':
      errorMessage = "อีเมลนี้ถูกใช้งานแล้ว";
      break;
    case 'auth/weak-password':
      errorMessage = "รหัสผ่านต้องมี 6 ตัวอักษรขึ้นไป";
      break;
    default:
      errorMessage = "การยืนยันตัวตนล้มเหลว โปรดลองอีกครั้ง";
  }
  toastFunc({
    title: authDialogMode === 'login' ? "เข้าสู่ระบบไม่สำเร็จ" : "ลงทะเบียนไม่สำเร็จ",
    description: errorMessage,
    variant: "destructive"
  });
}