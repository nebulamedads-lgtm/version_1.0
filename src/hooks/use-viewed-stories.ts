"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "transpot-viewed-stories";

interface ViewedStory {
  groupId: string;
  latestStoryId: string; // Track the latest story ID when viewed
}

/**
 * Custom hook to track "Viewed" story groups using localStorage.
 * Handles Next.js hydration mismatch by loading from localStorage only on client mount.
 * Tracks latest story ID to detect when new stories are added.
 */
export function useViewedStories() {
  // Start with empty array to avoid hydration mismatch
  const [viewedStories, setViewedStories] = useState<ViewedStory[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage only after client mount (hydration safety)
  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Handle migration from old format (string[]) to new format (ViewedStory[])
          if (Array.isArray(parsed)) {
            if (parsed.length > 0 && typeof parsed[0] === 'string') {
              // Old format: migrate to new format
              const migrated: ViewedStory[] = parsed.map((id: string) => ({
                groupId: id,
                latestStoryId: '', // Can't recover old story IDs, so mark as empty
              }));
              setViewedStories(migrated);
              // Save migrated format
              localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            } else {
              // New format
              setViewedStories(parsed);
            }
          }
        }
      } catch (error) {
        // localStorage unavailable or corrupted data - fail silently
        console.warn("Failed to load viewed stories from localStorage:", error);
      }
    };

    loadFromStorage();
    setIsHydrated(true);

    // Listen for storage changes (cross-tab/window sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setViewedStories(parsed);
          }
        } catch (error) {
          console.warn("Failed to parse storage event:", error);
        }
      }
    };

    // Listen for custom event (same-window sync)
    const handleCustomUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ viewedStories: ViewedStory[] }>;
      if (customEvent.detail?.viewedStories) {
        setViewedStories(customEvent.detail.viewedStories);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("viewedStoriesUpdated", handleCustomUpdate);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("viewedStoriesUpdated", handleCustomUpdate);
    };
  }, []);

  // Persist to localStorage whenever viewedStories changes (after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(viewedStories));
      // Dispatch custom event for same-window sync (storage event only works cross-tab)
      window.dispatchEvent(new CustomEvent("viewedStoriesUpdated", { 
        detail: { viewedStories } 
      }));
    } catch (error) {
      // localStorage full or unavailable - fail silently
      console.warn("Failed to save viewed stories to localStorage:", error);
    }
  }, [viewedStories, isHydrated]);

  /**
   * Mark a story group as viewed. Stores the latest story ID to detect new stories.
   */
  const markAsViewed = useCallback((groupId: string, latestStoryId?: string) => {
    setViewedStories((prev) => {
      // Find existing entry
      const existingIndex = prev.findIndex((v) => v.groupId === groupId);
      
      if (existingIndex >= 0) {
        // Update existing entry with new latest story ID
        const updated = [...prev];
        updated[existingIndex] = {
          groupId,
          latestStoryId: latestStoryId || updated[existingIndex].latestStoryId,
        };
        return updated;
      } else {
        // Add new entry
        return [...prev, { groupId, latestStoryId: latestStoryId || '' }];
      }
    });
  }, []);

  /**
   * Check if a story group has been viewed.
   * Returns false if new stories have been added (latest story ID changed).
   */
  const isViewed = useCallback(
    (groupId: string, currentLatestStoryId?: string): boolean => {
      const viewed = viewedStories.find((v) => v.groupId === groupId);
      if (!viewed) return false;
      
      // If no current latest story ID provided, use old behavior (backward compatible)
      if (!currentLatestStoryId) {
        return true; // Assume viewed if we have an entry
      }
      
      // If latest story ID changed, it means new stories were added - mark as unviewed
      return viewed.latestStoryId === currentLatestStoryId;
    },
    [viewedStories]
  );

  return {
    viewedIds: viewedStories.map((v) => v.groupId), // Backward compatibility
    markAsViewed,
    isViewed,
    isHydrated, // Expose hydration state for conditional rendering if needed
  };
}
