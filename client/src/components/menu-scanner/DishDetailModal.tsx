import { X, ChefHat, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";

interface DishDetailModalProps {
    dish: {
        name: string;
        description: string;
        imageUrl: string;
        metadata?: {
            thumbnailUrl?: string | null;
            allImageUrls?: string[];
        };
        matchReason?: string;
    } | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function DishDetailModal({ dish, isOpen, onClose }: DishDetailModalProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

    // Get all candidate image URLs
    const allImageUrls = useMemo(() => {
        if (!dish) return [];
        const urls: string[] = [];
        
        // Add allImageUrls from metadata first
        if (dish.metadata?.allImageUrls?.length) {
            urls.push(...dish.metadata.allImageUrls);
        }
        
        // Add main imageUrl if not already included and valid
        if (dish.imageUrl && !urls.includes(dish.imageUrl) && !dish.imageUrl.includes('placehold.co')) {
            urls.unshift(dish.imageUrl);
        }
        
        return urls;
    }, [dish]);

    // Filter to only valid (non-failed) images
    const validImages = useMemo(() => {
        return allImageUrls.filter(url => !failedUrls.has(url));
    }, [allImageUrls, failedUrls]);

    // Reset state when dish changes
    useEffect(() => {
        setCurrentIndex(0);
        setFailedUrls(new Set());
    }, [dish]);

    // Adjust currentIndex if it becomes out of bounds
    useEffect(() => {
        if (currentIndex >= validImages.length && validImages.length > 0) {
            setCurrentIndex(validImages.length - 1);
        }
    }, [validImages.length, currentIndex]);

    // Handle image load error - mark URL as failed
    const handleImageError = useCallback((url: string) => {
        setFailedUrls(prev => new Set(prev).add(url));
    }, []);

    // Navigation handlers
    const goToPrevious = useCallback(() => {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : validImages.length - 1));
    }, [validImages.length]);

    const goToNext = useCallback(() => {
        setCurrentIndex(prev => (prev < validImages.length - 1 ? prev + 1 : 0));
    }, [validImages.length]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft") goToPrevious();
            if (e.key === "ArrowRight") goToNext();
        };
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose, goToPrevious, goToNext]);

    if (!isOpen || !dish) return null;

    const currentImageUrl = validImages[currentIndex];
    const hasMultipleImages = validImages.length > 1;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-all duration-200 group"
                >
                    <X className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                </button>

                {/* Image gallery section */}
                <div className="relative bg-gradient-to-b from-stone-900 to-stone-800">
                    {/* Main image container */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden">
                        {currentImageUrl ? (
                            <img
                                key={currentImageUrl}
                                src={currentImageUrl}
                                alt={dish.name}
                                className="w-full h-full object-cover animate-in fade-in duration-300"
                                onError={() => handleImageError(currentImageUrl)}
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
                                <ChefHat className="w-20 h-20 text-stone-300 mb-3" />
                                <p className="text-stone-400 text-sm">No image available</p>
                            </div>
                        )}

                        {/* Navigation arrows - only show if multiple valid images */}
                        {hasMultipleImages && (
                            <>
                                {/* Left arrow */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        goToPrevious();
                                    }}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-all duration-200 group backdrop-blur-sm"
                                    aria-label="Previous image"
                                >
                                    <ChevronLeft className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                                </button>

                                {/* Right arrow */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        goToNext();
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-all duration-200 group backdrop-blur-sm"
                                    aria-label="Next image"
                                >
                                    <ChevronRight className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                                </button>
                            </>
                        )}

                        {/* Dot indicators - only show if multiple valid images */}
                        {hasMultipleImages && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 px-3 py-2 bg-black/40 rounded-full backdrop-blur-sm">
                                {validImages.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCurrentIndex(index);
                                        }}
                                        className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                                            currentIndex === index 
                                                ? "bg-white scale-110" 
                                                : "bg-white/40 hover:bg-white/70"
                                        }`}
                                        aria-label={`Go to image ${index + 1}`}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Image counter badge */}
                        {validImages.length > 0 && (
                            <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/40 text-white text-sm font-medium rounded-full backdrop-blur-sm">
                                {currentIndex + 1} / {validImages.length}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content section */}
                <div className="p-6 sm:p-8 overflow-y-auto">
                    <h2 className="text-2xl sm:text-3xl font-semibold text-stone-900 mb-4 leading-tight">
                        {dish.name}
                    </h2>
                    
                    <p className="text-stone-600 text-base sm:text-lg leading-relaxed">
                        {dish.description}
                    </p>

                    {/* Match reason if available */}
                    {dish.matchReason && (
                        <div className="mt-6 pt-5 border-t border-stone-200">
                            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl">
                                <span className="text-xl flex-shrink-0">✨</span>
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-amber-700 font-medium mb-1">
                                        Why we recommend this
                                    </p>
                                    <p className="text-sm text-amber-900 leading-relaxed">
                                        {dish.matchReason}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

