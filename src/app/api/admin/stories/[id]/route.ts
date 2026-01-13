import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { deleteMultipleFromR2, getStoryMediaKeys } from '@/lib/r2-utils';

export const runtime = 'edge';

// GET - Get single story
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
    .from('stories')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

// DELETE - Delete story WITH R2 cleanup
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

  // Step 1: Fetch the story to get media URLs
  const { data: story, error: fetchError } = await supabase
    .from('stories')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) {
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
  }

  if (!story) {
    return NextResponse.json({ success: false, error: 'Story not found' }, { status: 404 });
  }

  // Step 2: Delete files from R2
  const mediaKeys = getStoryMediaKeys(story);
  console.log(`[Story Delete] Attempting to delete ${mediaKeys.length} files from R2:`, mediaKeys);
  
  if (mediaKeys.length > 0) {
    const r2Result = await deleteMultipleFromR2(mediaKeys, 'stories');
    console.log(`[Story Delete] R2 deletion result:`, r2Result);
    
    if (!r2Result.success) {
      console.error(`[Story Delete] R2 deletion failed:`, r2Result.failed);
      // Continue with database deletion even if R2 fails (log for manual cleanup)
    }
  } else {
    console.warn(`[Story Delete] No media keys found for story:`, story);
  }

  // Step 3: Delete from Supabase
  const { error: deleteError } = await supabase
    .from('stories')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true,
    r2Deleted: mediaKeys.length,
  });
}
