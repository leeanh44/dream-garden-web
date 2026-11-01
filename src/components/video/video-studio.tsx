'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  AlertIcon,
  ArrowLeftIcon,
  CameraIcon,
  CheckIcon,
  DownloadIcon,
  FilmIcon,
  LeafIcon,
  ShareIcon,
} from '@/components/icons'
import { PlantPhoto } from '@/components/plant-photo'
import { VideoPreview } from '@/components/video/video-preview'
import { VideoSettingsPanel } from '@/components/video/video-settings-panel'
import { formatDate, type Plant } from '@/lib/garden'
import { usePlant } from '@/lib/queries'
import { loadCanvasFonts, loadLogo } from '@/lib/video/assets'
import { exportVideo, isVideoExportSupported, type ExportResult } from '@/lib/video/encode'
import { PhotoStore } from '@/lib/video/image-store'
import { buildSlides, buildTimeline, type Scene } from '@/lib/video/scene'
import { DEFAULT_VIDEO_SETTINGS, getCanvasSize, type VideoSettings } from '@/lib/video/settings'
import { getPlantDisplayName } from '@/lib/plant-names'

const subscribeNoop = () => () => {}

type ExportState =
  | { status: 'idle' }
  | { status: 'exporting'; progress: number }
  | { status: 'done'; result: ExportResult; url: string }
  | { status: 'error'; message: string }

export function VideoStudio({ plantId }: { plantId: string }) {
  const { plant, isPending, error } = usePlant(plantId)

  if (isPending) {
    return <div className="skeleton h-[70dvh] rounded-[2rem]" aria-label="Đang tải" />
  }

  if (error || !plant) {
    return (
      <div className="card flex flex-col items-center p-8 text-center">
        <LeafIcon className="mb-3 text-4xl text-outline-variant" />
        <p className="mb-4 text-on-surface-variant">{error ? error.message : 'Không tìm thấy cây này.'}</p>
        <Link href="/" className="btn-secondary">
          <ArrowLeftIcon /> Về Kho cây
        </Link>
      </div>
    )
  }

  return <Studio plant={plant} />
}

