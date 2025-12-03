import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type Dish = {
    id?: number;
    name: string;
    description: string;
    imageUrl: string;
    metadata?: Record<string, unknown>;
};

type Recommendation = {
    dishName: string;
    imageUrls?: string[];
    description?: string;
    matchScore?: number;
    matchReason?: string;
};

type Preference = {
    dietary: string[];
    cuisines: string[];
    allergies: string[];
    flavors: string[];
    dislikedIngredients: string[];
};

export default function Menu() {
    const [currentStep, setCurrentStep] = useState(1);
    const [userPreferences, setUserPreferences] = useState<Preference>({
        dietary: [],
        cuisines: [],
        allergies: [],
        flavors: [],
        dislikedIngredients: []
    });
    const [detectedDishes, setDetectedDishes] = useState<Dish[]>([]);
    const [currentRecommendations, setCurrentRecommendations] = useState<Recommendation[]>([]);
    const { toast } = useToast();
}