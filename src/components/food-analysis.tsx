"use client";

import React from "react";
import Image from "next/image";
import type { ScanFoodImageOutput } from "@/ai/flows/food-image-analyzer";
import { UNIDENTIFIED_FOOD_MESSAGE } from "@/types/app";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Camera, CheckCircle, Info, Loader2, Sparkles, Trash2, UploadCloud,
  Database, PlusCircle, Flame, Wheat,
} from "lucide-react";

interface FoodAnalysisProps {
  previewUrl: string | null;
  imageAnalysisResult: ScanFoodImageOutput | null;
  isLoadingImageAnalysis: boolean;
  isLoggingMeal: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onScan: () => void;
  onReset: () => void;
  onLogMeal: () => void;
  onOpenFoodDb: () => void;
}

export default function FoodAnalysis({
  previewUrl, imageAnalysisResult, isLoadingImageAnalysis, isLoggingMeal,
  onFileChange, onScan, onReset, onLogMeal, onOpenFoodDb,
}: FoodAnalysisProps) {
  const isFoodIdentified = imageAnalysisResult?.foodItem !== UNIDENTIFIED_FOOD_MESSAGE;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Camera className="w-6 h-6 text-primary" />
            AI วิเคราะห์อาหาร
          </CardTitle>
          <CardDescription>อัปโหลดรูปภาพอาหาร แล้ว AI จะประเมินข้อมูลโภชนาการให้คุณ</CardDescription>
        </CardHeader>
        <CardContent>
          {!previewUrl ? (
            <div className="relative">
              <input id="food-image-upload" type="file" className="hidden" accept="image/*" capture="environment" onChange={onFileChange} />
              <Label htmlFor="food-image-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex flex-col items-center justify-center text-center pt-5 pb-6">
                  <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-primary">คลิกเพื่ออัปโหลด</span> หรือลากไฟล์มาวาง
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG (สูงสุด 5MB)</p>
                </div>
              </Label>
            </div>
          ) : (
            <div className="relative group w-full aspect-video rounded-lg overflow-hidden border-2 border-dashed flex items-center justify-center bg-muted/50">
              <Image src={previewUrl} alt="Food preview" fill className="object-contain p-2" data-ai-hint="food meal" />
              <Button variant="destructive" size="icon" className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onReset} aria-label="ลบรูปภาพ">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2">
          <Button onClick={onScan} disabled={isLoadingImageAnalysis || !previewUrl} className="w-full" size="lg">
            {isLoadingImageAnalysis ? <><Loader2 className="animate-spin mr-2 h-5 w-5" />กำลังวิเคราะห์...</> : <><Sparkles className="mr-2 h-5 w-5" />วิเคราะห์รูปภาพ</>}
          </Button>
          <Button variant="secondary" className="w-full" size="lg" onClick={onOpenFoodDb}>
            <Database className="mr-2 h-5 w-5" /> เลือกจากรายการอาหาร
          </Button>
        </CardFooter>
      </Card>

      {isLoadingImageAnalysis && (
        <Card>
          <CardHeader><Skeleton className="h-7 w-48" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}

      {imageAnalysisResult && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-xl">
              {isFoodIdentified ? <CheckCircle className="w-6 h-6 text-accent" /> : <Info className="w-6 h-6 text-yellow-500" />}
              ผลการวิเคราะห์
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">อาหารที่ระบุได้:</h3>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-lg text-primary font-bold">{imageAnalysisResult.foodItem}</p>
                {imageAnalysisResult.cuisineType && imageAnalysisResult.cuisineType !== "ไม่สามารถระบุประเภทได้" && (
                  <Badge variant="outline">{imageAnalysisResult.cuisineType}</Badge>
                )}
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-2"><Flame className="w-5 h-5 text-orange-500" />แคลอรี่โดยประมาณ</h4>
                <p className="text-2xl font-bold">
                  {(imageAnalysisResult.nutritionalInformation.estimatedCalories ?? 0) > 0
                    ? imageAnalysisResult.nutritionalInformation.estimatedCalories.toLocaleString()
                    : "N/A"}
                  <span className="text-sm font-normal text-muted-foreground ml-1">kcal</span>
                </p>
                {imageAnalysisResult.nutritionalInformation.reasoning && (
                  <p className="text-xs text-muted-foreground mt-1">{imageAnalysisResult.nutritionalInformation.reasoning}</p>
                )}
              </div>
              {imageAnalysisResult.nutritionalInformation?.visibleIngredients?.length > 0 && (
                <div>
                  <h4 className="font-semibold flex items-center gap-2 mb-2"><Wheat className="w-5 h-5 text-yellow-600" />ส่วนผสมที่พบ</h4>
                  <div className="flex flex-wrap gap-2">
                    {imageAnalysisResult.nutritionalInformation.visibleIngredients.map((ing, i) => (
                      <Badge key={i} variant="secondary">{ing}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          {isFoodIdentified && (
            <CardFooter>
              <Button size="lg" onClick={onLogMeal} disabled={isLoggingMeal || (imageAnalysisResult.nutritionalInformation.estimatedCalories ?? 0) <= 0} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                {isLoggingMeal ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2" />}
                เพิ่มในบันทึกแคลอรี่
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
    </>
  );
}
