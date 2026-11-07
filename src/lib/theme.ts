/** Chế độ giao diện: người dùng chọn Sáng / Tối, hoặc Theo máy (mặc định). */
export type ThemePref = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'dg.theme'

/** Màu thanh trạng thái / thanh địa chỉ — trùng màu nền `--dg-surface` của từng chế độ. */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f5f1e6', dark: '#0e1c15' }

/**
 * Chạy trong <head> trước khi trang hiện → gắn `data-theme` ngay, không chớp sai màu.
 * Giữ ngắn gọn, không phụ thuộc gì (chạy trước React).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`
