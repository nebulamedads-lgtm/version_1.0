import { headers } from 'next/headers';
import { FixedHeader } from '@/components/layout/fixed-header';
import { ScarcityBlockWrapper } from '@/components/ui/scarcity-block-wrapper';
import { HomeStoriesBar } from '@/components/features/home-stories-bar';
import { FilterableFeed } from '@/components/features/filterable-feed';
import { createClient } from '@/lib/supabase/server';
import { Model } from '@/types';
import { DICTIONARY, getLanguage } from '@/lib/i18n';

// Force dynamic to ensure geolocation works on every request
export const dynamic = 'force-dynamic';
// Edge runtime required for Cloudflare Pages
export const runtime = 'edge';

interface HomeProps {
  searchParams: Promise<{ feed?: string }>;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default async function Home({ searchParams }: HomeProps) {
  // 1. Get User Location and Country from Middleware
  const headersList = await headers();
  const city = headersList.get('x-user-city') || 'You';
  const country = headersList.get('x-user-country') || 'XX';

  // 2. Determine Language and Get Dictionary
  const lang = getLanguage(country);
  const dict = DICTIONARY[lang];

  // 3. Get feed parameter
  const params = await searchParams;
  const feed = params.feed || 'near';

  // 3. Fetch models from Supabase
  const supabase = await createClient();
  
  let query = supabase
    .from('models')
    .select('id, created_at, name, image_url, tags, is_pinned, is_verified, is_new, slug');

  // 4. Apply sorting based on feed type
  if (feed === 'new') {
    query = query.order('created_at', { ascending: false });
  } else if (feed === 'near') {
    // For "near", we'll fetch all and randomize server-side
    // The Online Priority logic will be applied client-side in FeedManager
    query = query.order('created_at', { ascending: false });
  }
  // Default (or any other feed): no specific ordering, will be handled by FeedManager

  const { data, error } = await query;

  // Always fetch story models (client component handles visibility based on feed)
  const { data: storyModelsData } = await supabase
    .from('models')
    .select(`
      *,
      story_groups (
        id,
        model_id,
        title,
        is_pinned,
        cover_url,
        created_at,
        stories (
          id,
          group_id,
          media_url,
          media_type,
          duration,
          created_at,
          posted_date
        )
      )
    `)
    .eq('featured_in_stories', true)
    .order('last_story_added_at', { ascending: false })
    .limit(15);

  if (error) {
    console.error('Error fetching models:', error);
    // Return empty array on error
    return (
      <main className="min-h-screen bg-background pb-20">
        <FixedHeader userCity={city} nav={dict.nav} header={dict.header} />
        <div className="pt-24 px-4 max-w-7xl mx-auto">
          <p className="text-center text-muted-foreground">Error loading models</p>
          <ScarcityBlockWrapper city={city} scarcity={dict.scarcity} />
        </div>
      </main>
    );
  }

  // 5. Map database fields to Model type
  const models: Model[] = (data || []).map((model: {
    id: string;
    name: string;
    image_url: string | null;
    tags: string[] | null;
    slug: string | null;
    is_verified: boolean | null;
    is_new: boolean | null;
    is_pinned: boolean | null;
  }) => ({
    id: model.id,
    name: model.name,
    image_url: model.image_url || '',
    tags: model.tags || [],
    slug: model.slug || '',
    is_verified: model.is_verified || false,
    is_new: model.is_new || false,
    is_pinned: model.is_pinned || false,
  }));

  // 6. Apply server-side randomization for "near" feed
  let sortedModels = models;
  if (feed === 'near') {
    sortedModels = shuffleArray(models);
  }

  // 7. Map story models data to Model type
  const storyModels: Model[] = (storyModelsData || []).map((model: any) => ({
    id: model.id,
    name: model.name,
    image_url: model.image_url || '',
    tags: model.tags || [],
    slug: model.slug || '',
    is_verified: model.is_verified || false,
    is_new: model.is_new || false,
    is_pinned: model.is_pinned || false,
    bio: model.bio,
    bio_es: model.bio_es,
    social_link: model.social_link,
    story_groups: model.story_groups || [],
  }));

  // 8. Filter out models without recent (unpinned) stories
  const validStoryModels = storyModels.filter((model) =>
    model.story_groups?.some(
      (group) => !group.is_pinned && group.stories && group.stories.length > 0
    )
  );

  // 9. Calculate top tags by frequency for CategoryPills
  const tagCounts: Record<string, number> = {};
  models.forEach(model => {
    model.tags?.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([tag]) => tag);

  return (
    <main className="min-h-screen bg-background pb-20">
      {/* 2. The New Fixed Header */}
      <FixedHeader userCity={city} nav={dict.nav} header={dict.header} />

      <div className="pt-24 max-w-7xl mx-auto">
        {/* 3. Home Stories Bar - Featured models with stories (visibility handled by client component) */}
        {validStoryModels.length > 0 && (
          <>
            <HomeStoriesBar models={validStoryModels} />
            {/* Separator line between stories and pills - 376px width on mobile, full width on desktop */}
            <div className="border-b border-white/10 w-[376px] lg:w-full mx-auto" />
          </>
        )}

        <div className="px-4">
          {/* 4. Filterable Feed (Category Pills + Feed Manager) */}
          <FilterableFeed
            models={sortedModels}
            topTags={topTags}
            userCity={city}
            language={lang}
            buttons={dict.buttons}
          />
          
          {/* 5. Scarcity Block - Hidden for favorites feed (client-side controlled) */}
          <ScarcityBlockWrapper city={city} scarcity={dict.scarcity} />
        </div>
      </div>
    </main>
  );
}