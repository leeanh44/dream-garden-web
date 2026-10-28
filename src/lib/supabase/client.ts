import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from './env'

let browserClient: SupabaseClient | null = null

/** Supabase client dùng trong Client Components (singleton). */
export const getSupabaseBrowserClient = () => {
  browserClient ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
  return browserClient
}
