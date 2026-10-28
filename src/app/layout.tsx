import type { Metadata, Viewport } from 'next'
import { Lora, Plus_Jakarta_Sans } from 'next/font/google'
import { Providers } from '@/components/providers'
import { APP_NAME } from '@/lib/garden'
import './globals.css'

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin', 'vietnamese'],
})

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin', 'vietnamese'],
})

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Quản lý vườn kiểng lá — nhật ký lá, giao dịch, video timelapse.',
}

export const viewport: Viewport = {
  themeColor: '#f7faf9',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={`${lora.variable} ${jakarta.variable} antialiased`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
