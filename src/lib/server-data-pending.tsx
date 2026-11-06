'use client'

import { createContext, useContext, type ReactNode } from 'react'

const ServerDataPendingContext = createContext(false)

/**
 * Bọc phần fallback trong lúc server đang lấy dữ liệu gửi kèm HTML →
 * `usePlants` không tự gọi Supabase (tránh gọi trùng), vẫn hiện dữ liệu đã cache nếu có.
 */
export function ServerDataPending({ children }: { children: ReactNode }) {
  return <ServerDataPendingContext value={true}>{children}</ServerDataPendingContext>
}

export const useServerDataPending = () => useContext(ServerDataPendingContext)
