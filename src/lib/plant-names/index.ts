import { PLANT_NAMES, type PlantNameEntry } from './dictionary'

export type { PlantNameEntry }

/** Bỏ dấu, chữ thường, gộp khoảng trắng — để "trau ba" khớp "Trầu bà". */
export const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[’'"]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

// ---------------------------------------------------------------------------
// Danh pháp
// ---------------------------------------------------------------------------

/** Tách "Monstera deliciosa 'Thai Constellation'" → { latin, cultivar }. */
export const splitScientificName = (value: string | null | undefined) => {
  const text = value?.trim() ?? ''
  const match = text.match(/^(.*?)\s*['‘’"“”](.+?)['‘’"“”]\s*$/)
  if (match) {
    return { latin: match[1].trim(), cultivar: match[2].trim() }
  }
  return { latin: text, cultivar: '' }
}

/** Danh pháp đầy đủ dạng chữ: chi loài 'Dòng'. */
export const formatScientificName = (latin: string, cultivar?: string | null) => {
  const name = latin.trim()
  const line = cultivar?.trim()
  if (!name) return line ?? ''
  return line ? `${name} ‘${line}’` : name
}

/**
 * Tên hiển thị của một cây — ưu tiên danh pháp khoa học, tên Việt làm phụ đề.
 * Không có danh pháp → dùng tên Việt.
 */
export const getPlantDisplayName = (plant: { name: string; scientific_name: string | null; cultivar: string | null }) => {
  const { latin, cultivar: quoted } = splitScientificName(plant.scientific_name)
  const cultivar = quoted || plant.cultivar?.trim() || ''
  const vernacular = plant.name.trim()

  if (!latin) {
    return { title: vernacular, latin: null, cultivar: plant.cultivar?.trim() || null, vernacular: null }
  }
  const title = formatScientificName(latin, cultivar)
  return {
    title,
    latin,
    cultivar: cultivar || null,
    vernacular: vernacular && normalizeName(vernacular) !== normalizeName(title) ? vernacular : null,
  }
}

// ---------------------------------------------------------------------------
// Gợi ý từ từ điển
// ---------------------------------------------------------------------------

export type NameSuggestion = {
  id: string
  vi: string
  scientific: string
  cultivar: string
  /** Gợi ý lấy từ chính kho cây của người dùng */
  own?: boolean
}

type Indexed = NameSuggestion & { haystacks: string[] }

const toIndexed = (entry: PlantNameEntry, index: number): Indexed => ({
  id: `dict-${index}`,
  vi: entry.vi,
  scientific: entry.scientific,
  cultivar: entry.cultivar ?? '',
  haystacks: [entry.vi, ...(entry.aliases ?? []), formatScientificName(entry.scientific, entry.cultivar)].map(normalizeName),
})

const DICTIONARY = PLANT_NAMES.map(toIndexed)

/** Điểm khớp: trùng hẳn > đầu chuỗi > đầu một từ > chứa; mọi từ khoá đều phải có mặt. */
const scoreHaystack = (haystack: string, query: string, terms: string[]) => {
  if (!terms.every((term) => haystack.includes(term))) return 0
  if (haystack === query) return 100
  if (haystack.startsWith(query)) return 80
  if (haystack.includes(` ${query}`)) return 60
  return 30
}

/**
 * Tìm tên trong từ điển + các cây đã nhập (`own`). Kết quả đã sắp theo độ khớp,
 * bỏ trùng theo (tên khoa học, dòng).
 */
export const searchPlantNames = (query: string, own: NameSuggestion[] = [], limit = 8): NameSuggestion[] => {
  const normalized = normalizeName(query)
  if (normalized.length < 1) return []
  const terms = normalized.split(' ')

  const ownIndexed: Indexed[] = own.map((item) => ({
    ...item,
    own: true,
    haystacks: [item.vi, formatScientificName(item.scientific, item.cultivar)].map(normalizeName),
  }))

  const scored = [...ownIndexed, ...DICTIONARY]
    .map((item, order) => {
      const score = Math.max(...item.haystacks.map((haystack) => scoreHaystack(haystack, normalized, terms)))
      // Cây của chính người dùng được ưu tiên nhẹ
      return { item, score: score + (item.own && score > 0 ? 5 : 0), order }
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.order - right.order)

  const seen = new Set<string>()
  const results: NameSuggestion[] = []
  for (const { item } of scored) {
    const key = normalizeName(formatScientificName(item.scientific, item.cultivar)) || normalizeName(item.vi)
    if (seen.has(key)) continue
    seen.add(key)
    results.push({ id: item.id, vi: item.vi, scientific: item.scientific, cultivar: item.cultivar, own: item.own })
    if (results.length >= limit) break
  }
  return results
}

// ---------------------------------------------------------------------------
// GBIF — kiểm tra / gợi ý danh pháp Latin
// ---------------------------------------------------------------------------

export type GbifSuggestion = {
  key: number
  name: string
  family: string | null
  rank: string
  /** Tên đã bị thay → `acceptedName` là tên đúng hiện hành */
  isSynonym: boolean
  acceptedName: string | null
}

type GbifRow = {
  key: number
  canonicalName?: string
  family?: string
  rank: string
  synonym?: boolean
  species?: string
  genus?: string
}

/** Gợi ý tên Latin trong giới Thực vật từ GBIF Backbone Taxonomy (miễn phí, có CORS). */
export const fetchGbifSuggestions = async (query: string, signal?: AbortSignal): Promise<GbifSuggestion[]> => {
  const url = new URL('https://api.gbif.org/v1/species/suggest')
  url.searchParams.set('q', query)
  url.searchParams.set('highertaxonKey', '6') // Plantae
  url.searchParams.set('limit', '12')
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Không tra được GBIF.')
  const rows = (await response.json()) as GbifRow[]

  const seen = new Set<string>()
  const results: GbifSuggestion[] = []
  for (const row of rows) {
    const name = row.canonicalName
    if (!name || !['GENUS', 'SPECIES', 'SUBSPECIES', 'VARIETY', 'FORM'].includes(row.rank) || seen.has(name)) continue
    seen.add(name)
    const accepted = row.synonym ? (row.rank === 'GENUS' ? row.genus : row.species) : null
    results.push({
      key: row.key,
      name,
      family: row.family ?? null,
      rank: row.rank,
      isSynonym: Boolean(row.synonym),
      acceptedName: accepted && accepted !== name ? accepted : null,
    })
    if (results.length >= 6) break
  }
  return results
}
