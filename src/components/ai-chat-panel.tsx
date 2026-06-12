"use client";

import React, { useRef, useEffect } from "react";
import type { ChatMessage } from "@/ai/flows/post-scan-chat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Loader2, MessageCircle, Send, UserCircle } from "lucide-react";

interface AIChatPanelProps {
  chatMessages: ChatMessage[];
  chatInput: string;
  isChatLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (event?: React.FormEvent) => void;
}

export default function AIChatPanel({
  chatMessages, chatInput, isChatLoading, onInputChange, onSubmit,
}: AIChatPanelProps) {
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (chatScrollAreaRef.current) {
      chatScrollAreaRef.current.scrollTop = chatScrollAreaRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <MessageCircle className="w-6 h-6 text-primary" />
          Momu AI Assistant
        </CardTitle>
        <CardDescription>สอบถามเกี่ยวกับอาหาร โภชนาการ หรือข้อสงสัยอื่นๆ</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72 w-full rounded-lg border bg-muted/30 p-4" viewportRef={chatScrollAreaRef}>
          {chatMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Brain className="w-12 h-12 mb-4" />
              <p className="text-lg font-medium">เริ่มต้นการสนทนา</p>
              <p className="text-sm">ถามคำถามเกี่ยวกับอาหารที่สแกนได้เลย!</p>
            </div>
          )}
          <div className="space-y-4">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "model" && <UserCircle className="w-6 h-6 text-primary flex-shrink-0" />}
                <div className={`p-3 rounded-lg max-w-[85%] shadow-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-none" : "bg-secondary text-secondary-foreground rounded-bl-none"}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
          {isChatLoading && (
            <div className="flex items-end gap-2 justify-start mt-4">
              <UserCircle className="w-6 h-6 text-primary flex-shrink-0" />
              <div className="p-3 rounded-lg bg-secondary rounded-bl-none shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form onSubmit={onSubmit} className="flex w-full items-center space-x-2">
          <Textarea
            ref={chatInputRef}
            value={chatInput}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="พิมพ์ข้อความของคุณ..."
            className="flex-grow resize-none"
            rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
          />
          <Button type="submit" size="icon" disabled={isChatLoading || !chatInput.trim()} aria-label="ส่งข้อความ">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
