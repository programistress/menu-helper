import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDevice } from "@/contexts/DeviceContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import PreferencesStep from "@/components/menu-scanner/PreferencesStep";
import UploadStep from "@/components/menu-scanner/UploadStep";
import RecommendationsStep from "@/components/menu-scanner/RecommendationsStep";

type Dish = {
    id?: number;
    name: string;
    description: string;
    imageUrl: string;
    metadata?: Record<string, unknown>;
};

type Recommendation = {
    id?: number;
    name: string;
    description: string;
    imageUrl: string;
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
            // API returns { preferences: {...}, deviceId: "..." }
            // Extract just the preferences object
            return { preferences: data.preferences };
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

    // Generate recommendations using direct OpenAI integration for high-quality descriptions
    const recommendationsMutation = useMutation({
        mutationFn: async () => {
            if (!detectedDishes || detectedDishes.length === 0) {
                // If no dishes were detected, don't make the API call at all
                console.log("No dishes to send for recommendations");
                return [];
            }

            // Use the existing userPreferences from state
            // Include the detected dishes and preferences in the request
            console.log("Sending dishes for OpenAI recommendations:", detectedDishes.length);
            const response = await apiRequest('POST', `/api/recommendations?deviceId=${deviceId}`, {
                dishes: detectedDishes,
                preferences: userPreferences
            });
            const data = await response.json();

            // API returns { recommendations: [...] }, extract the array
            const recommendations = data.recommendations || data;
            setCurrentRecommendations(recommendations);

            if (recommendations && Array.isArray(recommendations) && recommendations.length > 0) {
                nextStep(); // Only proceed if we got actual recommendations
            } else {
                toast({
                    title: "No recommendations",
                    description: "We couldn't generate recommendations based on the detected dishes. Try another photo with more visible text.",
                    variant: "destructive"
                });
            }
        },
        onError: (error) => {
            // Handle the error silently without showing the "No dishes provided" error to user
            console.log("Recommendation error details:", error);

            // Only show errors that are not the "No dishes provided" error
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!errorMessage.includes("No dishes provided")) {
                toast({
                    title: "Error",
                    description: `Failed to generate recommendations: ${errorMessage}`,
                    variant: "destructive"
                });
            }
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

    const handlePreferencesSubmit = (preferences: Preference) => {
        setUserPreferences(preferences);
        savePreferencesMutation.mutate(preferences);
    };

    const handleDishesDetected = (dishes: Dish[], _imageBase64: string) => {
        console.log("Dishes detected:", dishes.length, "dishes");
        if (dishes && dishes.length > 0) {
            setDetectedDishes(dishes);

            toast({
                title: "Dishes detected!",
                description: `We found ${dishes.length} dish${dishes.length === 1 ? '' : 'es'}. Review them and click 'Get Recommendations' when ready.`,
            });
        } else {
            toast({
                title: "No dishes detected",
                description: "Unable to detect any dishes in the image. Please try another photo with clearer dishes.",
                variant: "destructive"
            });
        }
    };

    return (
        <>
            {currentStep === 1 && (
                <PreferencesStep
                    preferences={userPreferences}
                    onSubmit={handlePreferencesSubmit}
                    onNextStep={nextStep}
                    isLoading={savePreferencesMutation.isPending}
                />
            )}
            {currentStep === 2 && (
                <UploadStep
                    onDishesDetected={handleDishesDetected}
                    detectedDishes={detectedDishes}
                    onGetRecommendations={() => {
                        if (detectedDishes.length > 0) {
                            recommendationsMutation.mutate();
                        } else {
                            toast({
                                title: "No dishes detected",
                                description: "Please scan a menu before getting recommendations.",
                                variant: "destructive"
                            });
                        }
                    }}
                    onPreviousStep={previousStep}
                    onScanAnotherMenu={() => {
                        setDetectedDishes([]);
                    }}
                    isLoading={recommendationsMutation.isPending}
                />
            )}
            {currentStep === 3 && (
                <RecommendationsStep
                    recommendations={currentRecommendations}
                    onPreviousStep={previousStep}
                />
            )}
        </>
    )
}