function Studio({ plant }: { plant: Plant }) {
  const [settings, setSettings] = useState<VideoSettings>(DEFAULT_VIDEO_SETTINGS)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => new Set())
  const [assets, setAssets] = useState<Pick<Scene, 'fonts' | 'logo'> | null>(null)
  const [loadProgress, setLoadProgress] = useState<{ done: number; total: number } | null>(null)
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' })
  const [store] = useState(() => new PhotoStore())
  const abortRef = useRef<AbortController | null>(null)
  // Server luôn false, client đọc thật sau hydrate — tránh lệch HTML
  const isSupported = useSyncExternalStore(subscribeNoop, isVideoExportSupported, () => false)

  // Cũ → mới, thứ tự của video
  const entries = useMemo(() => [...plant.timeline_entries].reverse(), [plant.timeline_entries])
  const selectedEntries = useMemo(
    () => entries.filter((entry) => !excludedIds.has(entry.id)),
    [entries, excludedIds],
  )

  useEffect(() => {
    let cancelled = false
    Promise.all([loadCanvasFonts(), loadLogo()]).then(([fonts, logo]) => {
      if (!cancelled) {
        setAssets({ fonts, logo })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const paths = entries.map((entry) => entry.photo_path)
    store
      .preload(paths, (done, total) => setLoadProgress({ done, total }))
      .catch(() => {})
  }, [entries, store])

  useEffect(() => () => store.dispose(), [store])

  const scene = useMemo<Scene | null>(
    () =>
      assets && selectedEntries.length > 0
        ? {
            // Ưu tiên danh pháp làm tiêu đề, tên Việt làm dòng phụ
            plantName: getPlantDisplayName(plant).title,
            subtitle: getPlantDisplayName(plant).vernacular,
            slides: buildSlides(selectedEntries),
            ...assets,
          }
        : null,
    [assets, plant, selectedEntries],
  )
  const timeline = useMemo(
    () => buildTimeline(scene?.slides.length ?? 0, settings),
    [scene?.slides.length, settings],
  )

  // Kết quả cũ không còn khớp khi đổi ảnh / cài đặt
  const resultUrl = exportState.status === 'done' ? exportState.url : null
  useEffect(() => () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl)
  }, [resultUrl])

  const updateSettings = (next: VideoSettings) => {
    setSettings(next)
    setExportState({ status: 'idle' })
  }

  const toggleEntry = (id: string) => {
    setExcludedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    setExportState({ status: 'idle' })
  }

  const handleExport = async () => {
    if (!scene) {
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setExportState({ status: 'exporting', progress: 0 })
    try {
      const result = await exportVideo({
        scene,
        settings,
        store,
        signal: controller.signal,
        onProgress: (progress) => setExportState({ status: 'exporting', progress }),
      })
      setExportState({ status: 'done', result, url: URL.createObjectURL(result.blob) })
    } catch (exportError) {
      if (exportError instanceof DOMException && exportError.name === 'AbortError') {
        setExportState({ status: 'idle' })
      } else {
        setExportState({
          status: 'error',
          message: exportError instanceof Error ? exportError.message : String(exportError),
        })
      }
    } finally {
      abortRef.current = null
    }
  }

  const isExporting = exportState.status === 'exporting'
  const isLoadingPhotos = loadProgress != null && loadProgress.done < loadProgress.total

  const { width: outWidth, height: outHeight } = getCanvasSize(settings)

  return (
    <div className="animate-fade-in">
      <Link href={`/plants/${plant.id}`} className="btn-ghost -ml-3 mb-3 max-w-full">
        <ArrowLeftIcon /> <span className="truncate">{plant.name}</span>
      </Link>

      <header className="mb-8 flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-container to-primary text-2xl text-primary-fixed shadow-leaf">
          <FilmIcon />
        </span>
        <div className="min-w-0">
          <p className="eyebrow">Timelapse</p>
          <h1 className="font-serif text-3xl leading-tight font-semibold text-on-surface">Video Nhật ký lá</h1>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            Dựng video timelapse quá trình sinh trưởng từ Nhật ký lá. Video được xử lý ngay trên thiết bị, không tải lên máy chủ.
          </p>
        </div>
      </header>

      {entries.length < 2 ? (
        <div className="card flex flex-col items-center px-6 py-12 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-3xl text-primary">
            <CameraIcon />
          </span>
          <p className="font-serif text-xl font-semibold text-primary">Cần ít nhất 2 ảnh lá</p>
          <p className="mt-1 mb-5 text-sm text-on-surface-variant">
            Mẫu cây này mới có {entries.length} ảnh ghi nhận. Bổ sung ảnh vào Nhật ký để dựng video.
          </p>
          <Link href={`/plants/${plant.id}`} className="btn-primary">
            <CameraIcon /> Ghi nhận ảnh lá
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className="space-y-3">
            {scene ? (
              <VideoPreview
                scene={scene}
                timeline={timeline}
                settings={settings}
                store={store}
                paused={isExporting}
              />
            ) : (
              <div className="skeleton mx-auto flex aspect-[9/16] max-h-[64dvh] items-center justify-center rounded-[1.75rem] text-sm text-on-surface-variant">
                {selectedEntries.length === 0 ? 'Chọn ít nhất 1 ảnh' : 'Đang chuẩn bị…'}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-on-surface-variant">
              <span className="pill bg-surface-container-low">{selectedEntries.length} ảnh</span>
              <span className="pill bg-surface-container-low">{Math.round(timeline.duration)} giây</span>
              <span className="pill bg-surface-container-low">
                {outWidth}×{outHeight}
              </span>
              {isLoadingPhotos ? (
                <span className="pill bg-secondary-container text-primary">
                  Đang tải ảnh {loadProgress.done}/{loadProgress.total}…
                </span>
              ) : null}
            </div>
          </section>

          <aside className="space-y-5">
            <div className="card p-5 sm:p-6">
              <h2 className="mb-4 font-serif text-xl font-semibold text-on-surface">Tuỳ chỉnh</h2>
              <VideoSettingsPanel settings={settings} onChange={updateSettings} disabled={isExporting} />
            </div>

            <div className="card p-5 sm:p-6">
              <ExportPanel
                state={exportState}
                plant={plant}
                canExport={Boolean(scene) && isSupported}
                isSupported={isSupported}
                duration={timeline.duration}
                onExport={handleExport}
                onCancel={() => abortRef.current?.abort()}
              />
            </div>
          </aside>

          <section className="lg:col-span-2">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-on-surface">Ảnh trong video</h2>
                <p className="text-sm text-on-surface-variant">
                  Đã chọn {selectedEntries.length}/{entries.length} · bấm ảnh để bỏ / chọn lại
                </p>
              </div>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => {
                  setExcludedIds(excludedIds.size > 0 ? new Set() : new Set(entries.map((entry) => entry.id)))
                  setExportState({ status: 'idle' })
                }}
                className="btn-ghost -mr-2"
              >
                {excludedIds.size > 0 ? 'Chọn tất cả' : 'Bỏ chọn hết'}
              </button>
            </div>
            <ol className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
              {entries.map((entry, index) => {
                const selected = !excludedIds.has(entry.id)
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => toggleEntry(entry.id)}
                      aria-pressed={selected}
                      aria-label={`Ảnh ${index + 1}, ${formatDate(entry.taken_at)} — ${selected ? 'đang chọn' : 'đã bỏ'}`}
                      className={`relative block w-full overflow-hidden rounded-2xl transition-[opacity,filter,box-shadow] ${
                        selected
                          ? 'shadow-leaf ring-3 ring-primary ring-offset-2 ring-offset-surface'
                          : 'opacity-45 grayscale hover:opacity-70'
                      }`}
                    >
                      <PlantPhoto
                        path={entry.thumb_path ?? entry.photo_path}
                        alt=""
                        className="aspect-square w-full"
                      />
                      <span className="pill absolute top-1.5 left-1.5 bg-black/50 text-white backdrop-blur">{index + 1}</span>
                      <span
                        className={`absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors ${
                          selected ? 'bg-primary text-on-primary' : 'bg-white/80 text-transparent ring-1 ring-outline-variant'
                        }`}
                        aria-hidden="true"
                      >
                        <CheckIcon />
                      </span>
                    </button>
                    <p className="mt-1.5 text-center text-[11px] text-on-surface-variant tabular-nums">
                      {formatDate(entry.taken_at)}
                    </p>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>
      )}
    </div>
  )
}

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function ExportPanel({
  state,
  plant,
  canExport,
  isSupported,
  duration,
  onExport,
  onCancel,
}: {
  state: ExportState
  plant: Plant
  canExport: boolean
  isSupported: boolean
  duration: number
  onExport: () => void
  onCancel: () => void
}) {
  if (!isSupported) {
    return (
      <p className="flex gap-3 rounded-2xl bg-error-container px-4 py-3 text-sm text-on-error-container">
        <AlertIcon className="mt-0.5 text-base" />
        Trình duyệt này chưa hỗ trợ tạo video (WebCodecs). Hãy dùng Chrome, Edge hoặc Safari bản mới — vẫn có thể xem
        trước ở trên.
      </p>
    )
  }

  if (state.status === 'exporting') {
    const percent = Math.round(state.progress * 100)
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm font-semibold text-on-surface">
          <span className="flex items-center gap-2">
            <FilmIcon className="animate-pulse text-primary" /> Đang tạo video…
          </span>
          <span className="tabular-nums">{percent}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-container">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-container to-success-green transition-[width] duration-300"
            style={{ width: `${Math.max(3, percent)}%` }}
          />
        </div>
        <p className="text-xs text-outline">Giữ tab này mở cho tới khi xong.</p>
        <button type="button" onClick={onCancel} className="btn-ghost w-full">
          Huỷ
        </button>
      </div>
    )
  }

  if (state.status === 'done') {
    const { result, url } = state
    const fileName = `${slugify(plant.name) || 'cay'}-nhat-ky-la.${result.extension}`
    const sizeMb = (result.blob.size / 1024 / 1024).toFixed(1)
    const file = new File([result.blob], fileName, { type: result.blob.type })
    const canShare = typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })

    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 font-serif text-lg font-semibold text-primary">
          <CheckIcon className="text-success-green" /> Video đã sẵn sàng
        </p>
        <video src={url} controls playsInline className="max-h-[50dvh] w-full rounded-2xl bg-inverse-surface" />
        <p className="text-xs text-outline">
          {result.extension.toUpperCase()} · {result.codec.toUpperCase()} · {sizeMb} MB
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <a href={url} download={fileName} className="btn-primary">
            <DownloadIcon /> Tải video
          </a>
          {canShare ? (
            <button
              type="button"
              onClick={() => navigator.share({ files: [file], title: plant.name }).catch(() => {})}
              className="btn-secondary"
            >
              <ShareIcon /> Chia sẻ
            </button>
          ) : null}
        </div>
        <button type="button" onClick={onExport} className="btn-ghost w-full">
          Tạo lại
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {state.status === 'error' ? (
        <p className="flex gap-3 rounded-2xl bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertIcon className="mt-0.5 text-base" />
          {state.message}
        </p>
      ) : null}
      <button type="button" onClick={onExport} disabled={!canExport} className="btn-primary w-full">
        <FilmIcon className="text-lg" /> Tạo video ({Math.round(duration)}s)
      </button>
      <p className="text-xs text-outline">MP4 · 30fps · tải về hoặc chia sẻ thẳng lên mạng xã hội.</p>
    </div>
  )
}
