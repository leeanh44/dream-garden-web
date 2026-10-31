import type { Metadata, Viewport } from 'next'
import { Lora, Plus_Jakarta_Sans } from 'next/font/google'
import { preconnect } from 'react-dom'
import { Providers } from '@/components/providers'
import { APP_NAME } from '@/lib/garden'
import { SUPABASE_URL } from '@/lib/supabase/env'
import './globals.css'

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin', 'vietnamese'],
  style: ['normal', 'italic'],
})

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin', 'vietnamese'],
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
  themeColor: '#f7faf9',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  // Mở sẵn kết nối tới Supabase (API + Storage) trước khi JS chạy → ảnh và dữ liệu về sớm hơn
  if (SUPABASE_URL) {
    preconnect(SUPABASE_URL, { crossOrigin: 'anonymous' })
    preconnect(SUPABASE_URL)
  }
  return (
    <html lang="vi" className={`${lora.variable} ${jakarta.variable} antialiased`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
