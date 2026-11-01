'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon } from '@/components/icons'

/** Bottom sheet trên mobile, hộp thoại giữa màn hình trên desktop (dựa trên <dialog>). */
export function Modal({
  open,
  onClose,
  title,
  icon,
  plainIcon = false,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  icon?: ReactNode
  /** Icon là ảnh minh hoạ → hiện trần, không khung nền */
  plainIcon?: boolean
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal tự focus phần tử đầu tiên (nút Đóng) → chuyển về ô nhập được đánh dấu
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose()
        }
      }}
      className="m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-[2rem] bg-surface-container-lowest p-0 text-on-surface shadow-leaf-lg backdrop:bg-[#001a10]/45 backdrop:backdrop-blur-sm open:animate-fade-up sm:m-auto sm:max-w-lg sm:rounded-[2rem]"
    >
      <div className="max-h-[88dvh] overflow-y-auto px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:px-6 sm:pt-6">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-outline-variant sm:hidden" aria-hidden="true" />
        <div className="mb-5 flex items-center gap-3">
          {icon && plainIcon ? icon : null}
          {icon && !plainIcon ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary-container text-primary">
              {icon}
            </span>
          ) : null}
          <h2 className="min-w-0 flex-1 font-serif text-2xl font-semibold text-primary">{title}</h2>
          <button type="button" onClick={onClose} className="btn-icon -mr-2" aria-label="Đóng">
            <CloseIcon />
          </button>
        </div>
        {open ? children : null}
      </div>
    </dialog>
  )
}
