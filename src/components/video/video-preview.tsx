'use client'

import { useEffect, useRef, useState } from 'react'
import { PauseIcon, PlayIcon } from '@/components/icons'
import type { PhotoStore } from '@/lib/video/image-store'
import { getPathsAround, renderFrame, type Scene, type Timeline } from '@/lib/video/scene'
import { getCanvasSize, type VideoSettings } from '@/lib/video/settings'

/** Xem trước ở nửa độ phân giải — đủ nét trên màn hình, nhẹ cho điện thoại. */
const PREVIEW_SHORT_SIDE = 540

const formatTime = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function VideoPreview({
  scene,
  timeline,
  settings,
  store,
  paused = false,
}: {
  scene: Scene
  timeline: Timeline
  settings: VideoSettings
  store: PhotoStore
  /** Đang xuất video: dừng phát để không tranh bộ nhớ ảnh với bộ mã hoá */
  paused?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef(0)
  const [time, setTime] = useState(0)
  const [wantsPlay, setWantsPlay] = useState(true)
  const isPlaying = wantsPlay && !paused
  const setIsPlaying = setWantsPlay

  const output = getCanvasSize(settings)
  const ratio = PREVIEW_SHORT_SIDE / Math.min(output.width, output.height)
  const width = Math.round(output.width * ratio)
  const height = Math.round(output.height * ratio)

  // Vẽ 1 frame (dùng khi tạm dừng / tua / đổi cài đặt)
  const drawAt = (at: number) => {
    const ctx = canvasRef.current?.getContext('2d', { alpha: false })
    if (!ctx) {
      return
    }
    const paths = getPathsAround(scene, timeline, at)
    const missing = paths.some((path) => !store.get(path))
    renderFrame(ctx, at, scene, timeline, settings, store)
    if (missing) {
      store
        .ensure(paths)
        .then(() => {
          if (timeRef.current === at) {
            renderFrame(ctx, at, scene, timeline, settings, store)
          }
        })
        .catch(() => {})
    }
  }
  const drawAtRef = useRef(drawAt)
  useEffect(() => {
    drawAtRef.current = drawAt
  })

  // Đổi ảnh / cài đặt → vẽ lại frame hiện tại
  useEffect(() => {
    timeRef.current = Math.min(timeRef.current, timeline.duration)
    drawAtRef.current(timeRef.current)
  }, [scene, timeline, settings, width, height])

  useEffect(() => {
    if (!isPlaying) {
      return
    }
    let frameId = 0
    let last = performance.now()
    let lastStateUpdate = 0

    const tick = (now: number) => {
      const delta = (now - last) / 1000
      last = now
      let next = timeRef.current + delta
      if (next >= timeline.duration) {
        next = 0
      }
      timeRef.current = next
      drawAtRef.current(next)
      // Cập nhật thanh tua ~10 lần/giây, tránh re-render 60fps
      if (now - lastStateUpdate > 100) {
        lastStateUpdate = now
        setTime(next)
      }
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [isPlaying, timeline.duration])

  const seek = (value: number) => {
    timeRef.current = value
    setTime(value)
    drawAtRef.current(value)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="group relative max-w-full">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onClick={() => !paused && setIsPlaying((value) => !value)}
          className="block max-h-[64dvh] w-auto max-w-full cursor-pointer rounded-[1.75rem] bg-primary shadow-leaf-lg ring-1 ring-black/5"
          style={{ aspectRatio: `${width} / ${height}` }}
          aria-label="Xem trước video — bấm để phát / tạm dừng"
        />
        {!isPlaying && !paused ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40 pl-1 text-3xl text-white backdrop-blur-sm">
              <PlayIcon />
            </span>
          </span>
        ) : null}
        {paused ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[1.75rem] bg-black/35 text-sm font-semibold text-white backdrop-blur-[2px]">
            Đang xuất video…
          </span>
        ) : null}
      </div>
      <div className="flex w-full max-w-md items-center gap-3 rounded-full bg-surface-container-lowest p-1.5 pr-4 shadow-leaf ring-1 ring-surface-container-high/60">
        <button
          type="button"
          disabled={paused}
          onClick={() => setIsPlaying((value) => !value)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-transform active:scale-90 disabled:opacity-50"
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon className="translate-x-px" />}
        </button>
        <input
          type="range"
          min={0}
          max={timeline.duration}
          step={0.01}
          value={Math.min(time, timeline.duration)}
          disabled={paused}
          onChange={(event) => {
            setIsPlaying(false)
            seek(Number(event.target.value))
          }}
          className="h-1.5 flex-1 cursor-pointer accent-primary"
          aria-label="Tua video"
        />
        <span className="shrink-0 text-xs font-semibold text-on-surface-variant tabular-nums">
          {formatTime(time)} / {formatTime(timeline.duration)}
        </span>
      </div>
    </div>
  )
}
