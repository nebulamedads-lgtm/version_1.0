import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

// GET - Get all story groups for a model
export async function GET(request: Request) {
  const url = new URL(request.url);
  const adminKey = url.searchParams.get('key');
  const modelId = url.searchParams.get('modelId');
  
  const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
  if (adminKey !== ADMIN_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId required' }, { status: 400 });
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
    .eq('model_id', modelId)
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

// POST - Create new story group (pinned block)
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
    const body: {
      model_id: string;
      title: string;
      is_pinned: boolean;
      cover_url?: string;
      sort_order?: number;
    } = await request.json();
    
    if (!body.model_id) {
      return NextResponse.json({ success: false, error: 'model_id required' }, { status: 400 });
    }
    
    // Get max sort_order for pinned groups of this model (only if creating a pinned group)
    let nextOrder = 0;
    if (body.is_pinned) {
      const { data: existing } = await supabase
        .from('story_groups')
        .select('sort_order')
        .eq('model_id', body.model_id)
        .eq('is_pinned', true)
        .order('sort_order', { ascending: false })
        .limit(1);
      
      nextOrder = existing && existing.length > 0 
        ? (existing[0].sort_order || 0) + 1 
        : 0;
    }
    
    const { data, error } = await supabase
      .from('story_groups')
      .insert({
        model_id: body.model_id,
        title: body.title || null,
        is_pinned: body.is_pinned || false,
        cover_url: body.cover_url || '',
        sort_order: body.sort_order ?? nextOrder,
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
