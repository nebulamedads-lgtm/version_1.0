import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

// PUT - Update story group (pinned block)
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

// DELETE - Delete story group and all its stories
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

  // Delete stories first (CASCADE should handle this, but explicit for clarity)
  const { error: storiesError } = await supabase
    .from('stories')
    .delete()
    .eq('group_id', id);
  
  if (storiesError) {
    console.error('Error deleting stories:', storiesError);
    // Continue with group deletion even if stories deletion fails (CASCADE will handle it)
  }
  
  const { error } = await supabase
    .from('story_groups')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
