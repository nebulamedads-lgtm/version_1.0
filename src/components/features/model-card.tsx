"use client";

import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
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
        // Subtle emerald glow surrounding the card on hover (Electric Emerald #00FF85)
        "border border-transparent",
        "group-hover:border-[#00FF85]/30",
        "group-hover:shadow-[0_0_20px_rgba(0,255,133,0.15),0_0_40px_rgba(0,255,133,0.08)]"
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
              // Visual Memory: Viewed models show full color, unviewed are muted (80% grayscale)
              // Hover/focus also unveils color for unviewed cards
              viewed 
                ? "grayscale-0 contrast-100" 
                : "grayscale-[0.80] contrast-[1.1] group-hover:grayscale-0 group-hover:contrast-100 group-focus-within:grayscale-0 group-focus-within:contrast-100"
            )}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={priority}
          />
          {/* Vignette overlay for unviewed profiles - dark edges to signal "unseen" */}
          <div 
            className={cn(
              "absolute inset-0 pointer-events-none transition-opacity duration-500 ease-out",
              // Radial gradient: transparent center, dark edges (vignette effect)
              viewed 
                ? "opacity-0" 
                : "opacity-100 group-hover:opacity-0 group-focus-within:opacity-0"
            )}
            style={{
              background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.86) 100%)"
            }}
          />
          {/* Subtle gradient overlay - clean fade for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />
          {/* Bottom readability vignette - ensures white text visibility on bright photos */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 25%, transparent 50%)"
            }}
          />
          {/* Favorite Button - Top Left - Pill Style (same height as New tag) */}
          <button
            onClick={handleFavoriteClick}
            className="absolute top-3 left-3 z-10 inline-flex items-center justify-center px-3 py-1 text-xs rounded-full bg-black/40 backdrop-blur-xl border border-white/20 hover:bg-black/60 hover:border-[#D4AF37]/40 active:scale-95 transition-all duration-300 shadow-lg shadow-black/30"
            aria-label={favorite ? "Remove from starred" : "Add to starred"}
          >
            <Star
              size={16}
              className={cn(
                "transition-all duration-300",
                favorite 
                  ? "fill-[#D4AF37] text-[#D4AF37] drop-shadow-[0_0_8px_rgba(212,175,55,0.7)]" 
                  : "fill-transparent text-white/90 hover:text-[#D4AF37]/70"
              )}
            />
          </button>
          {/* New Badge with Online Dot - Top Right (same level as Favorite) */}
          {is_new ? (
            <div className="absolute top-3 right-3 z-10">
              <span className="inline-flex items-center gap-2 px-3 py-1 pr-2 rounded-full text-xs font-semibold bg-[#7A27FF]/50 backdrop-blur-xl text-white border border-[#7A27FF]/50 shadow-[0_0_15px_rgba(122,39,255,0.4)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8),0_1px_2px_rgba(0,0,0,0.6)]">
                New
                <StatusIndicator isOnline={isOnline} />
              </span>
            </div>
          ) : (
            <div className="absolute top-3 right-3 z-10">
              <StatusIndicator isOnline={isOnline} />
            </div>
          )}
          {/* Name and Tags - Bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            {/* Centered name container */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <h3 className="text-lg font-bold text-white text-center tracking-tight">{name}</h3>
              {is_verified && (
                <span className="relative inline-flex items-center justify-center flex-shrink-0">
                  {/* Verified Badge - Custom SVG from public/verified-badge.svg */}
                  <img
                    src="/verified-badge.svg"
                    alt="Verified"
                    className="w-5 h-5 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                    width={20}
                    height={20}
                  />
                </span>
              )}
            </div>
            {/* Tags - limited to 2-3, first tag always visible (left-aligned) with pill shape and right fade */}
            <div className="relative">
              <div className="flex items-center justify-start gap-2 overflow-x-auto scrollbar-hide px-2 py-1 rounded-full bg-black/20 backdrop-blur-sm">
                {tags.slice(0, 3).map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="text-xs text-white/70 whitespace-nowrap flex-shrink-0"
                  >
                    {tag}{index < Math.min(tags.length, 3) - 1 && <span className="ml-2 text-white/40">•</span>}
                  </span>
                ))}
              </div>
              {/* Right fade overlay - iOS 26 style subtle vanish effect */}
              <div 
                className="absolute top-0 right-0 bottom-0 w-12 pointer-events-none rounded-r-full"
                style={{
                  background: "linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.15) 60%, rgba(0, 0, 0, 0.4) 100%)"
                }}
              />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function ModelCardSkeleton() {
  return (
    <Card className="relative overflow-hidden p-0 border border-white/10">
      <div className="relative aspect-[3/4] bg-white/5 backdrop-blur-sm animate-pulse">
        {/* Glass status indicator skeleton */}
        <div className="absolute top-3 right-3">
          <div className="h-4 w-4 rounded-full bg-white/10 backdrop-blur-sm border border-white/10" />
        </div>
        {/* Glass favorite pill skeleton */}
        <div className="absolute top-3 left-3">
          <div className="h-6 w-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/10" />
        </div>
        {/* Frosted bottom info skeleton */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/40 to-transparent backdrop-blur-[2px]">
          <div className="h-6 w-32 bg-white/15 rounded-lg mb-2 backdrop-blur-sm" />
          <div className="flex flex-wrap gap-2">
            <div className="h-4 w-16 bg-white/10 rounded-full backdrop-blur-sm" />
            <div className="h-4 w-20 bg-white/10 rounded-full backdrop-blur-sm" />
            <div className="h-4 w-14 bg-white/10 rounded-full backdrop-blur-sm" />
          </div>
        </div>
      </div>
    </Card>
  );
}

