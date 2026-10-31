import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  getFirstEncodableVideoCodec,
  type VideoCodec,
} from 'mediabunny'
import type { PhotoStore } from './image-store'
import { buildTimeline, getPathsAround, renderFrame, type Scene } from './scene'
import { VIDEO_FPS, getCanvasSize, type VideoSettings } from './settings'

export type ExportResult = {
  blob: Blob
  extension: 'mp4' | 'webm'
  codec: VideoCodec
}

export const isVideoExportSupported = () =>
  typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window

/** Ưu tiên MP4/H.264 (phát được mọi nơi, đăng MXH được); fallback WebM nếu trình duyệt không encode được. */
const pickFormat = async (width: number, height: number) => {
  const mp4Codec = await getFirstEncodableVideoCodec(['avc', 'hevc'], { width, height, quality: QUALITY_HIGH })
  if (mp4Codec) {
    return { codec: mp4Codec, format: new Mp4OutputFormat(), extension: 'mp4' as const, mimeType: 'video/mp4' }
  }
  const webmCodec = await getFirstEncodableVideoCodec(['vp9', 'vp8', 'av1'], {
    width,
    height,
    quality: QUALITY_HIGH,
  })
  if (webmCodec) {
    return { codec: webmCodec, format: new WebMOutputFormat(), extension: 'webm' as const, mimeType: 'video/webm' }
  }
  throw new Error('Trình duyệt không hỗ trợ mã hoá video. Hãy dùng Chrome, Edge hoặc Safari bản mới.')
}

export const exportVideo = async ({
  scene,
  settings,
  store,
  onProgress,
  signal,
}: {
  scene: Scene
  settings: VideoSettings
  store: PhotoStore
  onProgress: (progress: number) => void
  signal: AbortSignal
}): Promise<ExportResult> => {
  const { width, height } = getCanvasSize(settings)
  const { codec, format, extension, mimeType } = await pickFormat(width, height)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    throw new Error('Trình duyệt không hỗ trợ canvas.')
  }

  const output = new Output({ format, target: new BufferTarget() })
  const source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH, keyFrameInterval: 2 })
  output.addVideoTrack(source, { frameRate: VIDEO_FPS })
  await output.start()

  const timeline = buildTimeline(scene.slides.length, settings)
  const totalFrames = Math.ceil(timeline.duration * VIDEO_FPS)
  const frameDuration = 1 / VIDEO_FPS

  try {
    for (let frame = 0; frame < totalFrames; frame += 1) {
      if (signal.aborted) {
        throw new DOMException('Đã huỷ', 'AbortError')
      }
      const time = frame * frameDuration
      await store.ensure(getPathsAround(scene, timeline, time))
      renderFrame(ctx, time, scene, timeline, settings, store)
      await source.add(time, frameDuration)

      if (frame % 10 === 0) {
        onProgress(frame / totalFrames)
        // Nhường main thread để UI cập nhật tiến độ
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    await output.finalize()
  } catch (error) {
    await output.cancel().catch(() => {})
    throw error
  }

  onProgress(1)
  const buffer = output.target.buffer
  if (!buffer) {
    throw new Error('Không tạo được file video.')
  }
  return { blob: new Blob([buffer], { type: mimeType }), extension, codec }
}
