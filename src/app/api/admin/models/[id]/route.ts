import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { ModelFormData } from '@/types/admin';
import { 
  deleteModelFolder, 
  deleteMultipleFromR2, 
  getGalleryItemMediaKeys, 
  getStoryMediaKeys,
  extractKeyFromUrl 
} from '@/lib/r2-utils';

export const runtime = 'edge';

// GET - Get single model with all details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { data: model, error } = await supabase
    .from('models')
    .select(`
      *,
      gallery_items(*),
      story_groups(
        *,
        stories(*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: model });
}

// PUT - Update model
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    const body: Partial<ModelFormData> = await request.json();
    
    // If image_url is being changed, delete old image from R2
    if (body.image_url) {
      const { data: currentModel } = await supabase
        .from('models')
        .select('image_url')
        .eq('id', id)
        .single();
      
      if (currentModel && currentModel.image_url && currentModel.image_url !== body.image_url) {
        const oldKey = extractKeyFromUrl(currentModel.image_url, 'models');
        if (oldKey) {
          await deleteMultipleFromR2([oldKey], 'models');
        }
      }
    }
    
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.bio !== undefined) updateData.bio = body.bio;
    if (body.bio_es !== undefined) updateData.bio_es = body.bio_es;
    if (body.age !== undefined) updateData.age = body.age;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.social_link !== undefined) updateData.social_link = body.social_link;
    if (body.image_url !== undefined) updateData.image_url = body.image_url;
    if (body.is_verified !== undefined) updateData.is_verified = body.is_verified;
    if (body.is_new !== undefined) updateData.is_new = body.is_new;
    if (body.is_pinned !== undefined) updateData.is_pinned = body.is_pinned;
    
    const { data, error } = await supabase
      .from('models')
      .update(updateData)
      .eq('id', id)
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

// DELETE - Delete model with ALL associated content from Supabase AND R2
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  // Step 1: Fetch model with all related data
  const { data: model, error: fetchError } = await supabase
    .from('models')
    .select(`
      *,
      gallery_items(*),
      story_groups(
        *,
        stories(*)
      )
    `)
    .eq('id', id)
    .single();

  if (fetchError) {
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
  }

  if (!model) {
    return NextResponse.json({ success: false, error: 'Model not found' }, { status: 404 });
  }

  // Step 2: Collect ALL R2 keys to delete
  const modelBucketKeys: string[] = [];
  const storiesBucketKeys: string[] = [];
  
  // Model profile image
  if (model.image_url) {
    modelBucketKeys.push(extractKeyFromUrl(model.image_url, 'models'));
  }
  
  // Gallery items (can be in either bucket - detect from URL)
  if (model.gallery_items && Array.isArray(model.gallery_items)) {
    for (const item of model.gallery_items) {
      const keysWithBuckets = getGalleryItemMediaKeys(item);
      for (const { key, bucket } of keysWithBuckets) {
        if (bucket === 'models') {
          modelBucketKeys.push(key);
        } else {
          storiesBucketKeys.push(key); // Old gallery items might be in stories bucket
        }
      }
    }
  }
  
  // Story groups and stories (in stories bucket)
  if (model.story_groups && Array.isArray(model.story_groups)) {
    for (const group of model.story_groups) {
      // Group cover
      if (group.cover_url) {
        storiesBucketKeys.push(extractKeyFromUrl(group.cover_url, 'stories'));
      }
      
      // Stories in group
      if (group.stories && Array.isArray(group.stories)) {
        for (const story of group.stories) {
          storiesBucketKeys.push(...getStoryMediaKeys(story));
        }
      }
    }
  }

  // Step 3: Delete from R2 (both buckets)
  let r2ModelDeleted = 0;
  let r2StoriesDeleted = 0;
  const r2Errors: string[] = [];
  
  if (modelBucketKeys.length > 0) {
    const result = await deleteMultipleFromR2(modelBucketKeys, 'models');
    r2ModelDeleted = result.deleted;
    if (!result.success) {
      r2Errors.push(...result.failed.map(k => `models/${k}`));
    }
  }
  
  if (storiesBucketKeys.length > 0) {
    const result = await deleteMultipleFromR2(storiesBucketKeys, 'stories');
    r2StoriesDeleted = result.deleted;
    if (!result.success) {
      r2Errors.push(...result.failed.map(k => `stories/${k}`));
    }
  }

  // Step 4: Delete from Supabase (in correct order for foreign keys)
  // Delete stories first
  for (const group of (model.story_groups || [])) {
    await supabase.from('stories').delete().eq('group_id', group.id);
  }
  
  // Delete story groups
  await supabase.from('story_groups').delete().eq('model_id', id);
  
  // Delete gallery items
  await supabase.from('gallery_items').delete().eq('model_id', id);
  
  // Finally delete the model
  const { error: deleteError } = await supabase
    .from('models')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true,
    r2Deleted: {
      models: r2ModelDeleted,
      stories: r2StoriesDeleted,
    },
    supabaseDeleted: {
      galleryItems: model.gallery_items?.length || 0,
      storyGroups: model.story_groups?.length || 0,
      stories: model.story_groups?.reduce((acc: number, g: any) => acc + (g.stories?.length || 0), 0) || 0,
    },
    r2Errors: r2Errors.length > 0 ? r2Errors : undefined,
  });
}
