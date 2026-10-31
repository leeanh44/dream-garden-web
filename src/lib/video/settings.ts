export type AspectRatio = '9:16' | '1:1' | '16:9'
export type VideoQuality = '720p' | '1080p'

export type VideoSettings = {
  aspect: AspectRatio
  quality: VideoQuality
  /** Thời gian hiển thị mỗi ảnh (giây), chưa tính chuyển cảnh */
  secondsPerPhoto: number
  transition: 'fade' | 'cut'
  /** contain: giữ trọn ảnh + nền mờ · cover: lấp đầy khung (có thể cắt) */
  fit: 'contain' | 'cover'
  kenBurns: boolean
  showDate: boolean
  showNotes: boolean
  /** Thẻ mở đầu / kết thúc + tên cây ở góc trên */
  showTitle: boolean
}

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  aspect: '9:16',
  quality: '1080p',
  secondsPerPhoto: 1.2,
  transition: 'fade',
  fit: 'contain',
  kenBurns: true,
  showDate: true,
  showNotes: true,
  showTitle: true,
}

export const ASPECT_LABELS: Record<AspectRatio, string> = {
  '9:16': '9:16 · Reels/TikTok',
  '1:1': '1:1 · Feed',
  '16:9': '16:9 · YouTube',
}

export const SECONDS_PER_PHOTO_OPTIONS = [0.5, 0.8, 1.2, 2, 3] as const

export const VIDEO_FPS = 30

export const getCanvasSize = ({ aspect, quality }: Pick<VideoSettings, 'aspect' | 'quality'>) => {
  const short = quality === '1080p' ? 1080 : 720
  const long = Math.round((short * 16) / 9)
  if (aspect === '9:16') {
    return { width: short, height: long }
  }
  if (aspect === '16:9') {
    return { width: long, height: short }
  }
  return { width: short, height: short }
}
