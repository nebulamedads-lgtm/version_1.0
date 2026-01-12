"use client";

import { useMemo } from "react";
import { useQueryState } from "nuqs";
import dynamic from "next/dynamic";
import { StoryGroup } from "@/types";
import { StoryCircle } from "./story-circle";

// Lazy load StoryViewer - modal that is hidden by default, should NOT be in initial bundle
const StoryViewer = dynamic(() => import("./story-viewer").then(mod => ({ default: mod.StoryViewer })), {
  ssr: false
});

interface StoriesContainerProps {
  groups?: StoryGroup[];
  socialLink?: string;
  modelName?: string;
  modelImage?: string;
  modelSlug?: string;
  isVerified?: boolean;
}

export function StoriesContainer({ groups, socialLink, modelName, modelImage, modelSlug, isVerified }: StoriesContainerProps) {
  // URL state management with nuqs - syncs with browser history
  // history: 'push' creates entries in browser history for back button support
  const [storyId, setStoryId] = useQueryState("story", {
    defaultValue: "",
    clearOnDefault: true,
    history: "push",
  });

  // Safety check: Return null if groups is undefined or empty
  // This allows the layout to collapse neatly when no stories are available
  if (!groups || groups.length === 0) {
    return null;
  }

  // Separate pinned and feed groups for isolated navigation
  const pinnedGroups = useMemo(
    () => groups.filter((g) => g.is_pinned && g.stories && g.stories.length > 0),
    [groups]
  );
  const feedGroups = useMemo(
    () => groups.filter((g) => !g.is_pinned && g.stories && g.stories.length > 0),
    [groups]
  );

  // Find selected group based on URL param
  const selectedGroup = storyId
    ? groups.find((g) => g.id === storyId)
    : null;

  // Determine which list the active group belongs to and calculate neighbors
  const { nextGroupId, prevGroupId } = useMemo(() => {
    if (!selectedGroup) return { nextGroupId: undefined, prevGroupId: undefined };

    // Determine if this is a pinned or feed group
    const isPinned = selectedGroup.is_pinned;
    const relevantList = isPinned ? pinnedGroups : feedGroups;

    // Find current index in the relevant list
    const currentIndex = relevantList.findIndex((g) => g.id === selectedGroup.id);

    if (currentIndex === -1) {
      return { nextGroupId: undefined, prevGroupId: undefined };
    }

    // Calculate neighbors within the same list only
    const nextGroup = currentIndex < relevantList.length - 1 ? relevantList[currentIndex + 1] : undefined;
    const prevGroup = currentIndex > 0 ? relevantList[currentIndex - 1] : undefined;

    return {
      nextGroupId: nextGroup?.id,
      prevGroupId: prevGroup?.id,
    };
  }, [selectedGroup, pinnedGroups, feedGroups]);

  // Handle circle click - open story viewer (updates URL)
  const handleStoryClick = (groupId: string) => {
    setStoryId(groupId);
  };

  // Handle close viewer (removes URL param)
  const handleCloseViewer = () => {
    setStoryId(null);
  };

  // Handle navigation between groups (uses replace to avoid history pollution)
  const handleNavigate = (groupId: string) => {
    setStoryId(groupId, { history: "replace" });
  };

  return (
    <>
      {/* Mobile: Horizontal scrollable row - Glass panel wrapper */}
      {/* -mx-4 breaks out of parent's px-4 padding, w-[calc(100%+2rem)] compensates for full width */}
      <div className="lg:hidden w-[calc(100%+2rem)] overflow-x-auto scrollbar-hide -mx-4 bg-background/30 backdrop-blur-xl border-y border-white/10">
        <div className="flex gap-3 py-4 px-1">
          {groups.map((group, index) => (
            <div 
              key={group.id} 
              className={index === groups.length - 1 ? "pr-4" : ""}
            >
              <StoryCircle
                group={group}
                onClick={() => handleStoryClick(group.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: Vertical list - Glass panel */}
      <div className="hidden lg:block lg:p-4 bg-background/30 backdrop-blur-xl rounded-2xl border border-white/10 mt-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 text-center">
          Stories
        </h3>
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <StoryCircle
              key={group.id}
              group={group}
              onClick={() => handleStoryClick(group.id)}
            />
          ))}
        </div>
      </div>

      {/* Story Viewer Modal - Render when URL param exists and group is found */}
      {storyId && selectedGroup && (() => {
        // Determine which list the selected group belongs to
        const isPinned = selectedGroup.is_pinned;
        const relevantList = isPinned ? pinnedGroups : feedGroups;
        
        // Find current index in the relevant list
        const currentIndex = relevantList.findIndex((g) => g.id === selectedGroup.id);
        
        // Get next and previous groups for preview
        const nextGroup = currentIndex >= 0 && currentIndex < relevantList.length - 1
          ? relevantList[currentIndex + 1]
          : null;
        const prevGroup = currentIndex > 0
          ? relevantList[currentIndex - 1]
          : null;
        
        // Create preview data - use first story image from next/prev group (Instagram-style)
        return (
          <StoryViewer
            group={selectedGroup}
            onClose={handleCloseViewer}
            socialLink={socialLink}
            modelName={modelName}
            modelImage={modelImage}
            modelSlug={modelSlug}
            isVerified={isVerified}
            nextGroupId={nextGroupId}
            prevGroupId={prevGroupId}
            onNavigate={handleNavigate}
            disableLongPress={true}
          />
        );
      })()}
    </>
  );
}
