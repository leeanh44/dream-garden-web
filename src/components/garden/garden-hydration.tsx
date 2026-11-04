'use client'

import { HydrationBoundary } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import type { InitialGarden } from '@/lib/garden-server'
import { seedSignedUrls } from '@/lib/photos'

/** Nạp dữ liệu server gửi kèm (kho cây + signed URL) vào cache trước khi các component con render. */
export function GardenHydration({ initial, children }: { initial: InitialGarden; children: ReactNode }) {
  useState(() => seedSignedUrls(initial.signedUrls, initial.signedAt))
  return <HydrationBoundary state={initial.dehydratedState}>{children}</HydrationBoundary>
}
