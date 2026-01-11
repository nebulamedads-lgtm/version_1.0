"use client";

import { useQueryState } from "nuqs";
import dynamic from "next/dynamic";
import { Model, StoryGroup } from "@/types";
import { StoryCircle } from "./story-circle";
import { cn } from "@/lib/utils";
import { useViewedStories } from "@/hooks/use-viewed-stories";

// Lazy load StoryViewer - modal that is hidden by default, should NOT be in initial bundle
const StoryViewer = dynamic(() => import("./story-viewer").then(mod => ({ default: mod.StoryViewer })), {
  ssr: false
});

interface HomeStoriesBarProps {
  models: Model[];
}

export function HomeStoriesBar({ models }: HomeStoriesBarProps) {
  // Read current feed from URL - only show on 'near' feed
  const [feed] = useQueryState("feed", { defaultValue: "near" });
  
  // Visual Memory: Track which stories have been viewed
  const { isViewed } = useViewedStories();
  
  // URL state management with nuqs - syncs with browser history
  const [storyId, setStoryId] = useQueryState("story", {
    defaultValue: "",
    clearOnDefault: true,
    history: "push",
  });

  // Only render on 'near' feed
  if (feed !== "near") {
    return null;
  }

  // Find the selected model and group based on URL param
  // Format: storyId = "modelId:groupId" or just "groupId" if we can infer model
  const selectedModel = storyId
    ? models.find((model) => {
        // Check if any of this model's story groups match the storyId
        return model.story_groups?.some((group) => group.id === storyId);
      })
    : null;

  const selectedGroup = storyId && selectedModel
    ? selectedModel.story_groups?.find((group) => group.id === storyId)
    : null;

  // Handle circle click - open story viewer with recent group
  const handleRecentGroupClick = (groupId: string) => {
    setStoryId(groupId);
  };

  // Handle close viewer (removes URL param)
  const handleCloseViewer = () => {
    setStoryId(null);
  };

  // Filter models with recent groups and extract the recent group
  const modelsWithRecentGroups = models
    .map((model) => {
      // Find the specific recent (unpinned) group with stories
      const recentGroup = model.story_groups?.find(
        (g) => !g.is_pinned && g.stories && g.stories.length > 0
      );

      // Return null if no recent group found
      if (!recentGroup) {
        return null;
      }

      // Get the most recent story for the preview
      const sortedStories = [...(recentGroup.stories || [])].sort((a, b) => {
        const dateA = new Date(a.posted_date || a.created_at);
        const dateB = new Date(b.posted_date || b.created_at);
        return dateB.getTime() - dateA.getTime(); // Newest first
      });
      const latestStory = sortedStories[0];
      const latestStoryDate = latestStory ? new Date(latestStory.posted_date || latestStory.created_at) : new Date(0);
      
      // For cover: use media_url only if it's an image, for videos use group's cover_url (poster)
      const latestStoryMedia = latestStory?.media_type === 'video' 
        ? null  // Don't use video URL as cover
        : latestStory?.media_url;

      // Create display group with proper cover fallback:
      // 1. Use the most recent IMAGE story's media (like Instagram)
      // 2. Fall back to group's cover_url (which is poster for videos)
      // 3. Fall back to model's profile image (last resort)
      const displayGroup: StoryGroup = {
        ...recentGroup,
        title: model.name, // Show model name, not "Recent"
        cover_url: latestStoryMedia || recentGroup.cover_url || model.image_url || '',
      };

      // Check if this story group has been viewed (Visual Memory)
      const viewed = isViewed(recentGroup.id);

      return { model, recentGroup, displayGroup, latestStoryDate, viewed };
    })
    .filter((item): item is { model: Model; recentGroup: StoryGroup; displayGroup: StoryGroup; latestStoryDate: Date; viewed: boolean } => item !== null)
    // Instagram-style sorting: Unviewed first, then viewed. Within each group, sort by newest first
    .sort((a, b) => {
      // Primary sort: Unviewed stories first (false < true in boolean, so !viewed gives priority)
      if (a.viewed !== b.viewed) {
        return a.viewed ? 1 : -1; // Unviewed (false) comes before viewed (true)
      }
      // Secondary sort: Newest first within same viewed status
      return b.latestStoryDate.getTime() - a.latestStoryDate.getTime();
    });

  // Don't render if no models with recent groups
  if (modelsWithRecentGroups.length === 0) {
    return null;
  }

  // Playlist Logic: Create array of all recent groups for navigation
  const allRecentGroups = modelsWithRecentGroups.map(({ recentGroup, model }) => ({
    id: recentGroup.id,
    model,
    group: recentGroup,
  }));

  // Find current position in playlist
  const activeIndex = storyId 
    ? allRecentGroups.findIndex((item) => item.id === storyId)
    : -1;

  // Calculate neighbor group IDs for navigation
  const nextGroupId = activeIndex >= 0 && activeIndex < allRecentGroups.length - 1
    ? allRecentGroups[activeIndex + 1]?.id
    : undefined;

  const prevGroupId = activeIndex > 0
    ? allRecentGroups[activeIndex - 1]?.id
    : undefined;

  // Handler for navigating between models' stories
  // Use 'replace' history to avoid creating multiple back button entries
  const handleNavigate = (id: string) => {
    setStoryId(id, { history: 'replace' });
  };

  return (
    <>
      {/* Horizontal Scrollable Container - fully transparent, no background bar */}
      <div className="w-full overflow-x-auto scrollbar-hide bg-transparent backdrop-blur-none relative">
        <div className="flex gap-3 py-4 px-1">
          {modelsWithRecentGroups.map(({ model, recentGroup, displayGroup }, index) => (
            <div
              key={model.id}
              className={cn(
                "flex-shrink-0",
                index === modelsWithRecentGroups.length - 1 && "pr-4"
              )}
            >
              <StoryCircle
                group={displayGroup}
                onClick={() => handleRecentGroupClick(recentGroup.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Story Viewer Modal - Render when URL param exists and group is found */}
      {/* key={selectedGroup.id} forces React to recreate viewer on model change for fresh entry animation */}
      {storyId && selectedGroup && selectedModel && (() => {
        // Get next model preview - use first story image (Instagram-style)
        const nextModelData = activeIndex >= 0 && activeIndex < allRecentGroups.length - 1
          ? allRecentGroups[activeIndex + 1]
          : null;
        const nextGroupStories = nextModelData?.group.stories || [];
        const nextFirstStory = nextGroupStories.length > 0 
          ? [...nextGroupStories].sort((a, b) => {
              const dateA = new Date(a.posted_date || a.created_at);
              const dateB = new Date(b.posted_date || b.created_at);
              return dateA.getTime() - dateB.getTime(); // Oldest first
            })[0]
          : null;
        const nextPreview = nextModelData ? {
          name: nextModelData.model.name,
          imageUrl: nextModelData.model.image_url,
          storyMediaUrl: nextFirstStory?.media_url || nextModelData.group.cover_url,
        } : null;

        // Get prev model preview - use first story image (Instagram-style)
        const prevModelData = activeIndex > 0
          ? allRecentGroups[activeIndex - 1]
          : null;
        const prevGroupStories = prevModelData?.group.stories || [];
        const prevFirstStory = prevGroupStories.length > 0
          ? [...prevGroupStories].sort((a, b) => {
              const dateA = new Date(a.posted_date || a.created_at);
              const dateB = new Date(b.posted_date || b.created_at);
              return dateA.getTime() - dateB.getTime(); // Oldest first
            })[0]
          : null;
        const prevPreview = prevModelData ? {
          name: prevModelData.model.name,
          imageUrl: prevModelData.model.image_url,
          storyMediaUrl: prevFirstStory?.media_url || prevModelData.group.cover_url,
        } : null;

        return (
          <StoryViewer
            key={selectedGroup.id}
            group={selectedGroup}
            onClose={handleCloseViewer}
            socialLink={selectedModel.social_link}
            modelName={selectedModel.name}
            modelImage={selectedModel.image_url}
            modelSlug={selectedModel.slug}
            isVerified={selectedModel.is_verified}
            nextGroupId={nextGroupId}
            prevGroupId={prevGroupId}
            onNavigate={handleNavigate}
            nextModelPreview={nextPreview}
            prevModelPreview={prevPreview}
          />
        );
      })()}
    </>
  );
}
