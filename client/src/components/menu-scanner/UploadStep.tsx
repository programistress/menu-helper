import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LoaderPinwheel, Camera, X, RotateCcw } from "lucide-react";

interface Dish {
  id?: number;
  name: string;
  description: string;
  imageUrl: string;
  metadata?: Record<string, unknown>;
}

interface UploadStepProps {
    onDishesDetected: (dishes: Dish[], imageBase64: string) => void;
    detectedDishes: Dish[];
    onGetRecommendations?: () => void;
    isLoading?: boolean;
  }

export default function UploadStep({ onDishesDetected, detectedDishes, onGetRecommendations, isLoading = false }: UploadStepProps) {
    return (
        <></>
    )
}