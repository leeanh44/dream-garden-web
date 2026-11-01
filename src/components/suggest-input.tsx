'use client'

import { useId, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'

/**
 * Ô nhập có danh sách gợi ý (ARIA combobox).
 * Danh sách hiện ngay dưới ô (không nổi) để không bị bàn phím điện thoại / khung cuộn của modal che mất.
 */
export function SuggestInput<T>({
  value,
  onChange,
  options,
  getKey,
  renderOption,
  onSelect,
  status,
  inputClassName = '',
  ...inputProps
}: {
  value: string
  onChange: (value: string) => void
  options: T[]
  getKey: (option: T) => string
  renderOption: (option: T) => ReactNode
  onSelect: (option: T) => void
  /** Dòng trạng thái cuối danh sách (đang tra cứu…) */
  status?: ReactNode
  inputClassName?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onSelect' | 'className'>) {
  const listId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const showList = isOpen && (options.length > 0 || Boolean(status))
  const active = activeIndex >= 0 && activeIndex < options.length ? activeIndex : -1

  const select = (option: T) => {
    onSelect(option)
    setIsOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showList || options.length === 0) {
      if (event.key === 'ArrowDown' && options.length > 0) setIsOpen(true)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? options.length - 1 : index - 1))
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      select(options[active])
    } else if (event.key === 'Escape') {
      // Không để Esc đóng luôn modal chứa ô này
      event.preventDefault()
      event.stopPropagation()
      setIsOpen(false)
    }
  }

  return (
    <div>
      <input
        {...inputProps}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setIsOpen(true)
          setActiveIndex(-1)
        }}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={`field-input ${inputClassName}`}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="mt-1.5 max-h-72 animate-fade-in overflow-y-auto rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-1 shadow-leaf"
        >
          {options.map((option, index) => (
            <li
              key={getKey(option)}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown chạy trước blur → chọn được trước khi danh sách đóng
              onMouseDown={(event) => {
                event.preventDefault()
                select(option)
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer rounded-xl px-3 py-2.5 transition-colors ${
                index === active ? 'bg-secondary-container/70' : 'hover:bg-surface-container'
              }`}
            >
              {renderOption(option)}
            </li>
          ))}
          {status ? <li className="px-3 py-2 text-xs text-outline">{status}</li> : null}
        </ul>
      ) : null}
    </div>
  )
}
