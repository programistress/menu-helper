const STEPS = [
    { number: 1, label: "Preferences" },
    { number: 2, label: "Menu Upload" },
    { number: 3, label: "Results" }
];

interface StepIndicatorProps {
    currentStep: number;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
    return (
        <div className="w-full max-w-3xl mx-auto px-6 pt-8 pb-4">
            <div className="flex items-center">
                {STEPS.map((step, index) => (
                    <div key={step.number} className={`flex items-center ${index < STEPS.length - 1 ? 'flex-1' : ''}`}>
                        {/* Step circle */}
                        <div
                            className={`
                                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0
                                ${step.number === currentStep 
                                    ? 'bg-stone-900 text-white' 
                                    : step.number < currentStep 
                                        ? 'bg-stone-700 text-white' 
                                        : 'bg-stone-200 text-stone-400'
                                }
                            `}
                        >
                            {step.number < currentStep ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                step.number
                            )}
                        </div>
                        
                        {/* Step label */}
                        <span className={`ml-2 text-sm hidden sm:block whitespace-nowrap ${
                            step.number === currentStep ? 'text-stone-900 font-medium' : 'text-stone-400'
                        }`}>
                            {step.label}
                        </span>
                        
                        {/* Connector line */}
                        {index < STEPS.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-3 ${
                                step.number < currentStep ? 'bg-stone-700' : 'bg-stone-200'
                            }`} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

