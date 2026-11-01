'use client'

import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { ScientificName } from '@/components/scientific-name'
import { SuggestInput } from '@/components/suggest-input'
import {
  fetchGbifSuggestions,
  normalizeName,
  searchPlantNames,
  splitScientificName,
  type GbifSuggestion,
  type NameSuggestion,
} from '@/lib/plant-names'
import { usePlants } from '@/lib/queries'

export type PlantNameValues = { name: string; scientific: string; cultivar: string }

/** Giá trị ban đầu từ một cây: tách dòng ra khỏi danh pháp nếu đang ghi chung ("… 'Albo'"). */
export const toPlantNameValues = (plant: { name: string; scientific_name: string | null; cultivar: string | null }) => {
  const { latin, cultivar } = splitScientificName(plant.scientific_name)
  return { name: plant.name, scientific: latin, cultivar: plant.cultivar?.trim() || cultivar }
}

type ScientificOption = { kind: 'dict'; item: NameSuggestion } | { kind: 'gbif'; item: GbifSuggestion }

const GBIF_MIN_LENGTH = 3
const GBIF_DEBOUNCE_MS = 350

const useDebounced = <T,>(value: T, delay: number) => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function SuggestionRow({ item }: { item: NameSuggestion }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex items-center gap-2 truncate font-semibold text-on-surface">
        <span className="truncate">{item.vi}</span>
        {item.own ? <span className="pill shrink-0 bg-secondary-container text-[10px] text-primary">Trong kho</span> : null}
      </span>
      <span className="truncate font-serif text-sm text-on-surface-variant">
        <ScientificName latin={item.scientific} cultivar={item.cultivar} />
      </span>
    </span>
  )
}

/**
 * Bộ 3 ô Tên cây / Tên khoa học / Dòng có gợi ý:
 * - Tên cây: tra từ điển tên Việt (gõ không dấu được) + các cây đã nhập → chọn là điền cả danh pháp & dòng.
 * - Tên khoa học: từ điển + GBIF (danh pháp chuẩn quốc tế, báo tên cũ đã đổi).
 */
export function PlantNameFields({
  values,
  onChange,
  autoFocus = false,
}: {
  values: PlantNameValues
  onChange: (values: PlantNameValues) => void
  autoFocus?: boolean
}) {
  const { data: plants } = usePlants()

  const ownSuggestions = useMemo<NameSuggestion[]>(
    () =>
      (plants ?? [])
        .filter((plant) => plant.scientific_name?.trim())
        .map((plant) => {
          const own = toPlantNameValues(plant)
          return { id: `own-${plant.id}`, vi: own.name, scientific: own.scientific, cultivar: own.cultivar }
        }),
    [plants],
  )
  const cultivarOptions = useMemo(
    () => [...new Set((plants ?? []).map((plant) => plant.cultivar?.trim()).filter((value): value is string => Boolean(value)))],
    [plants],
  )

  const deferredName = useDeferredValue(values.name)
  const nameOptions = useMemo(() => searchPlantNames(deferredName, ownSuggestions), [deferredName, ownSuggestions])

  const deferredScientific = useDeferredValue(values.scientific)
  const dictScientific = useMemo(
    () => searchPlantNames(deferredScientific, ownSuggestions, 4),
    [deferredScientific, ownSuggestions],
  )
  const gbifQuery = useDebounced(values.scientific.trim(), GBIF_DEBOUNCE_MS)
  const gbif = useQuery({
    queryKey: ['gbif-suggest', normalizeName(gbifQuery)],
    queryFn: ({ signal }) => fetchGbifSuggestions(gbifQuery, signal),
    enabled: gbifQuery.length >= GBIF_MIN_LENGTH,
    staleTime: Infinity,
    retry: false,
  })
  const scientificOptions = useMemo<ScientificOption[]>(() => {
    const dictNames = new Set(dictScientific.map((item) => normalizeName(item.scientific)))
    return [
      ...dictScientific.map((item) => ({ kind: 'dict' as const, item })),
      ...(gbif.data ?? [])
        .filter((item) => !dictNames.has(normalizeName(item.name)))
        .map((item) => ({ kind: 'gbif' as const, item })),
    ]
  }, [dictScientific, gbif.data])

  const pick = (item: NameSuggestion, keepName = false) =>
    onChange({
      name: keepName && values.name.trim() ? values.name : item.vi,
      scientific: item.scientific,
      cultivar: item.cultivar,
    })

  return (
    <>
      <label className="block">
        <span className="field-label">Tên cây</span>
        <SuggestInput
          required
          data-autofocus={autoFocus || undefined}
          value={values.name}
          onChange={(name) => onChange({ ...values, name })}
          options={nameOptions}
          getKey={(item) => item.id}
          renderOption={(item) => <SuggestionRow item={item} />}
          onSelect={(item) => pick(item)}
          placeholder="Gõ tên Việt: trầu bà hồng, monstera thái…"
        />
      </label>

      <div className="grid gap-3 min-[420px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <label className="block min-w-0">
          <span className="field-label">Tên khoa học</span>
          <SuggestInput
            value={values.scientific}
            onChange={(scientific) => onChange({ ...values, scientific })}
            options={scientificOptions}
            getKey={(option) => (option.kind === 'dict' ? option.item.id : `gbif-${option.item.key}`)}
            renderOption={(option) =>
              option.kind === 'dict' ? (
                <SuggestionRow item={option.item} />
              ) : (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-serif text-on-surface">
                    <ScientificName latin={option.item.name} />
                  </span>
                  <span className="truncate text-xs text-outline">
                    {option.item.isSynonym
                      ? option.item.acceptedName
                        ? `Tên cũ → chọn sẽ dùng ${option.item.acceptedName}`
                        : 'Tên đồng nghĩa'
                      : [option.item.family, 'GBIF'].filter(Boolean).join(' · ')}
                  </span>
                </span>
              )
            }
            onSelect={(option) => {
              if (option.kind === 'dict') {
                pick(option.item, true)
              } else {
                onChange({ ...values, scientific: option.item.acceptedName ?? option.item.name })
              }
            }}
            status={
              gbifQuery.length >= GBIF_MIN_LENGTH && gbif.isFetching
                ? 'Đang tra GBIF…'
                : gbif.isError
                  ? 'Không kết nối được GBIF — vẫn nhập tay được.'
                  : null
            }
            inputClassName="font-serif italic"
            placeholder="Monstera deliciosa"
          />
        </label>
        <label className="block min-w-0">
          <span className="field-label">Dòng / cultivar</span>
          <input
            value={values.cultivar}
            onChange={(event) => onChange({ ...values, cultivar: event.target.value })}
            className="field-input"
            placeholder="Thai Constellation"
            list="cultivar-options"
          />
          <datalist id="cultivar-options">
            {cultivarOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
      </div>
    </>
  )
}
