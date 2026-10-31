'use client'

import type { ReactNode } from 'react'
import {
  ASPECT_LABELS,
  SECONDS_PER_PHOTO_OPTIONS,
  type AspectRatio,
  type VideoSettings,
} from '@/lib/video/settings'

export function VideoSettingsPanel({
  settings,
  onChange,
  disabled,
}: {
  settings: VideoSettings
  onChange: (settings: VideoSettings) => void
  disabled: boolean
}) {
  const set = <K extends keyof VideoSettings>(key: K, value: VideoSettings[K]) =>
    onChange({ ...settings, [key]: value })

  return (
    <fieldset disabled={disabled} className="space-y-5 disabled:opacity-60">
      <Field label="Khung hình">
        <Segmented
          value={settings.aspect}
          options={(Object.keys(ASPECT_LABELS) as AspectRatio[]).map((value) => ({
            value,
            label: ASPECT_LABELS[value],
          }))}
          onChange={(value) => set('aspect', value)}
        />
      </Field>

      <Field label="Mỗi ảnh hiển thị">
        <Segmented
          value={settings.secondsPerPhoto}
          options={SECONDS_PER_PHOTO_OPTIONS.map((value) => ({
            value,
            label: `${String(value).replace('.', ',')}s`,
          }))}
          onChange={(value) => set('secondsPerPhoto', value)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
        <Field label="Chuyển cảnh">
          <Segmented
            value={settings.transition}
            options={[
              { value: 'fade', label: 'Mờ dần' },
              { value: 'cut', label: 'Cắt' },
            ]}
            onChange={(value) => set('transition', value)}
          />
        </Field>
        <Field label="Ảnh trong khung">
          <Segmented
            value={settings.fit}
            options={[
              { value: 'contain', label: 'Vừa khung' },
              { value: 'cover', label: 'Lấp đầy' },
            ]}
            onChange={(value) => set('fit', value)}
          />
        </Field>
      </div>

      <Field label="Độ phân giải">
        <Segmented
          value={settings.quality}
          options={[
            { value: '1080p', label: '1080p · nét' },
            { value: '720p', label: '720p · nhẹ' },
          ]}
          onChange={(value) => set('quality', value)}
        />
      </Field>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <Toggle checked={settings.kenBurns} onChange={(value) => set('kenBurns', value)}>
          Chuyển động máy quay (zoom)
        </Toggle>
        <Toggle checked={settings.showDate} onChange={(value) => set('showDate', value)}>
          Ngày chụp · Ngày thứ N
        </Toggle>
        <Toggle checked={settings.showNotes} onChange={(value) => set('showNotes', value)}>
          Ghi chú quan sát
        </Toggle>
        <Toggle checked={settings.showTitle} onChange={(value) => set('showTitle', value)}>
          Thẻ mở đầu · kết thúc
        </Toggle>
      </div>
    </fieldset>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      {children}
    </div>
  )
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className="chip px-3.5"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-surface-container-low px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container">
      <span className="min-w-0">{children}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-10 shrink-0 rounded-full bg-outline-variant transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  )
}
