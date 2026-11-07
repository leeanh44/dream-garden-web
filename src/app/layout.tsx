import type { Metadata, Viewport } from 'next'
import { Be_Vietnam_Pro, Fraunces } from 'next/font/google'
import { preconnect } from 'react-dom'
import { Providers } from '@/components/providers'
import { APP_NAME } from '@/lib/garden'
import { SUPABASE_URL } from '@/lib/supabase/env'
import { THEME_COLORS, THEME_INIT_SCRIPT } from '@/lib/theme'
import './globals.css'

// Tiêu đề, tên cây (nghiêng cho tên khoa học) — variable font, có tiếng Việt
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin', 'vietnamese'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
})

// Nội dung — không preload để khỏi giành băng thông (fallback đã chỉnh cỡ nên không xô lệch)
const vietnam = Be_Vietnam_Pro({
  variable: '--font-vietnam',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  preload: false,
})

export const metadata: Metadata = {
  title: APP_NAME,
  applicationName: APP_NAME,
  // iOS: mở toàn màn hình khi chạy từ màn hình chính
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  description: 'Quản lý bộ sưu tập kiểng lá variegated — nhật ký sinh trưởng, định giá, video timelapse.',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Android Chrome: bàn phím thu nhỏ viewport → dvh & bottom sheet tự co theo
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  // Mở sẵn kết nối tới Supabase (API + Storage) trước khi JS chạy → ảnh và dữ liệu về sớm hơn
  if (SUPABASE_URL) {
    preconnect(SUPABASE_URL, { crossOrigin: 'anonymous' })
    preconnect(SUPABASE_URL)
  }
  return (
    // data-theme do script trong <head> gắn trước khi hydrate → bỏ qua cảnh báo lệch thuộc tính
    <html lang="vi" className={`${fraunces.variable} ${vietnam.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
