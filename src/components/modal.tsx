'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const keyboard = useKeyboardViewport(open)

  // Bàn phím vừa mở / chuyển ô nhập → cuộn ô đang focus vào giữa phần nhìn thấy được
  useEffect(() => {
    const container = scrollRef.current
    if (!open || !container) {
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const reveal = () => {
      const target = document.activeElement
      if (target instanceof HTMLElement && container.contains(target) && target.matches('input, textarea, select')) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
    const onFocusIn = () => {
      clearTimeout(timer)
      // Chờ bàn phím trượt lên xong (~300ms) rồi mới cuộn
      timer = setTimeout(reveal, 320)
    }
    container.addEventListener('focusin', onFocusIn)
    return () => {
      clearTimeout(timer)
      container.removeEventListener('focusin', onFocusIn)
    }
  }, [open])

  useEffect(() => {
    if (keyboard.inset > 0) {
      const target = document.activeElement
      if (target instanceof HTMLElement && scrollRef.current?.contains(target)) {
        target.scrollIntoView({ block: 'center' })
      }
    }
  }, [keyboard.inset])

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
      style={keyboard.inset > 0 ? { marginBottom: keyboard.inset } : undefined}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose()
        }
      }}
      className="m-0 mt-auto w-full max-w-none overflow-hidden rounded-t-[2rem] bg-surface-container-lowest p-0 text-on-surface shadow-leaf-lg backdrop:bg-[#001a10]/45 backdrop:backdrop-blur-sm open:animate-fade-up sm:m-auto sm:max-w-lg sm:rounded-[2rem]"
    >
      <div
        ref={scrollRef}
        style={keyboard.inset > 0 ? { maxHeight: Math.max(240, keyboard.height - 12) } : undefined}
        className="max-h-[88dvh] overflow-y-auto overscroll-contain px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:px-6 sm:pt-6">
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

/**
 * iOS Safari không thu nhỏ layout viewport khi bàn phím mở → bottom sheet bị che.
 * Đo phần bàn phím chiếm qua VisualViewport để đẩy sheet lên & giới hạn chiều cao.
 */
function useKeyboardViewport(active: boolean) {
  const [state, setState] = useState({ inset: 0, height: 0 })

  useEffect(() => {
    const viewport = typeof window === 'undefined' ? null : window.visualViewport
    if (!active || !viewport) {
      return
    }
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
      // Bỏ qua chênh lệch nhỏ (thanh địa chỉ co giãn)
      const next = inset > 80 ? { inset, height: Math.round(viewport.height) } : { inset: 0, height: 0 }
      setState((current) => (current.inset === next.inset && current.height === next.height ? current : next))
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      setState({ inset: 0, height: 0 })
    }
  }, [active])

  return state
}
