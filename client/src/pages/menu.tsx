import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDevice } from "@/contexts/DeviceContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

    // Get device ID from context
    const { deviceId, isLoading: deviceLoading } = useDevice();

    // Fetch existing preferences if any
    const { data: existingPreferences, isLoading: _preferencesLoading, error: _preferencesError, refetch: _refetchPreferences } = useQuery<{ preferences: Preference }>({
        queryKey: ['/api/preferences', deviceId], // unique identifier for caching
        queryFn: async () => { //async function that fetches data
            console.log('Fetching preferences for device ID:', deviceId);
            const response = await fetch(`/api/preferences?deviceId=${deviceId}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('No existing preferences found');
                    return { preferences: null };
                }
                throw new Error('Failed to fetch preferences');
            }
            const data = await response.json();
            console.log('Preferences fetched:', data);
            return data;
        },
        staleTime: 30000,
        enabled: !deviceLoading && !!deviceId, // Only run query when device ID is available
        retry: 1, // Retry once if it fails
        refetchOnWindowFocus: true, // Refetch when window gains focus (user returns to tab)
        refetchOnMount: true // Always refetch when component mounts
    });

    // Use effect to set preferences when they're loaded
    // This prevents the React state update during render issue
    useEffect(() => {
        if (existingPreferences?.preferences) {
            console.log('Setting user preferences from API:', existingPreferences.preferences);
            setUserPreferences({
                dietary: existingPreferences.preferences.dietary || [],
                cuisines: existingPreferences.preferences.cuisines || [],
                allergies: existingPreferences.preferences.allergies || [],
                flavors: existingPreferences.preferences.flavors || [],
                dislikedIngredients: existingPreferences.preferences.dislikedIngredients || []
            });
        }
    }, [existingPreferences]);

    // Save preferences
    const savePreferencesMutation = useMutation({
        // the function that runs when triggered
        mutationFn: async (preferences: Preference) => {
            console.log('Saving preferences for device ID:', deviceId, preferences);
            const response = await apiRequest('POST', `/api/preferences?deviceId=${deviceId}`, preferences);
            const result = await response.json();
            console.log('Preferences saved:', result);
            return result;
        },
        // the function that runs when the mutation is successful
        onSuccess: () => {
            // Invalidate cache so useQuery refetches fresh data
            queryClient.invalidateQueries({ queryKey: ['/api/preferences', deviceId] });
            toast({
                title: "Success",
                description: "Your preferences have been saved!",
            });
            nextStep();
        },
        // the function that runs when the mutation fails
        onError: (error) => {
            console.error('Error saving preferences:', error);
            toast({
                title: "Error",
                description: `Failed to save preferences: ${error instanceof Error ? error.message : String(error)}`,
                variant: "destructive"
            });
        }
    });

    const nextStep = () => {
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
        }
    };

    const previousStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };
}