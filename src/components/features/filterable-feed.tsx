'use client';

import { useState } from 'react';
import { useQueryState } from 'nuqs';
import { CategoryPills } from './category-pills';
import { FeedManager } from './feed-manager';
import { Model } from '@/types';
import { Language } from '@/lib/i18n';

interface FilterableFeedProps {
  models: Model[];
  topTags: string[];
  userCity: string;
  language: Language;
  buttons: {
    chat: string;
    unlock: string;
  };
}

export function FilterableFeed({ models, topTags, userCity, language, buttons }: FilterableFeedProps) {
  const [feed] = useQueryState('feed', { defaultValue: 'near' });
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const isFavorites = feed === 'favorites';

  // Filter models by selected tag (skip filtering for favorites)
  const filteredModels = selectedTag && !isFavorites
    ? models.filter(m => m.tags?.includes(selectedTag))
    : models;

  return (
    <>
      {/* Category Pills for Tag Filtering - Horizontal Bar Style */}
      {!isFavorites && (
        <div 
          className="sticky top-[96px] z-40 -mx-4 px-0"
          style={{
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            outline: 'none',
          }}
        >
          {/* Horizontal Bar Container - 100% Invisible */}
          <div 
            className="w-full flex items-center"
            style={{
              height: '56px',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              outline: 'none',
            }}
          >
            <CategoryPills
              tags={topTags}
              selectedTag={selectedTag}
              onSelectTag={setSelectedTag}
              activeFeed={feed}
            />
          </div>
        </div>
      )}

      {/* Separator line between pills and model cards (smaller) */}
      {!isFavorites && (
        <div className="border-b border-white/5 w-[348px] mx-auto" style={{ marginTop: '6px' }} />
      )}

      {/* Show empty state or feed */}
      {filteredModels.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No models found in this category
        </p>
      ) : (
        <div className="mt-4">
          <FeedManager
            models={filteredModels}
            userCity={userCity}
            language={language}
            buttons={buttons}
          />
        </div>
      )}
    </>
  );
}
