import { Camera, LoaderPinwheel, RotateCcw, X, Upload, RefreshCw } from "lucide-react";
import StepIndicator from "./StepIndicator";
import DishDetailModal from "./DishDetailModal";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Dish {
  id?: number;
  name: string;
  description: string;
  imageUrl: string;
  metadata?: {
    thumbnailUrl?: string | null;
    allImageUrls?: string[];
    [key: string]: unknown;
  };
}

interface UploadStepProps {
  onDishesDetected: (dishes: Dish[], imageBase64: string) => void;
  detectedDishes: Dish[];
  onGetRecommendations?: () => void;
  onPreviousStep?: () => void;
  onScanAnotherMenu?: () => void;
  isLoading?: boolean;
}

export default function UploadStep({ onDishesDetected, detectedDishes, onGetRecommendations, onPreviousStep, onScanAnotherMenu, isLoading = false }: UploadStepProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [showCamera, setShowCamera] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [uploadedImage, setUploadedImage] = useState<string>("");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [imageQuotaExceeded, setImageQuotaExceeded] = useState(false);
  const { toast } = useToast();

  // Check if device is mobile on component mount
  useEffect(() => {
    const checkIfMobile = () => {
      const userAgent = navigator.userAgent;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(isMobileDevice || isTouchDevice);
    };
    checkIfMobile();
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Reset local state when dishes are cleared (scan another menu)
  useEffect(() => {
    if (detectedDishes.length === 0) {
      setUploadedImage("");
      setIsProcessing(false);
      setIsUploading(false);
      setImageQuotaExceeded(false);
    }
  }, [detectedDishes.length]);


  const startCamera = async () => {
    setCameraLoading(true);
    try {
      // checks if the browser supports the Camera API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported');
      }

      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 }
        }
      };

      //requests access to camera
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);


      if (videoRef.current) {
        // connect stream to a <video> element
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        const video = videoRef.current;
        video.onloadedmetadata = () => {
          video.play().then(() => {
            setCameraLoading(false);
            setShowCamera(true);
          }).catch(() => {
            setCameraLoading(false);
            toast({
              title: "Camera error",
              description: "Unable to start camera preview. Please try again.",
              variant: "destructive",
            });
          });
        };

        // Fallback timeout
        setTimeout(() => {
          if (cameraLoading) {
            setCameraLoading(false);
            setShowCamera(true);
          }
        }, 3000);
      }
    } catch (error) {
      setCameraLoading(false);
      let errorMessage = "Please allow camera access to take photos directly, or use the file upload option.";

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = "Camera access was denied. Please allow camera access and try again.";
        } else if (error.name === 'NotFoundError') {
          errorMessage = "No camera found on this device.";
        } else if (error.name === 'NotSupportedError') {
          errorMessage = "Camera is not supported on this device.";
        }
      }

      toast({
        title: "Camera access error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };


  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);

    if (cameraStream) {
      stopCamera();
      // Small delay to ensure camera is fully stopped before restarting
      setTimeout(() => {
        setFacingMode(newFacingMode);
        startCamera();
      }, 100);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      toast({
        title: "Camera error",
        description: "Camera is not ready. Please try again.",
        variant: "destructive",
      });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      toast({
        title: "Capture error",
        description: "Unable to capture photo. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Check if video has loaded and has dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast({
        title: "Camera not ready",
        description: "Please wait for the camera to fully load before taking a photo.",
        variant: "destructive",
      });
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas - take a screenshot 
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to base64 
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);

    // Validate that we got a proper image
    if (!base64Image || base64Image === 'data:,') {
      toast({
        title: "Capture failed",
        description: "Failed to capture photo. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Stop camera
    stopCamera();

    // Set uploaded image and process
    setUploadedImage(base64Image);
    processImage(base64Image);
  };

  // Shared helper function to process a file (used by both file input and drag & drop)
  const processFile = async (file: File) => {
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Check file type - only allow formats supported by OpenAI Vision
    const supportedFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!supportedFormats.includes(file.type.toLowerCase())) {
      toast({
        title: "Unsupported image format",
        description: "Please upload a PNG, JPEG, GIF, or WebP image",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // browser tool to read files
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target?.result as string;
        setUploadedImage(base64Image);
        setIsUploading(false);
        await processImage(base64Image);
      };
      reader.readAsDataURL(file); //executed first, then onload is called
    } catch (error) {
      setIsUploading(false);
      toast({
        title: "Upload failed",
        description: `Error uploading image: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // takes a base64 image string, converts it back to a binary file, sends it to your server for AI analysis, and handles the response
  const processImage = async (base64Image: string) => {
    setIsProcessing(true);

    try {
      // creates a form data object to send the image to the server
      const formData = new FormData();
      // Get the raw base64 data without the prefix
      const base64Data = base64Image.split(',')[1] || base64Image;

      // convert back to binary file
      const byteCharacters = atob(base64Data);
      const byteArrays = [];

      for (let i = 0; i < byteCharacters.length; i += 512) {
        const slice = byteCharacters.slice(i, i + 512);
        const byteNumbers = new Array(slice.length);

        for (let j = 0; j < slice.length; j++) {
          byteNumbers[j] = slice.charCodeAt(j);
        }

        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }

      // blob - Binary Large Object - a file-like object that represents the image
      const blob = new Blob(byteArrays, { type: 'image/jpeg' });
      formData.append("image", blob);

      // Send to backend
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to analyze image");
      }

      const data = await response.json();

      if (data.dishes && data.dishes.length > 0) {
        onDishesDetected(data.dishes, base64Image);
        
        // Check if image quota was exceeded
        if (data.imageQuotaExceeded) {
          setImageQuotaExceeded(true);
        }
        
        toast({
          title: "Dishes detected!",
          description: `Found ${data.dishes.length} dishes in your image`,
        });
      } else {
        toast({
          title: "No dishes detected",
          description: "We couldn't identify any dishes in your image. Please try a clearer photo.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: `Error analyzing image: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // Camera interface component
  if (showCamera || cameraLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900">
        <div className="relative w-full h-full">
          {/* Camera feed */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />

          {/* Hidden canvas for capturing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Loading overlay */}
          {cameraLoading && (
            <div className="absolute inset-0 bg-stone-900/80 flex items-center justify-center">
              <div className="text-stone-50 text-center">
                <div className="animate-spin h-12 w-12 border-4 border-stone-50 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-lg font-light tracking-tight">Starting camera...</p>
                <p className="text-sm text-stone-400 mt-2">Please allow camera access</p>
              </div>
            </div>
          )}

          {/* Camera controls */}
          {!cameraLoading && (
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-stone-900/90 to-transparent">
              <div className="flex items-center justify-between max-w-md mx-auto">
                {/* Close camera */}
                <button
                  onClick={stopCamera}
                  className="w-12 h-12 rounded-full bg-stone-800/80 text-stone-50 hover:bg-stone-700 transition-colors duration-200 flex items-center justify-center"
                >
                  <X className="h-6 w-6" />
                </button>

                {/* Capture button */}
                <button
                  onClick={capturePhoto}
                  className="w-20 h-20 rounded-full bg-stone-50 hover:bg-stone-200 transition-colors duration-200 flex items-center justify-center"
                >
                  <div className="w-16 h-16 rounded-full border-4 border-stone-300" />
                </button>

                {/* Switch camera */}
                <button
                  onClick={switchCamera}
                  className="w-12 h-12 rounded-full bg-stone-800/80 text-stone-50 hover:bg-stone-700 transition-colors duration-200 flex items-center justify-center"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Tips overlay */}
          {!cameraLoading && (
            <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-stone-900/80 to-transparent">
              <div className="text-stone-50 text-center max-w-md mx-auto">
                <h3 className="font-medium tracking-tight mb-1">Position menu in frame</h3>
                <p className="text-sm text-stone-400">Make sure dish names and descriptions are visible</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

    return (
        <div className="min-h-screen bg-stone-50">
            {/* Step Indicator */}
            <StepIndicator currentStep={2} />

            <div className="w-full max-w-3xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-12">
                    <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-3">
                        Upload Menu Photo
                    </h1>
                    <p className="text-stone-500 text-lg">
                        Take a photo of a menu to get personalized dish recommendations
                    </p>
                </div>

                {/* Upload Area */}
                {!detectedDishes.length ? (
                    <div className="space-y-6">
                        <div
                            className="border-2 border-dashed border-stone-300 rounded-lg p-12 bg-white flex flex-col items-center justify-center text-center transition-colors duration-200 hover:border-stone-400"
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            {!isUploading && !isProcessing && !uploadedImage ? (
                                <>
                                    <div className="h-16 w-16 rounded-full bg-stone-100 flex items-center justify-center mb-6">
                                        <Upload className="h-8 w-8 text-stone-400" />
                                    </div>
                                    <h3 className="text-xl font-light text-stone-900 mb-2">
                                        {isMobile ? "Capture or upload menu" : "Drop your menu image here"}
                                    </h3>
                                    <p className="text-stone-500 mb-6 max-w-sm">
                                        {isMobile 
                                            ? "Take a photo or choose from your gallery" 
                                            : "Drag & drop an image, or click to browse"}
                                    </p>

                                    {/* Action buttons */}
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        {isMobile && (
                                            <button
                                                onClick={startCamera}
                                                className="py-3 px-6 bg-stone-900 text-white font-medium rounded-lg hover:bg-stone-800 transition-colors duration-200 flex items-center justify-center gap-2"
                                            >
                                                <Camera className="h-5 w-5" />
                                                Take Photo
                                            </button>
                                        )}
                                        <button
                                            onClick={() => document.getElementById("menu-image")?.click()}
                                            className={`py-3 px-6 font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 ${
                                                isMobile 
                                                    ? "border border-stone-300 text-stone-700 hover:bg-stone-100" 
                                                    : "bg-stone-900 text-white hover:bg-stone-800"
                                            }`}
                                        >
                                            <Upload className="h-5 w-5" />
                                            {isMobile ? "Choose from Gallery" : "Choose Image"}
                                        </button>
                                    </div>

                                    <input
                                        type="file"
                                        id="menu-image"
                                        accept="image/png,image/jpeg,image/gif,image/webp"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </>
                            ) : isUploading ? (
                                <div className="py-12 flex flex-col items-center">
                                    <div className="animate-spin h-12 w-12 border-4 border-stone-900 border-t-transparent rounded-full mb-4"></div>
                                    <p className="text-stone-500">Uploading image...</p>
                                </div>
                            ) : isProcessing ? (
                                <div className="py-12 flex flex-col items-center">
                                    <div className="animate-spin h-12 w-12 border-4 border-stone-900 border-t-transparent rounded-full mb-4"></div>
                                    <p className="text-stone-900 font-medium mb-1">Analyzing your menu</p>
                                    <p className="text-stone-500">This may take a moment...</p>
                                </div>
                            ) : (
                                <div className="relative w-full">
                                    <img
                                        src={uploadedImage}
                                        alt="Uploaded menu"
                                        className="max-h-80 max-w-full mx-auto rounded-lg"
                                    />
                                    <div className="absolute inset-0 bg-stone-900/50 flex items-center justify-center rounded-lg">
                                        <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full"></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!isUploading && !isProcessing && !uploadedImage && (
                            <p className="text-center text-stone-400 text-sm">
                                <span className="font-medium">Tip:</span> Try to capture a clear, well-lit image of the menu
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Image quota exceeded warning */}
                        {imageQuotaExceeded && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                                <span className="text-xl">😔</span>
                                <div>
                                    <h3 className="font-medium text-amber-800">Image limit reached</h3>
                                    <p className="text-sm text-amber-700 mt-1">
                                        Sorry! Daily limit for image generation exceeded. Some dishes may not have photos. The limit resets tomorrow.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">
                                    Detected Dishes
                                </h2>
                                <span className="text-sm text-stone-400">
                                    {detectedDishes.length} item{detectedDishes.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            {onScanAnotherMenu && (
                                <button
                                    onClick={onScanAnotherMenu}
                                    className="py-2 px-4 text-stone-600 text-sm font-medium border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors duration-200 flex items-center gap-2"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Scan Another Menu
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {detectedDishes.map((dish, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSelectedDish(dish)}
                                    className="bg-white border border-stone-200 rounded-lg p-4 flex gap-4 text-left hover:border-stone-400 hover:shadow-md transition-all duration-200 cursor-pointer"
                                >
                                    {dish.imageUrl ? (
                                        <img
                                            src={dish.imageUrl}
                                            alt={dish.name}
                                            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'https://placehold.co/80x80?text=No+Image';
                                            }}
                                        />
                                    ) : (
                                        <div className="w-20 h-20 bg-stone-100 flex items-center justify-center rounded-lg text-stone-400 text-xs flex-shrink-0">
                                            No Image
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-stone-900 truncate">{dish.name}</h4>
                                        <p className="text-stone-500 text-sm line-clamp-2">{dish.description}</p>
                                        <p className="text-stone-400 text-xs mt-1">Tap to view details</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="mt-14 pt-8 border-t border-stone-200">
                    <div className="flex justify-between">
                        {onPreviousStep && (
                            <button
                                onClick={onPreviousStep}
                                className="py-4 px-6 border border-stone-300 text-stone-600 font-medium tracking-wide rounded-lg hover:bg-stone-100 transition-colors duration-200 flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to Preferences
                            </button>
                        )}

                        {onGetRecommendations && (
                            <button
                                onClick={onGetRecommendations}
                                disabled={isLoading || detectedDishes.length === 0}
                                className="py-4 px-6 bg-stone-900 text-white font-medium tracking-wide rounded-lg hover:bg-stone-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-auto"
                            >
                                {isLoading ? (
                                    <>
                                        <LoaderPinwheel className="h-5 w-5 animate-spin" />
                                        Getting recommendations...
                                    </>
                                ) : (
                                    <>
                                        Get Recommendations
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Dish Detail Modal */}
            <DishDetailModal
                dish={selectedDish}
                isOpen={!!selectedDish}
                onClose={() => setSelectedDish(null)}
            />
        </div>
    );
}
