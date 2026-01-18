"use client";

export default function SkeletonLoader({ type = "card", count = 1 }) {
    const skeletons = Array.from({ length: count }, (_, i) => i);

    if (type === "map") {
        return <MapSkeleton />;
    }

    if (type === "list") {
        return (
            <div className="space-y-4">
                {skeletons.map((i) => (
                    <ListItemSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (type === "card") {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {skeletons.map((i) => (
                    <CardSkeleton key={i} />
                ))}
            </div>
        );
    }

    return <CardSkeleton />;
}

// Map Skeleton
function MapSkeleton() {
    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-gray-200 to-gray-300 px-6 py-4">
                <div className="h-6 bg-gray-300 rounded w-1/3 animate-shimmer"></div>
            </div>
            <div className="h-[600px] bg-gray-100 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer"></div>
                {/* Fake map markers */}
                <div className="absolute top-1/4 left-1/4 w-8 h-8 bg-gray-300 rounded-full animate-pulse"></div>
                <div className="absolute top-1/2 right-1/3 w-8 h-8 bg-gray-300 rounded-full animate-pulse delay-100"></div>
                <div className="absolute bottom-1/3 left-1/2 w-8 h-8 bg-gray-300 rounded-full animate-pulse delay-200"></div>
            </div>
        </div>
    );
}

// List Item Skeleton
function ListItemSkeleton() {
    return (
        <div className="bg-white rounded-lg shadow-md p-4 animate-fade-in-up">
            <div className="flex items-start gap-4">
                {/* Icon placeholder */}
                <div className="w-12 h-12 bg-gray-200 rounded-full animate-shimmer flex-shrink-0"></div>

                {/* Content */}
                <div className="flex-1 space-y-3">
                    {/* Title */}
                    <div className="h-5 bg-gray-200 rounded w-3/4 animate-shimmer"></div>

                    {/* Details */}
                    <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-full animate-shimmer"></div>
                        <div className="h-4 bg-gray-200 rounded w-5/6 animate-shimmer"></div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-4 pt-2">
                        <div className="h-3 bg-gray-200 rounded w-20 animate-shimmer"></div>
                        <div className="h-3 bg-gray-200 rounded w-24 animate-shimmer"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Card Skeleton
function CardSkeleton() {
    return (
        <div className="bg-white rounded-lg shadow-md p-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full animate-shimmer"></div>
                <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-2/3 mb-2 animate-shimmer"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 animate-shimmer"></div>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-full animate-shimmer"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6 animate-shimmer"></div>
                <div className="h-4 bg-gray-200 rounded w-4/6 animate-shimmer"></div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between">
                    <div className="h-4 bg-gray-200 rounded w-1/4 animate-shimmer"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4 animate-shimmer"></div>
                </div>
            </div>
        </div>
    );
}

// Stats Skeleton
export function StatsSkeleton({ count = 4 }) {
    const skeletons = Array.from({ length: count }, (_, i) => i);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {skeletons.map((i) => (
                <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-fade-in-up">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <div className="h-3 bg-gray-200 rounded w-2/3 mb-3 animate-shimmer"></div>
                            <div className="h-8 bg-gray-200 rounded w-1/2 animate-shimmer"></div>
                        </div>
                        <div className="w-10 h-10 bg-gray-200 rounded-full animate-shimmer"></div>
                    </div>
                </div>
            ))}
        </div>
    );
}
