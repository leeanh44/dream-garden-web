'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/pwa'

export function ServiceWorker() {
  useEffect(registerServiceWorker, [])
  return null
}
