'use client'

import { useEffect, useRef, useState } from 'react'
import { GardenScene, type HoverInfo } from '@/components/garden3d/garden-scene'
import type { Plant3D } from '@/lib/garden3d'
import type { ResolvedTheme } from '@/lib/theme'

type GardenCanvasProps = {
  plants: Plant3D[]
  theme: ResolvedTheme
  onHover: (info: HoverInfo) => void
  onSelect: (id: string) => void
}

const isWebGLAvailable = () => {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Khung chứa cảnh three.js — chỉ chạy phía trình duyệt (nạp bằng `next/dynamic` + `ssr: false`). */
export default function GardenCanvas({ plants, theme, onHover, onSelect }: GardenCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<GardenScene | null>(null)
  const handlersRef = useRef({ onHover, onSelect })
  const [supported] = useState(isWebGLAvailable)

  useEffect(() => {
    handlersRef.current = { onHover, onSelect }
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container || !supported) return
    const scene = new GardenScene(container, {
      onHover: (info) => handlersRef.current.onHover(info),
      onSelect: (id) => handlersRef.current.onSelect(id),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    })
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [supported])

  useEffect(() => {
    sceneRef.current?.setTheme(theme)
  }, [theme])

  useEffect(() => {
    sceneRef.current?.setPlants(plants)
  }, [plants])

  if (!supported) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-on-surface-variant">
        Trình duyệt này không hỗ trợ WebGL nên chưa xem được Vườn 3D.
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <button
        type="button"
        onClick={() => sceneRef.current?.resetView()}
        className="absolute right-3 bottom-3 rounded-full bg-surface-container-lowest/85 px-3.5 py-2 text-xs font-semibold text-on-surface shadow-leaf ring-1 ring-outline-variant backdrop-blur transition-colors hover:bg-surface-container"
      >
        Đặt lại góc nhìn
      </button>
    </div>
  )
}
