
'use server';
/**
 * @fileOverview AI Food Image Analysis Flow.
 * วิเคราะห์รูปภาพอาหารและประเมินข้อมูลโภชนาการโดยใช้ Google Generative AI
 */

import { getModel } from '@/ai/client';

/* =========================
   ประเภทข้อมูล (Types)
========================= */

export interface ScanFoodImageInput {
  foodImage: string; // base64 data URI
}

export interface ScanFoodImageOutput {
  cuisineType: string;
  foodItem: string;
  nutritionalInformation: {
    estimatedCalories: number;
    visibleIngredients: string[];
    reasoning: string;
    confidence: number;
  };
}

/* =========================
   ฟังก์ชันหลัก
========================= */

export async function scanFoodImage(input: ScanFoodImageInput): Promise<ScanFoodImageOutput> {
  try {
    const model = getModel('gemini-2.5-flash');
    
    // Convert base64 data URI to image parts
    const base64Data = input.foodImage.split(',')[1] || input.foodImage;
    const mimeType = input.foodImage.includes('data:image/jpeg') ? 'image/jpeg' : 'image/png';
    
    const prompt = `
คุณคือผู้เชี่ยวชาญด้านโภชนาการ
วิเคราะห์รูปภาพอาหารนี้และสรุปผลให้สั้น กระชับ อ่านง่าย

ตอบกลับเป็นภาษาไทยในรูปแบบ JSON ที่ถูกต้องเท่านั้น เช่น:
{
  "cuisineType": "ประเภทอาหาร (เช่น ไทย, จีน, อิตาเลียน)",
  "foodItem": "ชื่อเมนูอาหาร (ภาษาไทย)",
  "nutritionalInformation": {
    "estimatedCalories": ตัวเลขจำนวนแคลอรี่,
    "visibleIngredients": ["ข้าว 250 กรัม", "หมู 100 กรัม", "ผัก 10 กรัม"],
    "reasoning": "สรุปสั้นๆ เช่น ประเมินจากปริมาณข้าวและหมูในจาน",
    "confidence": ตัวเลข 0-100
  }
}

ข้อควรทำ:
- visibleIngredients ให้แสดงแบบสั้นและแยกบรรทัด เช่น "ข้าว 250 กรัม", "หมู 100 กรัม", "ผัก 10 กรัม"
- reasoning ให้สั้น ไม่เกิน 1-2 บรรทัด
- ไม่ต้องอธิบายยาว
`;
    
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      },
      prompt,
    ]);
    
    const response = result.response;
    const text = response.text();
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('ไม่สามารถแยก JSON จากการตอบสนองของ AI');
    }
    
    const output = JSON.parse(jsonMatch[0]) as ScanFoodImageOutput;
    return output;
  } catch (err: any) {
    console.error('Scan Error Details:', err);
    
    let thaiReason = 'เกิดข้อผิดพลาดในการเชื่อมต่อ AI';
    const errorMessage = err.message || '';

    if (errorMessage.includes('403')) {
      thaiReason = '🚨 บริการถูกระงับ: บัญชี Google ยังไม่พร้อมใช้งาน หรือสิทธิ์การเข้าถึง API ถูกบล็อก (ตรวจสอบที่ console.cloud.google.com)';
    } else if (errorMessage.includes('400')) {
      thaiReason = '🚨 API Key ไม่ถูกต้อง หรือไม่ได้ตั้งค่าในระบบ';
    } else if (errorMessage.includes('429')) {
      thaiReason = '🚨 ใช้งานเกินขีดจำกัด (Quota Exceeded) โปรดรอสักครู่แล้วลองใหม่';
    }

    return {
      cuisineType: 'เกิดข้อผิดพลาด',
      foodItem: 'ระบบไม่พร้อมใช้งาน',
      nutritionalInformation: {
        estimatedCalories: 0,
        visibleIngredients: [],
        reasoning: thaiReason + (errorMessage ? ` (${errorMessage})` : ''),
        confidence: 0,
      },
    };
  }
}
