

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
    isLoading?: boolean;
  }

export default function RecommendationsStep({ recommendations, isLoading = false}: RecommendationsStepProps) {

    return (
        <></>
    )
}