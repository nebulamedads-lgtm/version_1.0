import { StatusIndicator } from "@/components/ui/status-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { ProfileHeaderClient } from "@/components/layout/profile-header-client";
import { ModelViewTracker } from "@/components/features/model-view-tracker";
import { ChatButton } from "@/components/features/chat-button";
import { StoriesContainer } from "@/components/features/stories-container";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { DICTIONARY, getLanguage, translateTags } from "@/lib/i18n";
import Link from "next/link";
import type { GalleryItem } from "@/types";

// Lazy load ProfileGallery - below the fold content
const ProfileGallery = dynamic(() => import("@/components/features/profile-gallery").then(mod => ({ default: mod.ProfileGallery })), {
  loading: () => <p className="text-center text-muted-foreground p-8">Loading Gallery...</p>
});

// Edge runtime required for Cloudflare Pages
export const runtime = 'edge';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ModelPage({ params }: PageProps) {
  const { slug } = await params;
  
  // Get User Country and Determine Language
  const headersList = await headers();
  const country = headersList.get('x-user-country') || 'XX';
  const lang = getLanguage(country);
  const dict = DICTIONARY[lang];
  
  // Fetch model from Supabase with gallery_items
  const supabase = await createClient();
  const { data: model, error } = await supabase
    .from('models')
    .select(`
      id,
      name,
      image_url,
      tags,
      is_verified,
      is_new,
      social_link,
      bio,
      bio_es,
      gallery_items (
        id,
        model_id,
        media_url,
        media_type,
        poster_url,
        width,
        height,
        sort_order,
        created_at
      )
    `)
    .eq('slug', slug)
    .single();

  if (error || !model) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">404</h1>
          <p className="text-muted-foreground">Model not found</p>
          <Link href="/">
            <Button variant="default">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Fetch story_groups with nested stories for this model
  const { data: storyGroups, error: storyError } = await supabase
    .from('story_groups')
    .select(`
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
    `)
    .eq('model_id', model.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  // Log story_groups data for verification
  console.log('[Stories Debug] Model:', model.name);
  console.log('[Stories Debug] Story Groups:', JSON.stringify(storyGroups, null, 2));
  if (storyError) {
    console.error('[Stories Debug] Error fetching stories:', storyError);
  }

  // 7-Day Decay Rule: Filter stories based on age
  // Calculate date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Process story groups with decay logic and dynamic covers
  const filteredStoryGroups = (storyGroups || [])
    .map((group) => {
      // Pinned groups: Keep ALL stories (no filtering)
      if (group.is_pinned) {
        // Sort pinned stories by date (newest first) for consistent ordering
        const sortedStories = [...(group.stories || [])].sort((a, b) => {
          const dateA = new Date(a.posted_date || a.created_at);
          const dateB = new Date(b.posted_date || b.created_at);
          return dateB.getTime() - dateA.getTime();
        });
        return {
          ...group,
          stories: sortedStories,
        };
      }

      // Recent groups (unpinned): Filter out stories older than 7 days
      const filteredStories = (group.stories || []).filter((story) => {
        const storyDate = new Date(story.created_at);
        return storyDate >= sevenDaysAgo;
      });

      // Sort stories chronologically (oldest first) so they play in order
      const sortedStories = [...filteredStories].sort((a, b) => {
        const dateA = new Date(a.posted_date || a.created_at);
        const dateB = new Date(b.posted_date || b.created_at);
        return dateA.getTime() - dateB.getTime();
      });

      // Dynamic cover: Use the LAST story's media as cover for the circle
      // BUT only if it's an image - for videos, keep the original group.cover_url (poster)
      const lastStory = sortedStories.length > 0 ? sortedStories[sortedStories.length - 1] : null;
      const dynamicCoverUrl = lastStory
        ? (lastStory.media_type === 'video' ? group.cover_url : lastStory.media_url)
        : group.cover_url;

      return {
        ...group,
        stories: sortedStories,
        cover_url: dynamicCoverUrl,
      };
    })
    // Remove any story groups that have zero stories left after filtering
    .filter((group) => group.stories && group.stories.length > 0);

  // Sort gallery_items by sort_order (ascending)
  const sortedGalleryItems = model.gallery_items 
    ? [...model.gallery_items].sort((a, b) => a.sort_order - b.sort_order)
    : [];

  // Use gallery_items if available, fallback to image_url
  // Convert to GalleryItem[] format for ProfileGallery
  const galleryItems: GalleryItem[] = sortedGalleryItems.length > 0
    ? sortedGalleryItems
    : model.image_url
    ? [{
        id: 'fallback-0',
        model_id: model.id,
        media_url: model.image_url,
        media_type: 'image' as const,
        poster_url: null,
        width: null,
        height: null,
        sort_order: 0,
        created_at: new Date().toISOString(),
      }]
    : [];

  // Translate tags based on user's language
  const translatedTags = translateTags(model.tags || [], lang);

  // Select bio based on user's language
  const displayBio = (lang === 'es' && model.bio_es)
    ? model.bio_es
    : model.bio || 'Passionate content creator dedicated to bringing you the best experience. Connect with me for exclusive content and personalized interactions.';

  // Safety: Handle null/undefined social_link with fallback
  const socialLink = model.social_link && model.social_link.trim() !== '' ? model.social_link : '#';

  // Logic: If verified -> "Chat with Me" (Localized)
  //        If not -> "Chat with [Name]" (Localized)
  const buttonLabel = model.is_verified 
    ? dict.buttons.chatWithMe 
    : `${dict.buttons.chat} ${model.name}`;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden overflow-y-auto">
      {/* Track View Event */}
      <ModelViewTracker modelId={model.id} />
      
      {/* Navigation Header - Fixed at top (Mobile only) */}
      <ProfileHeaderClient />
      
      {/* Main Grid Container - 3-Column Layout for Stories */}
      {/* No horizontal padding on mobile so Gallery is full-width */}
      {/* pb-24 on mobile for fixed chat button clearance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8 max-w-7xl mx-auto lg:px-6 pb-24 lg:pb-0 lg:h-screen">
        
        {/* Profile Info Block - order-2 on Mobile, order-1 (Left) on Desktop */}
        <div className="order-2 lg:order-1 lg:col-span-3 lg:sticky lg:top-0 lg:self-start lg:h-screen lg:overflow-hidden lg:flex lg:flex-col">
          {/* Desktop Brand Header - iOS Glass bar on top of info pane */}
          <div className="hidden lg:block bg-background/60 backdrop-blur-2xl border-b border-white/10 flex-shrink-0 z-10 shadow-lg shadow-black/10">
            <div className="flex items-center justify-center p-4">
              <Link href="/" className="flex items-center px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300">
                <span className="text-white font-bold tracking-tighter">
                  Tran<span className="text-[#00FF85]">Spot</span>
                </span>
              </Link>
            </div>
          </div>
          <div className="px-4 py-5 lg:p-0 lg:pt-4 lg:px-4 lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-y-auto scrollbar-hide">
            <div className="space-y-6">
              {/* Name, Verified Badge, New Badge with Online Dot */}
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{model.name}</h1>
                {model.is_verified && (
                  <img
                    src="/verified-badge.svg"
                    alt="Verified"
                    className="w-6 h-6 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] flex-shrink-0"
                    width={24}
                    height={24}
                  />
                )}
                {/* New Badge with Online Dot - Combined (same as ModelCard) */}
                {model.is_new ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1 pr-2 rounded-full text-xs font-semibold bg-[#7A27FF]/50 backdrop-blur-xl text-white border border-[#7A27FF]/50 shadow-[0_0_15px_rgba(122,39,255,0.4)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8),0_1px_2px_rgba(0,0,0,0.6)]">
                    New
                    <StatusIndicator />
                  </span>
                ) : (
                  <StatusIndicator />
                )}
              </div>

              {/* Tags - Mobile: Break out of parent padding for edge-to-edge scroll */}
              <div className="overflow-x-auto scrollbar-hide -mx-4 lg:mx-0 w-[calc(100%+2rem)] lg:w-auto">
                <div className="flex gap-2 lg:flex-wrap lg:px-0">
                  {translatedTags.map((tag: string, index: number) => (
                    <span 
                      key={index} 
                      className={`flex-shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-[#7A27FF]/30 backdrop-blur-xl text-white border border-[#7A27FF]/40 shadow-[0_0_15px_rgba(122,39,255,0.3)] transition-all duration-300 hover:bg-[#7A27FF]/40 hover:border-[#7A27FF]/60 hover:shadow-[0_0_20px_rgba(122,39,255,0.5)] ${index === translatedTags.length - 1 ? "mr-4" : ""}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stories - Mobile: Between Tags and Bio */}
              <div className="lg:hidden">
                <StoriesContainer 
                  groups={filteredStoryGroups} 
                  socialLink={socialLink}
                  modelName={model.name}
                  modelImage={model.image_url}
                  modelSlug={slug}
                  isVerified={model.is_verified}
                />
              </div>

              {/* Bio */}
              <p className="text-muted-foreground">
                {displayBio}
              </p>
            </div>

            {/* Chat Button - Desktop: Fixed at bottom of info pane */}
            <div className="hidden lg:block lg:mt-auto lg:pt-3 lg:pb-3">
              <ChatButton 
                href={socialLink}
                modelId={model.id} 
                modelName={model.name} 
                variant="inline"
                label={buttonLabel}
              />
            </div>
          </div>
        </div>

        {/* Stories Block - Desktop Only (Right Column) */}
        {/* Mobile stories are now inside Profile Info section, between Tags and Bio */}
        <div className="hidden lg:block lg:order-3 lg:col-span-3 lg:sticky lg:top-0 lg:self-start lg:h-screen lg:overflow-y-auto scrollbar-hide lg:px-0">
          <StoriesContainer 
            groups={filteredStoryGroups} 
            socialLink={socialLink}
            modelName={model.name}
            modelImage={model.image_url}
            modelSlug={slug}
            isVerified={model.is_verified}
          />
        </div>

        {/* Gallery Block - order-1 on Mobile (TOP), order-2 (Center) on Desktop */}
        <div className="order-1 lg:order-2 lg:col-span-6 lg:h-screen lg:overflow-y-auto scrollbar-hide">
          <ProfileGallery 
            items={galleryItems} 
            name={model.name}
            socialLink={socialLink}
            modelId={model.id}
            redirectUrl={socialLink}
          />
        </div>
      </div>

      {/* Chat Button - Mobile: Fixed at bottom */}
      <div className="lg:hidden">
        <ChatButton 
          href={socialLink}
          modelId={model.id} 
          modelName={model.name} 
          variant="fixed"
          label={buttonLabel}
        />
      </div>
    </div>
  );
}

