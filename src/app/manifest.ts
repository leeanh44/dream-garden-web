import type { MetadataRoute } from 'next'
import { APP_NAME } from '@/lib/garden'

/** Web App Manifest — cho phép cài lên màn hình chính như một ứng dụng. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: APP_NAME,
    short_name: 'Dream Garden',
    description: 'Quản lý bộ sưu tập kiểng lá variegated — nhật ký sinh trưởng, định giá, video timelapse.',
    lang: 'vi',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#f7faf9',
    theme_color: '#f7faf9',
    categories: ['lifestyle', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Ghi nhận ảnh lá',
        short_name: 'Chụp nhanh',
        description: 'Mở camera, chụp lá rồi chọn mẫu cây',
        url: '/capture',
        icons: [{ src: '/icons/shortcut-camera.png', sizes: '96x96', type: 'image/png' }],
      },
    ],
  }
}
