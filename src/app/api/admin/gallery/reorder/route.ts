import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

// POST - Reorder gallery items
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
    // Expect array of { id: string, sort_order: number }
    const body: { items: { id: string; sort_order: number }[] } = await request.json();
    
    if (!body.items || !Array.isArray(body.items)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request: items array required' 
      }, { status: 400 });
    }
    
    // Update each item's sort_order
    const updates = body.items.map(item =>
      supabase
        .from('gallery_items')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)
    );

    const results = await Promise.all(updates);
    
    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Error updating gallery items:', errors);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update some items' 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Invalid request' 
    }, { status: 400 });
  }
}
