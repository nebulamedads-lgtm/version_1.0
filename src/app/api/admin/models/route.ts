import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { ModelFormData, ModelWithCounts } from '@/types/admin';

export const runtime = 'edge';

// GET - List all models with counts
export async function GET(request: Request) {
  const url = new URL(request.url);
  const adminKey = url.searchParams.get('key');
  const search = url.searchParams.get('search') || '';
  
  const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
  if (adminKey !== ADMIN_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // Build base query
  let query = supabase
    .from('models')
    .select('*')
    .order('created_at', { ascending: false });

  if (search) {
    // Use or() with ilike for case-insensitive search on name or slug
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  }

  const { data: models, error } = await query;

  if (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (!models || models.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  // Get counts for each model
  const modelsWithCounts: ModelWithCounts[] = await Promise.all(
    models.map(async (model: any) => {
      // Get gallery count
      const { count: galleryCount } = await supabase
        .from('gallery_items')
        .select('*', { count: 'exact', head: true })
        .eq('model_id', model.id);

      // Get story count (count stories in all groups for this model)
      const { data: storyGroups } = await supabase
        .from('story_groups')
        .select('id')
        .eq('model_id', model.id);

      let storyCount = 0;
      if (storyGroups && storyGroups.length > 0) {
        const groupIds = storyGroups.map(g => g.id);
        const { count: storiesCount } = await supabase
          .from('stories')
          .select('*', { count: 'exact', head: true })
          .in('group_id', groupIds);
        storyCount = storiesCount || 0;
      }

      return {
        id: model.id,
        name: model.name,
        slug: model.slug,
        image_url: model.image_url,
        is_verified: model.is_verified || false,
        is_new: model.is_new || false,
        is_pinned: model.is_pinned || false,
        social_link: model.social_link,
        tags: model.tags || [],
        created_at: model.created_at,
        gallery_count: galleryCount || 0,
        story_count: storyCount,
      };
    })
  );

  return NextResponse.json({ success: true, data: modelsWithCounts });
}

// POST - Create new model
export async function POST(request: Request) {
  const url = new URL(request.url);
  const adminKey = url.searchParams.get('key');
  
  const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
  if (adminKey !== ADMIN_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  try {
    const body: ModelFormData = await request.json();
    
    // Generate slug from name if not provided
    const slug = body.slug || body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const { data, error } = await supabase
      .from('models')
      .insert({
        name: body.name,
        slug,
        bio: body.bio,
        bio_es: body.bio_es || null,
        tags: body.tags,
        social_link: body.social_link,
        image_url: body.image_url,
        is_verified: body.is_verified || false,
        is_new: body.is_new !== undefined ? body.is_new : true,
        is_pinned: body.is_pinned || false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Invalid request' 
    }, { status: 400 });
  }
}
