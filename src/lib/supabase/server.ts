import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Edge-compatible Supabase client for Server Components and API routes.
 * Uses anon key directly (no authentication required for this app).
 * 
 * This is Edge-compatible and works on Cloudflare Pages.
 */
export async function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

