'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/** Bottom sheet trên mobile, hộp thoại giữa màn hình trên desktop (dựa trên <dialog>). */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
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
      className="m-0 mt-auto w-full max-w-none rounded-t-[2rem] bg-surface-container-lowest p-0 text-on-surface shadow-leaf backdrop:bg-inverse-surface/40 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-lg sm:rounded-[2rem]"
    >
      <div className="max-h-[85dvh] overflow-y-auto px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-serif text-2xl text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-on-surface-variant hover:bg-surface-container"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        {open ? children : null}
      </div>
    </dialog>
  )
}
