import type { Scene } from './scene'

const FALLBACK_FONTS = { serif: 'Georgia, serif', sans: 'system-ui, sans-serif' }

/**
 * next/font đặt tên font dạng hash qua CSS variable (--font-lora, --font-jakarta trên <html>).
 * Canvas cần tên family thật + font đã tải xong trước khi vẽ.
 */
export const loadCanvasFonts = async (): Promise<Scene['fonts']> => {
  const style = getComputedStyle(document.documentElement)
  const serif = style.getPropertyValue('--font-lora').trim() || FALLBACK_FONTS.serif
  const sans = style.getPropertyValue('--font-jakarta').trim() || FALLBACK_FONTS.sans

  // Tải đúng các weight/style mà scene.ts dùng, kèm ký tự tiếng Việt
  const sample = 'Nhật ký lá Ngày ữệ'
  await Promise.all(
    [
      `600 40px ${serif}`,
      `italic 400 40px ${serif}`,
      `500 40px ${sans}`,
      `600 40px ${sans}`,
      `700 40px ${sans}`,
    ].map((font) => document.fonts.load(font, sample).catch(() => [])),
  )

  return { serif, sans }
}

export const loadLogo = async (): Promise<CanvasImageSource | null> => {
  try {
    const image = new Image()
    image.src = '/icons/icon-512.png'
    await image.decode()
    return image
  } catch {
    return null
  }
}
