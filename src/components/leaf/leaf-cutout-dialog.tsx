'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  CheckIcon,
  CloseIcon,
  MinusCircleIcon,
  PlusCircleIcon,
  ScissorsIcon,
  SparkleIcon,
  UndoIcon,
} from '@/components/icons'
import { formatDate, formatVarRatio, type Plant, type TimelineEntry } from '@/lib/garden'
import { estimateVarRatio, maskToCanvas, refineMask, renderCutout, toWorkImage, type LeafMask } from '@/lib/leaf/cutout'
import { getSamClient, type ModelProgress, type SamMasks } from '@/lib/leaf/sam-client'
import type { SamPoint } from '@/lib/leaf/sam-protocol'
import { getSignedPhotoUrl } from '@/lib/photos'
import { useCreateLeafCutout } from '@/lib/queries'
import { getPlantDisplayName } from '@/lib/plant-names'

const LEVEL_LABELS = ['Chi tiết', 'Vừa', 'Cả lá']

type Phase =
  | { name: 'model'; progress: ModelProgress | null }
  | { name: 'analyzing' }
  | { name: 'ready' }
  | { name: 'error'; message: string }

/** Tách chiếc lá khỏi nền bằng Segment Anything — chạm để chọn, chạy hoàn toàn trên thiết bị. */
export function LeafCutoutDialog({
  plant,
  entry,
  onClose,
  onSaved,
}: {
  plant: Plant
  entry: TimelineEntry | null
  onClose: () => void
  onSaved?: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (entry && !dialog.open) dialog.showModal()
    else if (!entry && dialog.open) dialog.close()
  }, [entry])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-[#06140e] p-0 text-white backdrop:bg-black/90"
      aria-label="Tách lá"
    >
      {entry ? <CutoutEditor key={entry.id} plant={plant} entry={entry} onClose={onClose} onSaved={onSaved} /> : null}
    </dialog>
  )
}

