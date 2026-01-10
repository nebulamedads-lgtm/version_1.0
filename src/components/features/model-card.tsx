"use client";

import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, Heart } from "lucide-react";
import { cn, getImageUrl } from "@/lib/utils";
import { useFavorites } from "@/hooks/use-favorites";
import { useViewedModels } from "@/hooks/use-viewed-models";

interface ModelCardProps {
  name: string;
  image: string;
  tags: string[];
  slug: string;
  priority?: boolean;
  isOnline?: boolean;
  is_verified?: boolean;
  is_new?: boolean;
  buttons?: {
    chat: string;
    unlock: string;
  };
}

export function ModelCard({ name, image, tags, slug, priority, isOnline, is_verified, is_new, buttons }: ModelCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isViewed, markAsViewed } = useViewedModels();
  const favorite = isFavorite(slug);
  const viewed = isViewed(slug);
  
  // Use centralized helper for consistent URL handling
  const imageUrl = getImageUrl(image);

  const handleFavoriteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(slug);
  };

  // Mark as viewed when card is clicked (profile visit)
  const handleCardClick = () => {
    markAsViewed(slug);
  };

  return (
    <Link href={`/model/${slug}`} className="block group" onClick={handleCardClick}>
      <Card className={cn(
        "relative overflow-hidden p-0 cursor-pointer",
        "transition-all duration-300 ease-out",
        "hover:scale-[1.02] active:scale-[0.98]",
        // Gold Spark border-top on hover (Rich Gold #D4AF37)
        "border-t-2 border-t-transparent",
        "group-hover:border-t-[oklch(78%_0.13_85)]"
      )}>
        <div className="relative aspect-[3/4]">
          {/* Profile Image: Visual Memory + Monochrome-First aesthetic */}
          <Image
            src={imageUrl}
            alt={name}
            fill
            className={cn(
              "object-cover",
              // Smooth transition for grayscale fade-in (500ms)
              "transition-[filter] duration-500 ease-out",
              // Visual Memory: Viewed models show full color, unviewed are muted (85% grayscale)
              // Hover/focus also unveils color for unviewed cards
              viewed 
                ? "grayscale-0 contrast-100" 
                : "grayscale-[0.85] contrast-[1.1] group-hover:grayscale-0 group-hover:contrast-100 group-focus-within:grayscale-0 group-focus-within:contrast-100"
            )}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={priority}
          />
          {/* Midnight Luxury gradient - subtle tint */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent pointer-events-none" />
          {/* New Badge - Top Left (Electric Emerald accent) */}
          {is_new && (
            <div className="absolute top-3 left-3 z-10">
              <Badge variant="default" className="bg-primary text-primary-foreground border-0 font-semibold shadow-lg shadow-primary/20">
                New
              </Badge>
            </div>
          )}
          {/* Online Status - Top Right */}
          <div className="absolute top-3 right-3 z-10">
            <StatusIndicator isOnline={isOnline} />
          </div>
          {/* Heart Button - Top Right (below status) */}
          <button
            onClick={handleFavoriteClick}
            className="absolute top-12 right-3 z-10 p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 active:scale-95 transition-all"
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart
              size={20}
              className={cn(
                "transition-colors",
                favorite ? "fill-white text-white" : "fill-transparent text-white"
              )}
            />
          </button>
          {/* Name and Tags - Bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-bold text-white">{name}</h3>
              {/* Verified Checkmark - Gold for luxury branding */}
              {is_verified && (
                <BadgeCheck
                  size={18}
                  className="text-[oklch(78%_0.13_85)] flex-shrink-0"
                  strokeWidth={2.5}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: string, index: number) => (
                <span
                  key={index}
                  className="text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function ModelCardSkeleton() {
  return (
    <Card className="relative overflow-hidden p-0">
      <div className="relative aspect-[3/4] bg-muted animate-pulse">
        <div className="absolute top-3 right-3">
          <div className="h-3 w-3 rounded-full bg-muted-foreground/20" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="h-6 w-32 bg-muted-foreground/20 rounded mb-2" />
          <div className="flex flex-wrap gap-2">
            <div className="h-4 w-16 bg-muted-foreground/20 rounded" />
            <div className="h-4 w-20 bg-muted-foreground/20 rounded" />
            <div className="h-4 w-14 bg-muted-foreground/20 rounded" />
          </div>
        </div>
      </div>
    </Card>
  );
}

