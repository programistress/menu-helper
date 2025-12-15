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

export default function RecommendationsStep({ recommendations, onPreviousStep, isLoading = false }: RecommendationsStepProps) {
    return (
        <div className="min-h-screen bg-stone-50">
            {/* Step Indicator */}
            <StepIndicator currentStep={3} />
            
            <div className="w-full max-w-3xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-12">
                    <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-3">
                        Your Recommendations
                    </h1>
                    <p className="text-stone-500 text-lg">
                        {recommendations.length > 0 
                            ? `We found ${recommendations.length} dish${recommendations.length === 1 ? '' : 'es'} you might enjoy!`
                            : "Based on your preferences and the menu, here are our top picks."
                        }
                    </p>
                </div>

                {/* Placeholder content */}
                <div className="border-2 border-dashed border-stone-300 rounded-lg p-12 text-center bg-white">
                    <p className="text-stone-400">Recommendations display coming soon...</p>
                </div>

                {/* Navigation */}
                <div className="mt-14 pt-8 border-t border-stone-200">
                    <div className="flex justify-start">
                        {onPreviousStep && (
                            <button
                                onClick={onPreviousStep}
                                className="py-4 px-6 border border-stone-300 text-stone-600 font-medium tracking-wide rounded-lg hover:bg-stone-100 transition-colors duration-200 flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to Menu Upload
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
