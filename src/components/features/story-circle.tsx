"use client";

import Image from "next/image";
import { StoryGroup } from "@/types";
import { cn, getImageUrl } from "@/lib/utils";
import { useViewedStories } from "@/hooks/use-viewed-stories";

interface StoryCircleProps {
  group: StoryGroup;
  onClick: () => void;
}

export function StoryCircle({ group, onClick }: StoryCircleProps) {
  const { isViewed, markAsViewed } = useViewedStories();
  const coverUrl = getImageUrl(group.cover_url);
  const displayTitle = group.title || "Recent";
  
  // Get the latest story ID to detect new stories
  const latestStoryId = group.stories && group.stories.length > 0
    ? group.stories[group.stories.length - 1]?.id
    : undefined;
  
  const viewed = isViewed(group.id, latestStoryId);

  // Handle click: mark as viewed with latest story ID and trigger parent onClick
  const handleClick = () => {
    markAsViewed(group.id, latestStoryId);
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className="flex flex-col items-center gap-1.5 hover:scale-105 active:scale-95 transition-all duration-300"
      aria-label={`View ${displayTitle} stories`}
    >
      {/* Ring Container - iOS Glass style with Visual Memory */}
      <div
        className={cn(
          "w-[76px] h-[76px] rounded-full p-[2.5px] transition-all duration-300 shadow-lg",
          // Viewed stories: Glass gray ring
          viewed && "bg-white/20 shadow-black/20",
          // Unviewed + Recent (not pinned): Electric Emerald to Rich Gold gradient with glow
          !viewed && !group.is_pinned && "bg-gradient-to-tr from-[#00FF85] via-[#D4AF37] to-[#7A27FF] shadow-[0_0_15px_rgba(0,255,133,0.4)]",
          // Unviewed + Pinned: Glass muted ring
          !viewed && group.is_pinned && "bg-white/20 shadow-black/20"
        )}
      >
        {/* Glass border container */}
        <div className="w-full h-full rounded-full p-[2px] bg-background/90 backdrop-blur-sm">
          {/* Image Circle with glass overlay */}
          <div className="relative w-full h-full rounded-full overflow-hidden bg-white/5 backdrop-blur-sm border border-white/10">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={displayTitle}
                fill
                className="w-full h-full object-cover rounded-full"
                sizes="76px"
                unoptimized
              />
            ) : (
              // Fallback gradient: Cyber Violet to Electric Emerald with glass effect
              <div className="w-full h-full bg-gradient-to-br from-[#7A27FF] to-[#00FF85] flex items-center justify-center rounded-full">
                <span className="text-white text-xl font-bold drop-shadow-lg">
                  {displayTitle.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Title Text - Glass pill */}
      <span className="text-xs text-center w-20 truncate text-foreground/80 px-2 py-0.5 rounded-full bg-white/5 backdrop-blur-sm">
        {displayTitle}
      </span>
    </button>
  );
}
