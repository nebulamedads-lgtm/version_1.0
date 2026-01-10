"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "transpot-viewed-models";

/**
 * Custom hook to track "Viewed" model profiles using localStorage.
 * Handles Next.js hydration mismatch by loading from localStorage only on client mount.
 */
export function useViewedModels() {
  // Start with empty array to avoid hydration mismatch
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage only after client mount (hydration safety)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setViewedIds(parsed);
        }
      }
    } catch (error) {
      // localStorage unavailable or corrupted data - fail silently
      console.warn("Failed to load viewed models from localStorage:", error);
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage whenever viewedIds changes (after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(viewedIds));
    } catch (error) {
      // localStorage full or unavailable - fail silently
      console.warn("Failed to save viewed models to localStorage:", error);
    }
  }, [viewedIds, isHydrated]);

  /**
   * Mark a model as viewed. Only adds if not already present.
   */
  const markAsViewed = useCallback((id: string) => {
    setViewedIds((prev) => {
      if (prev.includes(id)) {
        return prev; // Already viewed, no change
      }
      return [...prev, id];
    });
  }, []);

  /**
   * Check if a model has been viewed.
   */
  const isViewed = useCallback(
    (id: string): boolean => {
      return viewedIds.includes(id);
    },
    [viewedIds]
  );

  return {
    viewedIds,
    markAsViewed,
    isViewed,
    isHydrated, // Expose hydration state for conditional rendering if needed
  };
}