function CutoutEditor({
  plant,
  entry,
  onClose,
  onSaved,
}: {
  plant: Plant
  entry: TimelineEntry
  onClose: () => void
  onSaved?: () => void
}) {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const sourceRef = useRef<ImageBitmap | null>(null)
  const workRef = useRef<{ canvas: HTMLCanvasElement; imageData: ImageData } | null>(null)
  const decodeSeq = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<{ width: number; height: number } | null>(null)

  const [phase, setPhase] = useState<Phase>({ name: 'model', progress: null })
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [points, setPoints] = useState<SamPoint[]>([])
  const [mode, setMode] = useState<0 | 1>(1)
  const [decoded, setDecoded] = useState<{ masks: SamMasks; points: SamPoint[]; imageData: ImageData } | null>(null)
  /** Mức tách người dùng chọn (0 = chi tiết … 2 = cả vật thể); null = tự chọn */
  const [level, setLevel] = useState<number | null>(null)
  const [isDecoding, setIsDecoding] = useState(false)
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const createCutout = useCreateLeafCutout()

  // Tự chọn mức: SAM hay coi mảng xanh và mảng var là hai vật khác nhau và chấm điểm mảnh nhỏ cao hơn.
  // Với lá variegated, mức "cả vật thể" (mặt nạ lớn nhất) mới gom đủ cả lá — chọn mức đó,
  // trừ khi nó phủ gần hết ảnh (lấy cả nền) hoặc SAM quá thiếu tự tin.
  const autoLevel = useMemo(() => {
    if (!decoded) return 0
    const { candidates, width, height } = decoded.masks
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index]
      if (candidate.score >= 0.5 && candidate.area < width * height * 0.85) return index
    }
    return 0
  }, [decoded])
  const activeLevel = decoded ? Math.min(level ?? autoLevel, decoded.masks.candidates.length - 1) : 0

  const mask = useMemo<LeafMask | null>(() => {
    if (!decoded) return null
    const { candidates, width, height } = decoded.masks
    return refineMask(candidates[activeLevel].mask, width, height, decoded.points)
  }, [decoded, activeLevel])

  const varRatio = useMemo(() => (mask && decoded ? estimateVarRatio(decoded.imageData, mask) : null), [mask, decoded])


  // 1) Tải mô hình + ảnh gốc song song, 2) mã hoá ảnh
  useEffect(() => {
    let cancelled = false
    const client = getSamClient()

    const loadPhoto = async () => {
      const url = await getSignedPhotoUrl(entry.photo_path)
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Không tải được ảnh (${response.status})`)
      return createImageBitmap(await response.blob())
    }

    ;(async () => {
      try {
        const [bitmap] = await Promise.all([
          loadPhoto(),
          client.load((progress) => !cancelled && setPhase({ name: 'model', progress })),
        ])
        if (cancelled) {
          bitmap.close()
          return
        }
        sourceRef.current = bitmap
        const work = toWorkImage(bitmap)
        workRef.current = work
        setSize({ width: work.canvas.width, height: work.canvas.height })
        setPhase({ name: 'analyzing' })
        await client.embed(work.imageData)
        if (!cancelled) setPhase({ name: 'ready' })
      } catch (error) {
        if (!cancelled) {
          setPhase({ name: 'error', message: error instanceof Error ? error.message : String(error) })
        }
      }
    })()

    return () => {
      cancelled = true
      sourceRef.current?.close()
      sourceRef.current = null
    }
  }, [entry.photo_path])

  // Đo vùng hiển thị để ảnh vừa khung, không méo (ngang hay dọc đều được)
  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const observer = new ResizeObserver(([entryRect]) => {
      const { width, height } = entryRect.contentRect
      setStage({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const display =
    size && stage
      ? (() => {
          const scale = Math.min(stage.width / size.width, stage.height / size.height)
          return { width: Math.floor(size.width * scale), height: Math.floor(size.height * scale) }
        })()
      : null

  // Vẽ ảnh nền khi đã biết kích thước
  useEffect(() => {
    const canvas = baseCanvasRef.current
    const work = workRef.current
    if (canvas && work && size) {
      canvas.getContext('2d')?.drawImage(work.canvas, 0, 0)
    }
  }, [size])

  // Vẽ lớp phủ: làm tối nền, viền sáng quanh lá
  useEffect(() => {
    const canvas = overlayCanvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !size) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (!mask) return
    context.fillStyle = 'rgba(4, 16, 10, 0.62)'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.globalCompositeOperation = 'destination-out'
    context.drawImage(maskToCanvas(mask), 0, 0)
    context.globalCompositeOperation = 'source-over'
    // Viền: mặt nạ phồng nhẹ trừ mặt nạ gốc
    const outline = maskToCanvas(mask, '158,244,198')
    context.save()
    context.globalAlpha = 0.9
    for (const [dx, dy] of [
      [-1.5, 0],
      [1.5, 0],
      [0, -1.5],
      [0, 1.5],
    ]) {
      context.drawImage(outline, dx, dy)
    }
    context.globalCompositeOperation = 'destination-out'
    context.drawImage(maskToCanvas(mask), 0, 0)
    context.restore()
  }, [mask, size])

  const runDecode = useCallback(async (nextPoints: SamPoint[]) => {
    const work = workRef.current
    if (!work) return
    if (nextPoints.length === 0) {
      decodeSeq.current += 1
      setDecoded(null)
      setIsDecoding(false)
      return
    }
    const seq = ++decodeSeq.current
    setIsDecoding(true)
    setDecodeError(null)
    try {
      const result = await getSamClient().decode(nextPoints)
      if (seq !== decodeSeq.current) return
      setDecoded({ masks: result, points: nextPoints, imageData: work.imageData })
    } catch (error) {
      if (seq === decodeSeq.current) setDecodeError(error instanceof Error ? error.message : String(error))
    } finally {
      if (seq === decodeSeq.current) setIsDecoding(false)
    }
  }, [])

  const handlePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (phase.name !== 'ready' || createCutout.isPending) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    // Chạm đầu tiên luôn là "chọn lá"
    const label: 0 | 1 = points.length === 0 ? 1 : mode
    const next = [...points, { x, y, label }]
    setPoints(next)
    runDecode(next)
  }

  const undo = () => {
    const next = points.slice(0, -1)
    setPoints(next)
    runDecode(next)
  }

  const reset = () => {
    decodeSeq.current += 1
    setPoints([])
    setDecoded(null)
    setLevel(null)
    setMode(1)
    setIsDecoding(false)
  }

  const save = async () => {
    const source = sourceRef.current
    if (!source || !mask) return
    try {
      const result = await renderCutout(source, mask)
      await createCutout.mutateAsync({
        plantId: plant.id,
        entryId: entry.id,
        ...result,
        varRatio: varRatio ?? 0,
        points: points.map((point) => ({
          x: Math.round(point.x * 10000) / 10000,
          y: Math.round(point.y * 10000) / 10000,
          label: point.label,
        })),
      })
      onSaved?.()
      onClose()
    } catch {
      // lỗi hiển thị qua createCutout.error
    }
  }

  const canSave = phase.name === 'ready' && mask != null && !isDecoding && !createCutout.isPending

  return (
    <div className="flex h-full w-full flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Thanh trên */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-fixed text-lg text-primary">
          <ScissorsIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg leading-tight font-semibold">Tách lá · {getPlantDisplayName(plant).title}</p>
          <p className="text-xs text-white/60">Ảnh ngày {formatDate(entry.taken_at)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20"
          aria-label="Đóng"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Ảnh + lớp phủ */}
      <div className="relative min-h-0 flex-1 px-3">
        <div ref={stageRef} className="flex h-full w-full items-center justify-center">
        {size && display ? (
          <div
            onPointerDown={handlePointer}
            className={`relative touch-none select-none ${phase.name === 'ready' ? 'cursor-crosshair' : 'cursor-wait'}`}
            style={{ width: display.width, height: display.height }}
          >
            <canvas
              ref={baseCanvasRef}
              width={size.width}
              height={size.height}
              className="absolute inset-0 h-full w-full rounded-2xl"
            />
            <canvas
              ref={overlayCanvasRef}
              width={size.width}
              height={size.height}
              className="pointer-events-none absolute inset-0 h-full w-full rounded-2xl"
            />
            {points.map((point, index) => (
              <span
                key={index}
                className={`pointer-events-none absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-bold shadow-lg ring-2 ring-white ${
                  point.label === 1 ? 'bg-success-green text-white' : 'bg-error text-white'
                }`}
                style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                aria-hidden="true"
              >
                {point.label === 1 ? '+' : '−'}
              </span>
            ))}
          </div>
        ) : null}
        </div>

        {phase.name !== 'ready' ? <PhaseOverlay phase={phase} /> : null}
        {isDecoding ? (
          <span className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold backdrop-blur">
            Đang tách…
          </span>
        ) : null}
      </div>

      {/* Điều khiển */}
      <div className="space-y-3 px-4 pt-3 pb-4">
        <p className="text-center text-sm text-white/75">
          {phase.name !== 'ready'
            ? 'Mô hình AI chạy ngay trên thiết bị — ảnh không rời khỏi máy.'
            : points.length === 0
              ? 'Chạm vào chiếc lá muốn tách.'
              : mode === 1
                ? 'Chạm vào phần lá còn thiếu để thêm vào.'
                : 'Chạm vào phần bị lấy dư để bỏ ra.'}
        </p>

        {decoded && decoded.masks.candidates.length > 1 ? (
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="text-white/60">Mức tách</span>
            <div className="flex rounded-full bg-white/10 p-1" role="radiogroup" aria-label="Mức tách">
              {decoded.masks.candidates.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  role="radio"
                  aria-checked={activeLevel === index}
                  onClick={() => setLevel(index)}
                  className={`min-h-8 rounded-full px-3 font-semibold transition-colors ${
                    activeLevel === index ? 'bg-white text-[#06140e]' : 'text-white/70'
                  }`}
                >
                  {LEVEL_LABELS[index] ?? index + 1}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-center gap-2">
          <div className="flex rounded-full bg-white/10 p-1" role="radiogroup" aria-label="Chế độ chạm">
            <button
              type="button"
              role="radio"
              aria-checked={mode === 1}
              onClick={() => setMode(1)}
              className={`flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                mode === 1 ? 'bg-success-green text-white' : 'text-white/70'
              }`}
            >
              <PlusCircleIcon /> Thêm
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 0}
              disabled={points.length === 0}
              onClick={() => setMode(0)}
              className={`flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
                mode === 0 ? 'bg-error text-white' : 'text-white/70'
              }`}
            >
              <MinusCircleIcon /> Bỏ
            </button>
          </div>
          <button
            type="button"
            onClick={undo}
            disabled={points.length === 0}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-lg disabled:opacity-40"
            aria-label="Hoàn tác"
            title="Hoàn tác"
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={points.length === 0}
            className="min-h-12 rounded-full bg-white/10 px-4 text-sm font-semibold disabled:opacity-40"
          >
            Làm lại
          </button>
        </div>

        {decodeError || createCutout.error ? (
          <p className="rounded-2xl bg-error-container px-4 py-2.5 text-sm text-on-error-container">
            {decodeError ?? createCutout.error?.message}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <div className="flex min-h-12 flex-1 items-center gap-2 rounded-2xl bg-white/10 px-4">
            <SparkleIcon className="text-primary-fixed" />
            <span className="text-sm text-white/70">Var ước tính</span>
            <span className="ml-auto font-serif text-xl font-semibold tabular-nums">{formatVarRatio(varRatio)}</span>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="flex min-h-12 items-center gap-2 rounded-full bg-primary-fixed px-5 font-semibold text-primary transition-transform active:scale-95 disabled:opacity-40"
          >
            <CheckIcon />
            {createCutout.isPending ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PhaseOverlay({ phase }: { phase: Phase }) {
  let title = ''
  let detail = ''
  let percent: number | null = null
  if (phase.name === 'model') {
    title = 'Đang tải mô hình AI'
    if (phase.progress && phase.progress.total > 0) {
      percent = Math.round((phase.progress.loaded / phase.progress.total) * 100)
      detail = `${(phase.progress.loaded / 1e6).toFixed(1)} / ${(phase.progress.total / 1e6).toFixed(1)} MB · chỉ tải lần đầu`
    } else {
      detail = 'Chuẩn bị…'
    }
  } else if (phase.name === 'analyzing') {
    title = 'Đang phân tích ảnh'
    detail = 'Vài giây, tuỳ thiết bị'
  } else if (phase.name === 'error') {
    title = 'Không tách được lá'
    detail = phase.message
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#06140e]/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-3xl bg-white/10 p-5 text-center ring-1 ring-white/10">
        {phase.name !== 'error' ? (
          <span className="mx-auto mb-3 block h-10 w-10 animate-spin rounded-full border-4 border-primary-fixed/30 border-t-primary-fixed" />
        ) : null}
        <p className="font-serif text-lg font-semibold">{title}</p>
        <p className="mt-1 text-xs break-words text-white/70">{detail}</p>
        {percent != null ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-primary-fixed transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
