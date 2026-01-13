import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { deleteMultipleFromR2, getStoryMediaKeys, extractKeyFromUrl } from '@/lib/r2-utils';

export const runtime = 'edge';

// GET - Get single story group with stories
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

  const { data, error } = await supabase
    .from('story_groups')
    .select(`
      *,
      stories(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

// PUT - Update story group (with optional cover replacement)
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
    const body: {
      title?: string;
      cover_url?: string;
      sort_order?: number;
    } = await request.json();
    
    // If cover_url is being changed, delete old cover from R2
    if (body.cover_url) {
      const { data: currentGroup } = await supabase
        .from('story_groups')
        .select('cover_url')
        .eq('id', id)
        .single();
      
      if (currentGroup && currentGroup.cover_url && currentGroup.cover_url !== body.cover_url) {
        // Delete old cover from R2
        const oldKey = extractKeyFromUrl(currentGroup.cover_url, 'stories');
        if (oldKey) {
          await deleteMultipleFromR2([oldKey], 'stories');
        }
      }
    }
    
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.cover_url !== undefined) updateData.cover_url = body.cover_url;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
    
    const { data, error } = await supabase
      .from('story_groups')
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

// DELETE - Delete story group with ALL stories AND their R2 files
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

  // Step 1: Fetch the story group with all stories
  const { data: group, error: fetchError } = await supabase
    .from('story_groups')
    .select(`
      *,
      stories(*)
    `)
    .eq('id', id)
    .single();

  if (fetchError) {
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
  }

  if (!group) {
    return NextResponse.json({ success: false, error: 'Story group not found' }, { status: 404 });
  }

  // Step 2: Collect all R2 keys to delete
  const allKeys: string[] = [];
  
  // Add cover_url
  if (group.cover_url) {
    allKeys.push(extractKeyFromUrl(group.cover_url, 'stories'));
  }
  
  // Add all story media
  if (group.stories && Array.isArray(group.stories)) {
    for (const story of group.stories) {
      allKeys.push(...getStoryMediaKeys(story));
    }
  }

  // Step 3: Delete from R2
  if (allKeys.length > 0) {
    const r2Result = await deleteMultipleFromR2(allKeys, 'stories');
    if (!r2Result.success) {
      console.warn(`[StoryGroup Delete] Some R2 files failed to delete:`, r2Result.failed);
      // Continue with database deletion even if R2 fails (log for manual cleanup)
    }
  }

  // Step 4: Delete stories from Supabase (cascade would handle this, but explicit is safer)
  await supabase.from('stories').delete().eq('group_id', id);
  
  // Step 5: Delete story group from Supabase
  const { error: deleteError } = await supabase
    .from('story_groups')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true,
    r2Deleted: allKeys.length,
    storiesDeleted: group.stories?.length || 0,
  });
}
