"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
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
  const { hasUnseenStories, getFirstUnseenStoryIndex } = useViewedStories();
  
  // URL state management with nuqs - syncs with browser history
  const [storyId, setStoryId] = useQueryState("story", {
    defaultValue: "",
    clearOnDefault: true,
    history: "push",
  });
  
  // Story index parameter for resume playback (si = story index)
  const [storyIndexParam, setStoryIndexParam] = useQueryState("si", {
    defaultValue: "",
    clearOnDefault: true,
    history: "push",
    parse: (value) => {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? "" : parsed.toString();
    },
    serialize: (value) => value,
  });
  
  // Parse story index from URL (defaults to 0 if not provided or invalid)
  const initialStoryIndexFromUrl = storyIndexParam ? parseInt(storyIndexParam, 10) : 0;

  // Clear story params when switching away from 'near' feed
  useEffect(() => {
    if (feed !== "near" && (storyId || storyIndexParam)) {
      setStoryId(null, { history: "replace" });
      setStoryIndexParam(null, { history: "replace" });
    }
  }, [feed, storyId, storyIndexParam, setStoryId, setStoryIndexParam]);

  // Filter models with recent groups and extract the recent group
  // Use useMemo to optimize sorting and re-run when viewedStoryIds changes
  // IMPORTANT: This hook must be called before any early returns to follow Rules of Hooks
  const modelsWithRecentGroups = useMemo(() => {
    // Return empty array if not on 'near' feed to avoid unnecessary computation
    if (feed !== "near") {
      return [];
    }
    
    return models
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

        // Check if this story group has unseen stories (Visual Memory)
        // Groups with unseen stories should appear first
        const hasUnseen = hasUnseenStories(recentGroup.stories || []);

        return { model, recentGroup, displayGroup, latestStoryDate, hasUnseen };
      })
      .filter((item): item is { model: Model; recentGroup: StoryGroup; displayGroup: StoryGroup; latestStoryDate: Date; hasUnseen: boolean } => item !== null)
      // Instagram-style sorting: Groups with unseen stories first, then fully viewed. Within each group, sort by newest first
      .sort((a, b) => {
        // Primary sort: Groups with unseen stories first
        if (a.hasUnseen && !b.hasUnseen) return -1;
        if (!a.hasUnseen && b.hasUnseen) return 1;
        // Secondary sort: Newest first within same unseen status
        return b.latestStoryDate.getTime() - a.latestStoryDate.getTime();
      });
  }, [models, hasUnseenStories, feed]);

  // Split groups into seen/unseen chains for isolated navigation
  const unseenGroups = useMemo(() => {
    return modelsWithRecentGroups
      .filter(({ hasUnseen }) => hasUnseen)
      .map(({ recentGroup }) => recentGroup);
  }, [modelsWithRecentGroups]);

  const seenGroups = useMemo(() => {
    return modelsWithRecentGroups
      .filter(({ hasUnseen }) => !hasUnseen)
      .map(({ recentGroup }) => recentGroup);
  }, [modelsWithRecentGroups]);

  // Store chain neighbors at open time to prevent dynamic changes mid-viewing
  const [activeChainNeighbors, setActiveChainNeighbors] = useState<{
    prevGroupId: string | null;
    nextGroupId: string | null;
  } | null>(null);
  
  // Store snapshot of chain group IDs at open time to maintain chain isolation
  // This prevents groups from disappearing from the chain mid-navigation
  const [activeChainGroupIds, setActiveChainGroupIds] = useState<string[] | null>(null);

  // Calculate neighbors for a group based on its chain membership
  // If chainGroupIds is provided, use that snapshot instead of current chain arrays
  const getNeighborsForGroup = useCallback((groupId: string, chainGroupIds?: string[]) => {
    // Use snapshot if provided (for maintaining chain during navigation)
    if (chainGroupIds) {
      const indexInChain = chainGroupIds.findIndex((id) => id === groupId);
      if (indexInChain === -1) {
        return { prevGroupId: null, nextGroupId: null };
      }
      return {
        prevGroupId: indexInChain > 0 ? chainGroupIds[indexInChain - 1] : null,
        nextGroupId: indexInChain < chainGroupIds.length - 1 ? chainGroupIds[indexInChain + 1] : null,
      };
    }

    // Otherwise, determine from group's current seen status (for initial open)
    const groupData = modelsWithRecentGroups.find(({ recentGroup }) => recentGroup.id === groupId);
    if (!groupData) {
      // Fallback: try to find in either chain
      const inUnseen = unseenGroups.find((g) => g.id === groupId);
      const inSeen = seenGroups.find((g) => g.id === groupId);
      let chain: StoryGroup[];
      if (inUnseen) {
        chain = unseenGroups;
      } else if (inSeen) {
        chain = seenGroups;
      } else {
        return { prevGroupId: null, nextGroupId: null };
      }
      
      const indexInChain = chain.findIndex((g) => g.id === groupId);
      if (indexInChain === -1) {
        return { prevGroupId: null, nextGroupId: null };
      }
      
      return {
        prevGroupId: indexInChain > 0 ? chain[indexInChain - 1].id : null,
        nextGroupId: indexInChain < chain.length - 1 ? chain[indexInChain + 1].id : null,
      };
    }

    const isUnseen = groupData.hasUnseen;
    const chain = isUnseen ? unseenGroups : seenGroups;
    const indexInChain = chain.findIndex((g) => g.id === groupId);

    if (indexInChain === -1) {
      return { prevGroupId: null, nextGroupId: null };
    }

    return {
      prevGroupId: indexInChain > 0 ? chain[indexInChain - 1].id : null,
      nextGroupId: indexInChain < chain.length - 1 ? chain[indexInChain + 1].id : null,
    };
  }, [modelsWithRecentGroups, unseenGroups, seenGroups]);

  // Find the selected model and group based on URL param
  // Format: storyId = "modelId:groupId" or just "groupId" if we can infer model
  const selectedModel = storyId && feed === "near"
    ? models.find((model) => {
        // Check if any of this model's story groups match the storyId
        return model.story_groups?.some((group) => group.id === storyId);
      })
    : null;

  const selectedGroup = storyId && selectedModel && feed === "near"
    ? selectedModel.story_groups?.find((group) => group.id === storyId)
    : null;

  // Set chain neighbors when storyId changes (e.g., direct link)
  // NOTE: This only runs on initial open or direct link, NOT during navigation
  // Navigation updates neighbors directly in handleNavigate to preserve the snapshot
  useEffect(() => {
    if (feed !== "near") return;
    
    if (storyId && selectedGroup && !activeChainGroupIds) {
      // Only set neighbors if we don't already have a snapshot (initial open or direct link)
      // Determine chain from group's current status and snapshot it
      const groupData = modelsWithRecentGroups.find(({ recentGroup }) => recentGroup.id === storyId);
      if (groupData) {
        const isUnseen = groupData.hasUnseen;
        const chain = isUnseen ? unseenGroups : seenGroups;
        // Snapshot the chain group IDs
        const chainGroupIds = chain.map((g) => g.id);
        setActiveChainGroupIds(chainGroupIds);
        
        const neighbors = getNeighborsForGroup(storyId, chainGroupIds);
        setActiveChainNeighbors(neighbors);
      } else {
        setActiveChainGroupIds(null);
        setActiveChainNeighbors({ prevGroupId: null, nextGroupId: null });
      }
    } else if (!storyId) {
      setActiveChainNeighbors(null);
      setActiveChainGroupIds(null);
    }
  }, [storyId, selectedGroup, getNeighborsForGroup, modelsWithRecentGroups, unseenGroups, seenGroups, activeChainGroupIds, feed]);

  // Only render on 'near' feed - NOW after all hooks are called
  if (feed !== "near") {
    return null;
  }

  // Don't render if no models with recent groups
  if (modelsWithRecentGroups.length === 0) {
    return null;
  }

  // Handle circle click - open story viewer with recent group
  // Calculate initial index and set both URL parameters
  const handleRecentGroupClick = (groupId: string) => {
    // Find the group to calculate starting index
    const group = models
      .flatMap((m) => m.story_groups || [])
      .find((g) => g.id === groupId);
    
    if (group) {
      // Sort stories chronologically (oldest first) to match StoryViewer
      const sortedStories = [...(group.stories || [])].sort((a, b) => {
        const dateA = new Date(a.posted_date || a.created_at);
        const dateB = new Date(b.posted_date || b.created_at);
        return dateA.getTime() - dateB.getTime();
      });
      const startIndex = getFirstUnseenStoryIndex(sortedStories);
      
      // Determine chain and snapshot group IDs at open time
      const groupData = modelsWithRecentGroups.find(({ recentGroup }) => recentGroup.id === groupId);
      if (groupData) {
        const isUnseen = groupData.hasUnseen;
        const chain = isUnseen ? unseenGroups : seenGroups;
        // Snapshot the chain group IDs to prevent changes mid-navigation
        const chainGroupIds = chain.map((g) => g.id);
        setActiveChainGroupIds(chainGroupIds);
        
        // Calculate neighbors using the snapshot
        const neighbors = getNeighborsForGroup(groupId, chainGroupIds);
        setActiveChainNeighbors(neighbors);
      } else {
        setActiveChainGroupIds(null);
        setActiveChainNeighbors({ prevGroupId: null, nextGroupId: null });
      }
      
      // Set both parameters with replace to avoid history pollution
      setStoryId(groupId, { history: "replace" });
      setStoryIndexParam(startIndex.toString(), { history: "replace" });
    } else {
      // Fallback if group not found
      setActiveChainNeighbors({ prevGroupId: null, nextGroupId: null });
      setActiveChainGroupIds(null);
      setStoryId(groupId, { history: "replace" });
      setStoryIndexParam("0", { history: "replace" });
    }
  };

  // Handle close viewer (removes URL params and clears chain neighbors)
  const handleCloseViewer = () => {
    setActiveChainNeighbors(null);
    setActiveChainGroupIds(null);
    setStoryId(null, { history: "replace" });
    setStoryIndexParam(null, { history: "replace" });
  };


  // Handler for navigating between models' stories
  // Use 'replace' history to avoid creating multiple back button entries
  // Calculate and set initial index for the new group
  // Note: Neighbors remain from the original chain (stored at open time)
  const handleNavigate = (id: string) => {
    // Find the group to calculate starting index
    const group = models
      .flatMap((m) => m.story_groups || [])
      .find((g) => g.id === id);
    
    if (group) {
      // Sort stories chronologically (oldest first) to match StoryViewer
      const sortedStories = [...(group.stories || [])].sort((a, b) => {
        const dateA = new Date(a.posted_date || a.created_at);
        const dateB = new Date(b.posted_date || b.created_at);
        return dateA.getTime() - dateB.getTime();
      });
      const startIndex = getFirstUnseenStoryIndex(sortedStories);
      
      // Update neighbors for the new group using the snapshot chain
      // This ensures we stay in the same chain even if groups change status mid-navigation
      if (activeChainGroupIds) {
        const neighbors = getNeighborsForGroup(id, activeChainGroupIds);
        setActiveChainNeighbors(neighbors);
        // If group not found in snapshot chain, it means we've reached the end - neighbors will be null
      } else {
        // Fallback: determine chain from current status (shouldn't happen, but safety check)
        const groupData = modelsWithRecentGroups.find(({ recentGroup }) => recentGroup.id === id);
        if (groupData) {
          const isUnseen = groupData.hasUnseen;
          const chain = isUnseen ? unseenGroups : seenGroups;
          const chainGroupIds = chain.map((g) => g.id);
          setActiveChainGroupIds(chainGroupIds);
          const neighbors = getNeighborsForGroup(id, chainGroupIds);
          setActiveChainNeighbors(neighbors);
        } else {
          setActiveChainNeighbors({ prevGroupId: null, nextGroupId: null });
        }
      }
      
      setStoryId(id, { history: 'replace' });
      setStoryIndexParam(startIndex.toString(), { history: 'replace' });
    } else {
      // Fallback if group not found
      setActiveChainNeighbors({ prevGroupId: null, nextGroupId: null });
      setActiveChainGroupIds(null);
      setStoryId(id, { history: 'replace' });
      setStoryIndexParam("0", { history: 'replace' });
    }
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

      {/* Story Viewer Modal - Render when URL param exists and group is found and feed is 'near' */}
      {feed === "near" && storyId && selectedGroup && selectedModel && (() => {
        // Use index from URL if valid, otherwise calculate from first unseen story
        // This allows resume-on-reopen within the same session
        let initialStoryIndex = initialStoryIndexFromUrl;
        
        // Validate index is within bounds
        if (initialStoryIndex < 0 || initialStoryIndex >= (selectedGroup.stories?.length || 0)) {
          // Recalculate if URL index is invalid
          const sortedStories = [...(selectedGroup.stories || [])].sort((a, b) => {
            const dateA = new Date(a.posted_date || a.created_at);
            const dateB = new Date(b.posted_date || b.created_at);
            return dateA.getTime() - dateB.getTime();
          });
          initialStoryIndex = getFirstUnseenStoryIndex(sortedStories);
        }
        
        return (
          <StoryViewer
            group={selectedGroup}
            onClose={handleCloseViewer}
            socialLink={selectedModel.social_link}
            modelName={selectedModel.name}
            modelImage={selectedModel.image_url}
            modelSlug={selectedModel.slug}
            isVerified={selectedModel.is_verified}
            nextGroupId={activeChainNeighbors?.nextGroupId ?? undefined}
            prevGroupId={activeChainNeighbors?.prevGroupId ?? undefined}
            onNavigate={handleNavigate}
            initialStoryIndex={initialStoryIndex}
          />
        );
      })()}
    </>
  );
}
