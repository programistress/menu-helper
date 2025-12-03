import { useEffect, useState } from "react";

interface PreferencesStepProps {
    preferences: {
        dietary: string[];
        cuisines: string[];
        allergies: string[];
        flavors: string[];
        dislikedIngredients: string[];
    };
    onSubmit: (preferences: {
        dietary: string[];
        cuisines: string[];
        allergies: string[];
        flavors: string[];
        dislikedIngredients: string[];
    }) => void;
    isLoading: boolean;
}

const OPTIONS = {
    dietary: [
        "Vegan",
        "Vegetarian",
        "Pescatarian",
        "Gluten-Free",
        "Lactose-Free",
        "Keto",
        "Low-Carb",
        "High-Protein",
        "Halal",
    ],
    cuisines: [
        "Italian",
        "Japanese",
        "Mexican",
        "Indian",
        "Chinese",
        "Thai",
        "Middle Eastern",
    ],
    allergies: [
        "Peanuts",
        "Tree Nuts",
        "Gluten",
        "Dairy",
        "Eggs",
        "Soy",
        "Sesame",
        "Shellfish",
        "Fish"
    ],
    flavors: [
        "Sweet",
        "Sour",
        "Salty",
        "Bitter",
        "Umami",
        "Spicy",
        "Smoky",
        "Savory",
        "Fruity",
        "Herbal"
    ]
};

const CATEGORY_META = {
    dietary: { 
        label: "Dietary Preferences",
        selectedBg: "bg-stone-800",
        hoverBg: "hover:bg-stone-100"
    },
    cuisines: { 
        label: "Favorite Cuisines",
        selectedBg: "bg-stone-800",
        hoverBg: "hover:bg-stone-100"
    },
    allergies: { 
        label: "Allergies & Restrictions",
        selectedBg: "bg-red-600",
        hoverBg: "hover:bg-red-50"
    },
    flavors: { 
        label: "Flavor Preferences",
        selectedBg: "bg-stone-800",
        hoverBg: "hover:bg-stone-100"
    }
};

export default function PreferencesStep({ preferences, onSubmit, isLoading }: PreferencesStepProps) {
    const [formData, setFormData] = useState({
        dietary: preferences.dietary || [],
        cuisines: preferences.cuisines || [],
        allergies: preferences.allergies || [],
        flavors: preferences.flavors || [],
        dislikedIngredients: preferences.dislikedIngredients || []
    });

    useEffect(() => {
        setFormData({
            dietary: preferences.dietary || [],
            cuisines: preferences.cuisines || [],
            allergies: preferences.allergies || [],
            flavors: preferences.flavors || [],
            dislikedIngredients: preferences.dislikedIngredients || []
        });
    }, [preferences]);

    const togglePreference = (category: keyof typeof formData, value: string) => {
        setFormData(prev => ({
            ...prev,
            [category]: prev[category].includes(value)
                ? prev[category].filter(item => item !== value)
                : [...prev[category], value]
        }));
    };

    const handleSubmit = () => {
        onSubmit(formData);
    };

    return (
        <div className="min-h-screen bg-stone-50">
            <div className="w-full max-w-3xl mx-auto px-6 py-16">
                {/* Header */}
                <div className="mb-12">
                    <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-3">
                        Food Preferences
                    </h1>
                    <p className="text-stone-500 text-lg">
                        Help us personalize your dish recommendations
                    </p>
                </div>

                {/* Preference Sections */}
                <div className="space-y-10">
                    <PreferenceSection
                        category="dietary"
                        options={OPTIONS.dietary}
                        selected={formData.dietary}
                        onToggle={togglePreference}
                        meta={CATEGORY_META.dietary}
                    />

                    <PreferenceSection
                        category="cuisines"
                        options={OPTIONS.cuisines}
                        selected={formData.cuisines}
                        onToggle={togglePreference}
                        meta={CATEGORY_META.cuisines}
                    />

                    <PreferenceSection
                        category="allergies"
                        options={OPTIONS.allergies}
                        selected={formData.allergies}
                        onToggle={togglePreference}
                        meta={CATEGORY_META.allergies}
                    />

                    <PreferenceSection
                        category="flavors"
                        options={OPTIONS.flavors}
                        selected={formData.flavors}
                        onToggle={togglePreference}
                        meta={CATEGORY_META.flavors}
                    />

                    {/* Disliked Ingredients */}
                    <div>
                        <div className="flex items-baseline justify-between mb-4">
                            <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">
                                Disliked Ingredients
                            </h2>
                            {formData.dislikedIngredients.length > 0 && (
                                <span className="text-sm text-stone-400">
                                    {formData.dislikedIngredients.length} item{formData.dislikedIngredients.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        <textarea
                            value={formData.dislikedIngredients.join(', ')}
                            onChange={(e) => {
                                const value = e.target.value;
                                const ingredients = value
                                    .split(',')
                                    .map(item => item.trim())
                                    .filter(item => item.length > 0);
                                setFormData(prev => ({
                                    ...prev,
                                    dislikedIngredients: ingredients
                                }));
                            }}
                            placeholder="Enter ingredients you dislike, separated by commas (e.g., cilantro, olives, mushrooms)"
                            rows={3}
                            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-lg text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-transparent resize-none transition-all duration-150"
                        />
                        <p className="mt-2 text-sm text-stone-400">
                            We'll avoid recommending dishes with these ingredients
                        </p>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="mt-14 pt-8 border-t border-stone-200">
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="w-full py-4 bg-stone-900 text-white font-medium tracking-wide rounded-lg hover:bg-stone-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-3">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Saving...
                            </span>
                        ) : (
                            "Save Preferences"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

interface PreferenceSectionProps {
    category: string;
    options: string[];
    selected: string[];
    onToggle: (category: any, value: string) => void;
    meta: {
        label: string;
        selectedBg: string;
        hoverBg: string;
    };
}

function PreferenceSection({ category, options, selected, onToggle, meta }: PreferenceSectionProps) {
    return (
        <div>
            {/* Section Header */}
            <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">
                    {meta.label}
                </h2>
                {selected.length > 0 && (
                    <span className="text-sm text-stone-400">
                        {selected.length} selected
                    </span>
                )}
            </div>

            {/* Options */}
            <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                    const isSelected = selected.includes(option);
                    return (
                        <button
                            key={option}
                            onClick={() => onToggle(category, option)}
                            className={`
                                px-4 py-2.5 rounded-lg text-sm font-medium
                                transition-all duration-150
                                ${isSelected 
                                    ? `${meta.selectedBg} text-white` 
                                    : `bg-white text-stone-700 border border-stone-200 ${meta.hoverBg}`
                                }
                            `}
                        >
                            {option}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
