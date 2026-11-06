'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { ServiceWorker } from '@/components/pwa/service-worker'
import { warmSupabaseClient } from '@/lib/supabase/client'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  )

  useEffect(warmSupabaseClient, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ServiceWorker />
    </QueryClientProvider>
  )
}
