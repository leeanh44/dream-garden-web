import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_KEY, SUPABASE_URL } from './env'

/** Supabase client dùng trong Server Components / Route Handlers. */
export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Gọi từ Server Component (không ghi được cookie) — proxy.ts đã refresh session.
        }
      },
    },
  })
}
