import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { deleteFromR2, getGalleryItemMediaKeys, deleteMultipleFromR2 } from '@/lib/r2-utils';

export const runtime = 'edge';

// GET - Get single gallery item
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
    .from('gallery_items')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

// DELETE - Delete gallery item WITH R2 cleanup
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Step 1: Fetch the gallery item to get media URLs
    const { data: item, error: fetchError } = await supabase
      .from('gallery_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('[Gallery Delete] Fetch error:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: fetchError.message || 'Failed to fetch gallery item' 
      }, { status: 500 });
    }

    if (!item) {
      return NextResponse.json({ success: false, error: 'Gallery item not found' }, { status: 404 });
    }

  // Step 2: Delete files from R2
  const mediaKeysWithBuckets = getGalleryItemMediaKeys(item);
  console.log(`[Gallery Delete] Attempting to delete ${mediaKeysWithBuckets.length} files from R2:`, mediaKeysWithBuckets);
  
  if (mediaKeysWithBuckets.length > 0) {
    // Group keys by bucket
    const modelsKeys = mediaKeysWithBuckets.filter(k => k.bucket === 'models').map(k => k.key);
    const storiesKeys = mediaKeysWithBuckets.filter(k => k.bucket === 'stories').map(k => k.key);
    
    // Delete from models bucket
    if (modelsKeys.length > 0) {
      const r2Result = await deleteMultipleFromR2(modelsKeys, 'models');
      console.log(`[Gallery Delete] Models bucket deletion result:`, r2Result);
      if (!r2Result.success) {
        console.error(`[Gallery Delete] Models bucket deletion failed:`, r2Result.failed);
      }
    }
    
    // Delete from stories bucket (for old gallery items that were uploaded there)
    if (storiesKeys.length > 0) {
      const r2Result = await deleteMultipleFromR2(storiesKeys, 'stories');
      console.log(`[Gallery Delete] Stories bucket deletion result:`, r2Result);
      if (!r2Result.success) {
        console.error(`[Gallery Delete] Stories bucket deletion failed:`, r2Result.failed);
      }
    }
  } else {
    console.warn(`[Gallery Delete] No media keys found for item:`, item);
  }

    // Step 3: Delete from Supabase
    const { error: deleteError } = await supabase
      .from('gallery_items')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Gallery Delete] Database delete error:', deleteError);
      return NextResponse.json({ 
        success: false, 
        error: deleteError.message || 'Failed to delete from database' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      r2Deleted: mediaKeysWithBuckets.length,
    });
  } catch (error) {
    console.error('[Gallery Delete] Unexpected error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

// PUT - Update gallery item (with optional media replacement)
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
    const body = await request.json();
    
    // If media_url is being changed, delete old files from R2
    if (body.media_url) {
      // Fetch current item to get old media URLs
      const { data: currentItem } = await supabase
        .from('gallery_items')
        .select('media_url, media_type, poster_url')
        .eq('id', id)
        .single();
      
      if (currentItem && currentItem.media_url !== body.media_url) {
        // Delete old files from R2
        const oldKeys = getGalleryItemMediaKeys(currentItem);
        if (oldKeys.length > 0) {
          await deleteMultipleFromR2(oldKeys, 'models');
        }
      }
    }
    
    // Update in Supabase
    const { data, error } = await supabase
      .from('gallery_items')
      .update(body)
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
