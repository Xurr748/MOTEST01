
'use server';
/**
 * @fileOverview Nutrition Chatbot using Google Generative AI
 */

import { getModel } from '@/ai/client';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ChatInput {
  message: string;
  history?: ChatMessage[];
}

export interface ChatOutput {
  response: string;
}

export async function chatWithBot(input: ChatInput): Promise<ChatOutput> {
  const candidateModels = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3-flash-preview'];

  // Build conversation history
  const conversationHistory = (input.history || []).map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const systemPrompt = `คุณคือผู้ช่วยด้านโภชนาการของ MOMU 
ตอบคำถามเกี่ยวกับอาหาร โภชนาการ แคลอรี่ และสุขภาพ
ตอบเป็นภาษาไทยเท่านั้น
เป็นกันเอง ให้คำแนะนำที่เป็นประโยชน์
ให้คำตอบที่ชัดเจนและกระชับ
หากไม่แน่ใจในคำตอบ ให้ตอบว่า "ขออภัยค่ะ ฉันไม่แน่ใจในเรื่องนี้" แทนการให้ข้อมูลที่ไม่ถูกต้อง
หากผู้ใช้ถามคำถามที่ไม่เกี่ยวข้องกับโภชนาการ ให้ตอบว่า "ขออภัยค่ะ ฉันเชี่ยวชาญเฉพาะเรื่องโภชนาการเท่านั้น" แทนการให้ข้อมูลที่ไม่เกี่ยวข้อง
`;

  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const model = getModel(modelName);
      const chat = model.startChat({
        history: conversationHistory,
      });

      const result = await chat.sendMessage([
        { text: systemPrompt },
        { text: input.message },
      ]);

      const response = result.response;
      const text = response.text();
      return {
        response: text,
      };
    } catch (err: any) {
      console.warn(`Chat model ${modelName} failed, trying next fallback:`, err.message);
      lastError = err;
    }
  }

  console.error('All Chat Models Failed. Last Error:', lastError);
  if (lastError?.message?.includes('403')) {
    return { response: 'ขออภัยค่ะ บริการ AI ถูกระงับชั่วคราว โปรดตรวจสอบสิทธิ์ใน Google Cloud Console' };
  }
  if (lastError?.message?.includes('503')) {
    return { response: 'ขออภัยค่ะ เซิร์ฟเวอร์ AI มีผู้ใช้งานหนาแน่นชั่วคราว โปรดลองส่งคำถามใหม่อีกครั้งนะคะ' };
  }
  return { response: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI โปรดลองอีกครั้งในภายหลัง' };
}
