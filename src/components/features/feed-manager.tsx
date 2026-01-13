'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQueryState } from 'nuqs';
import { useFavorites } from '@/hooks/use-favorites';
import { ModelFeed } from './model-feed';
import { Model } from '@/types';
import { Language } from '@/lib/i18n';

interface FeedManagerProps {
  models: Model[];
  userCity: string;
  language: Language;
  buttons: {
    chat: string;
    unlock: string;
  };
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function FeedManager({ models, userCity, language, buttons }: FeedManagerProps) {
  const [feed] = useQueryState('feed', { defaultValue: 'near' });
  const { favorites, isMounted } = useFavorites();

  // Initialize with deterministic state to prevent hydration mismatch
  const [enrichedModels, setEnrichedModels] = useState<Array<Model & { isOnline?: boolean }>>(
    models.map((model: Model) => ({
      ...model,
      isOnline: false, // Start with false for SSR/client match
    }))
  );

  // Randomize after hydration (client-side only)
  useEffect(() => {
    // Step 1: Enrichment - Assign random isOnline status (40% chance of being online)
    const randomized = models.map((model: Model) => ({
      ...model,
      isOnline: Math.random() > 0.6, // 40% chance of being online
    }));
    setEnrichedModels(randomized);
  }, [models]);

  // Step 2: Filter based on feed type
  const filteredModels = useMemo(() => {
    // Always wait for hydration to avoid mismatch during feed switches
    if (!isMounted) {
      // Return empty array during SSR/initial render to prevent hydration mismatch
      // This ensures client and server render the same thing initially
      return [];
    }

    if (feed === 'favorites') {
      // Filter by favorites from localStorage (using slug)
      const filtered = enrichedModels.filter((m) => 
        favorites.includes(m.slug || m.id)
      );
      // Shuffle favorites
      return shuffleArray(filtered);
    }

    if (feed === 'new') {
      // Filter by is_new === true, then shuffle
      return shuffleArray(
        enrichedModels.filter((m) => m.is_new === true)
      );
    } else {
      // Default: "Near" - Use Online Priority Shuffle
      // Separate into online and offline groups
      const onlineModels = enrichedModels.filter((m) => m.isOnline === true);
      const offlineModels = enrichedModels.filter((m) => m.isOnline === false);

      // Shuffle each group independently
      const shuffledOnline = shuffleArray(onlineModels);
      const shuffledOffline = shuffleArray(offlineModels);

      // Combine with online models first
      return [...shuffledOnline, ...shuffledOffline];
    }
  }, [feed, enrichedModels, favorites, isMounted]);

  return <ModelFeed models={filteredModels} feedType={(feed as 'near' | 'new' | 'favorites') || 'near'} buttons={buttons} language={language} />;
}

