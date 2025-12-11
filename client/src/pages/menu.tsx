import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDevice } from "@/contexts/DeviceContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import PreferencesStep from "@/components/menu-scanner/PreferencesStep";
import UploadStep from "@/components/menu-scanner/UploadStep";
import { Button } from "@/components/ui/button";
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

    const saveDishesMutation = useMutation({
        mutationFn: async (dishes: Dish[]) => {
            const response = await apiRequest('POST', '/api/dishes', dishes);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/dishes'] });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: `Failed to save dishes: ${error instanceof Error ? error.message : String(error)}`,
                variant: "destructive"
            });
        }
    });

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
            const response = await apiRequest('POST', '/api/direct/recommendations', {
                dishes: detectedDishes,
                preferences: userPreferences
            });
            const data = await response.json();

            setCurrentRecommendations(data);

            if (data && (Array.isArray(data) && data.length > 0)) {
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
            saveDishesMutation.mutate(dishes);

            // No longer automatically process recommendations
            // Let the user review the detected dishes and click the button manually
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
        <div className="p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Menu Scanner</h1>
                <p className="text-gray-600 dark:text-gray-300 text-lg">
                    Scan menus to get personalized dish recommendations
                </p>
            </div>

            {/* Progress Bar */}
            <Card className="mb-8 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                <CardContent className="p-4">
                    <div className="w-full max-w-4xl mx-auto">
                        <div className="flex justify-between items-center relative">
                            {/* Progress Bar Line */}
                            <div className="absolute top-1/2 transform -translate-y-1/2 h-0.5 bg-gray-200 dark:bg-gray-700 w-full"></div>
                            <div className="absolute top-1/2 transform -translate-y-1/2 h-0.5 bg-violet-600 dark:bg-violet-500" style={{ width: `${((currentStep - 1) / 2) * 100}%` }}></div>

                            {/* Steps */}
                            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full z-10 cursor-pointer transition-colors ${currentStep >= 1
                                ? 'bg-violet-600 dark:bg-violet-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                }`}
                                onClick={() => setCurrentStep(1)}
                            >
                                1
                            </div>
                            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full z-10 cursor-pointer transition-colors ${currentStep >= 2
                                ? 'bg-violet-600 dark:bg-violet-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                }`}
                                onClick={() => currentStep >= 2 ? setCurrentStep(2) : null}
                            >
                                2
                            </div>
                            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full z-10 cursor-pointer transition-colors ${currentStep >= 3
                                ? 'bg-violet-600 dark:bg-violet-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                }`}
                                onClick={() => currentStep >= 3 ? setCurrentStep(3) : null}
                            >
                                3
                            </div>
                        </div>

                        <div className="flex justify-between items-center mt-2 text-xs text-gray-600 dark:text-gray-300">
                            <div className="text-center w-10">Preferences</div>
                            <div className={`text-center w-10 ${currentStep >= 2 ? 'text-gray-900 dark:text-gray-200' : ''}`}>Menu Upload</div>
                            <div className={`text-center w-10 ${currentStep >= 3 ? 'text-gray-900 dark:text-gray-200' : ''}`}>Recommendations</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Step Content */}
            <Card className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                <CardContent className="p-6">
                    {currentStep === 1 && (
                        <PreferencesStep
                            preferences={userPreferences}
                            onSubmit={handlePreferencesSubmit}
                            isLoading={savePreferencesMutation.isPending}
                        />
                    )}
                    {currentStep === 2 && (
                        <div>
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
                                isLoading={recommendationsMutation.isPending}
                            />
                            {/* Back button for step 2 */}
                            <div className="flex justify-start mt-6">
                                <Button
                                    variant="outline"
                                    onClick={previousStep}
                                    className="flex items-center gap-2"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Back to Preferences
                                </Button>
                            </div>
                        </div>
                    )}
                    {currentStep === 3 && (
                        <div>
                            <RecommendationsStep
                                recommendations={currentRecommendations}
                            />
                            {/* Back button for step 3 */}
                            <div className="flex justify-start mt-6">
                                <Button
                                    variant="outline"
                                    onClick={previousStep}
                                    className="flex items-center gap-2"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Back to Menu Upload
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}