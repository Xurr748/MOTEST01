
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
  try {
    const model = getModel('gemini-2.5-flash');
    
    // Build conversation history
    const conversationHistory = (input.history || []).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));
    
    // Start chat session
    const chat = model.startChat({
      history: conversationHistory,
    });
    
    const systemPrompt = `คุณคือผู้ช่วยด้านโภชนาการของ MOMU 
ตอบคำถามเกี่ยวกับอาหาร โภชนาการ แคลอรี่ และสุขภาพ
ตอบเป็นภาษาไทยเท่านั้น
เป็นกันเอง ให้คำแนะนำที่เป็นประโยชน์
ให้คำตอบที่ชัดเจนและกระชับ
หากไม่แน่ใจในคำตอบ ให้ตอบว่า "ขออภัยค่ะ ฉันไม่แน่ใจในเรื่องนี้" แทนการให้ข้อมูลที่ไม่ถูกต้อง
หากผู้ใช้ถามคำถามที่ไม่เกี่ยวข้องกับโภชนาการ ให้ตอบว่า "ขออภัยค่ะ ฉันเชี่ยวชาญเฉพาะเรื่องโภชนาการเท่านั้น" แทนการให้ข้อมูลที่ไม่เกี่ยวข้อง
`;
    
    // Send message with chat history
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
    console.error('Chat Error:', err);
    if (err.message?.includes('403')) {
      return { response: 'ขออภัยค่ะ บริการ AI ถูกระงับชั่วคราว โปรดตรวจสอบสถานะการชำระเงินใน Google Console' };
    }
    return { response: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI โปรดลองอีกครั้งในภายหลัง' };
  }
}
