import { Sparkles, ChefHat, ArrowLeft, RotateCcw } from "lucide-react";
import StepIndicator from "./StepIndicator";

interface Recommendation {
    id?: number;
    name: string;
    description: string;
    imageUrl: string;
    matchScore?: number;
    matchReason?: string;
}

interface RecommendationsStepProps {
    recommendations: Recommendation[];
    onPreviousStep?: () => void;
    isLoading?: boolean;
}

function RecommendationCard({ 
    recommendation 
}: { 
    recommendation: Recommendation; 
}) {
    return (
        <div className="relative bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col h-full">
            {/* Image Section */}
            <div className="relative h-48 sm:h-56 overflow-hidden bg-stone-100 flex-shrink-0">
                {recommendation.imageUrl ? (
                    <img
                        src={recommendation.imageUrl}
                        alt={recommendation.name}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/400x300/f5f5f4/a8a29e?text=Delicious+Dish';
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ChefHat className="w-16 h-16 text-stone-300" />
                    </div>
                )}
            </div>

            {/* Content Section */}
            <div className="p-5 sm:p-6 flex flex-col flex-1">
                {/* Dish Name */}
                <h3 className="text-xl sm:text-2xl font-semibold text-stone-900 mb-2 leading-tight">
                    {recommendation.name}
                </h3>

                {/* Description */}
                <p className="text-stone-600 text-sm sm:text-base leading-relaxed line-clamp-3 flex-1">
                    {recommendation.description}
                </p>

                {/* Match Reason - always at bottom */}
                {recommendation.matchReason && (
                    <div className="pt-4 mt-4 border-t border-stone-100">
                        <div className="flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-stone-900 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-stone-600 italic leading-relaxed">
                                "{recommendation.matchReason}"
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function RecommendationsStep({ 
    recommendations, 
    onPreviousStep, 
    isLoading = false 
}: RecommendationsStepProps) {
    const hasRecommendations = recommendations && recommendations.length > 0;

    return (
        <div className="min-h-screen bg-stone-50">
            {/* Step Indicator */}
            <StepIndicator currentStep={3} />
            
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
                {/* Header */}
                <div className="text-center mb-10 sm:mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-stone-900 text-white mb-4">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-light text-stone-900 tracking-tight mb-3">
                        Your Perfect Picks
                    </h1>
                    <p className="text-stone-500 text-base sm:text-lg max-w-md mx-auto">
                        {hasRecommendations 
                            ? `Based on your preferences, we recommended some dishes we think you'll love`
                            : "We couldn't find matching recommendations. Try uploading a different menu."
                        }
                    </p>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="animate-spin h-12 w-12 border-4 border-stone-900 border-t-transparent rounded-full mb-4" />
                        <p className="text-stone-500">Finding your perfect dishes...</p>
                    </div>
                )}

                {/* Recommendations Grid */}
                {!isLoading && hasRecommendations && (
                    <div className={`
                        grid gap-6
                        ${recommendations.length === 1 
                            ? 'grid-cols-1 max-w-lg mx-auto' 
                            : recommendations.length === 2 
                                ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto'
                                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                        }
                    `}>
                        {recommendations.map((rec, index) => (
                            <RecommendationCard
                                key={rec.id || index}
                                recommendation={rec}
                            />
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && !hasRecommendations && (
                    <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-stone-200 text-stone-400 mb-6">
                            <ChefHat className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-medium text-stone-700 mb-2">
                            No Recommendations Found
                        </h3>
                        <p className="text-stone-500 mb-6 max-w-sm mx-auto">
                            We couldn't match any dishes to your preferences. Try scanning a different menu or adjusting your preferences.
                        </p>
                        {onPreviousStep && (
                            <button
                                onClick={onPreviousStep}
                                className="inline-flex items-center gap-2 py-3 px-6 bg-stone-900 text-white font-medium rounded-lg hover:bg-stone-800 transition-colors duration-200"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Try Another Menu
                            </button>
                        )}
                    </div>
                )}

                {/* Navigation */}
                <div className="mt-10 pt-8 border-t border-stone-200">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                        {onPreviousStep && (
                            <button
                                onClick={onPreviousStep}
                                className="py-4 px-6 border border-stone-300 text-stone-600 font-medium tracking-wide rounded-lg hover:bg-stone-100 transition-colors duration-200 flex items-center justify-center gap-2"
                            >
                                <ArrowLeft className="h-5 w-5" />
                                Scan Another Menu
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
