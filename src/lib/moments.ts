import type { Plant, TimelineEntry } from '@/lib/garden'

/**
 * "Mỗi lần mở app một điều mới" — chọn nội dung từ chính dữ liệu khu vườn:
 * 1. Khoảnh khắc hôm nay: 1 ảnh đẹp (đã gắn sao) ngẫu nhiên.
 * 2. Nhìn lại: cùng cây, ảnh N tháng / năm trước đặt cạnh ảnh mới nhất.
 * 3. Cột mốc: lá thứ 10, 100 ngày theo dõi… vừa đạt được.
 * Toàn hàm thuần — server dùng để ký sẵn URL ảnh, client dùng để hiển thị.
 */

const DAY_MS = 24 * 60 * 60 * 1000

const activePlants = (plants: Plant[]) => plants.filter((plant) => !plant.is_sold)

const entryTime = (entry: TimelineEntry) => new Date(entry.taken_at).getTime()

export const entryThumb = (entry: TimelineEntry) => entry.thumb_path ?? entry.photo_path

// ---------------------------------------------------------------------------
// 1. Khoảnh khắc hôm nay
// ---------------------------------------------------------------------------

export type Moment = { plant: Plant; entry: TimelineEntry }

/** Ảnh đã gắn sao; vườn chưa gắn sao ảnh nào → ảnh mới nhất của mỗi cây. */
export const getMomentCandidates = (plants: Plant[]): Moment[] => {
  const active = activePlants(plants)
  const featured = active.flatMap((plant) =>
    plant.timeline_entries.filter((entry) => entry.featured_at).map((entry) => ({ plant, entry })),
  )
  if (featured.length > 0) {
    return featured
  }
  return active.flatMap((plant) => (plant.timeline_entries[0] ? [{ plant, entry: plant.timeline_entries[0] }] : []))
}

/**
 * Chọn theo `seed` (0–1, cố định trong 1 lần mở app) + `offset` (bấm "Lá khác").
 * Tránh lặp lại đúng ảnh của lần mở trước khi còn ảnh khác.
 */
export const pickMoment = (candidates: Moment[], seed: number, offset: number, lastShownId: string | null) => {
  if (candidates.length === 0) {
    return null
  }
  let index = Math.floor(seed * candidates.length)
  if (offset === 0 && candidates.length > 1 && candidates[index].entry.id === lastShownId) {
    index += 1
  }
  return candidates[(index + offset) % candidates.length]
}

// ---------------------------------------------------------------------------
// 2. Nhìn lại
// ---------------------------------------------------------------------------

export type LookBack = {
  plant: Plant
  then: TimelineEntry
  now: TimelineEntry
  /** VD: "1 năm trước", "3 tháng trước", "Ngày đầu tiên" */
  label: string
  /** Số ngày giữa 2 ảnh */
  spanDays: number
}

/** Mốc kỷ niệm, ưu tiên mốc xa nhất. Sai lệch cho phép ±3 ngày (ít khi chụp đúng ngày). */
const ANNIVERSARIES = [
  { months: 24, label: '2 năm trước' },
  { months: 12, label: '1 năm trước' },
  { months: 6, label: '6 tháng trước' },
  { months: 3, label: '3 tháng trước' },
  { months: 1, label: '1 tháng trước' },
] as const
const ANNIVERSARY_TOLERANCE_DAYS = 3
/** Không có mốc kỷ niệm → so ảnh đầu tiên với hiện tại, nếu cách nhau đủ lâu. */
const FIRST_LEAF_MIN_SPAN_DAYS = 14

const monthsBefore = (date: Date, months: number) => {
  const result = new Date(date)
  result.setMonth(result.getMonth() - months)
  return result
}

const findNear = (entries: TimelineEntry[], target: Date) => {
  let best: TimelineEntry | null = null
  let bestDiff = ANNIVERSARY_TOLERANCE_DAYS * DAY_MS
  for (const entry of entries) {
    const diff = Math.abs(entryTime(entry) - target.getTime())
    if (diff <= bestDiff) {
      best = entry
      bestDiff = diff
    }
  }
  return best
}

/** Mỗi cây tối đa 1 lần nhìn lại (mốc xa nhất có ảnh); xếp mốc xa trước. */
export const getLookBackCandidates = (plants: Plant[], today: Date): LookBack[] => {
  const results: LookBack[] = []
  for (const plant of activePlants(plants)) {
    const [now, ...older] = plant.timeline_entries
    if (!now || older.length === 0) {
      continue
    }
    let found: LookBack | null = null
    for (const { months, label } of ANNIVERSARIES) {
      const then = findNear(older, monthsBefore(today, months))
      if (then) {
        found = { plant, then, now, label, spanDays: Math.round((entryTime(now) - entryTime(then)) / DAY_MS) }
        break
      }
    }
    if (!found) {
      const first = older.at(-1)!
      const spanDays = Math.round((entryTime(now) - entryTime(first)) / DAY_MS)
      if (spanDays >= FIRST_LEAF_MIN_SPAN_DAYS) {
        found = { plant, then: first, now, label: 'Ngày đầu tiên', spanDays }
      }
    }
    if (found) {
      results.push(found)
    }
  }
  // Mốc kỷ niệm thật được ưu tiên hơn "Ngày đầu tiên"
  return results.sort((left, right) => Number(left.label === 'Ngày đầu tiên') - Number(right.label === 'Ngày đầu tiên'))
}

/** Có mốc kỷ niệm → chọn ngẫu nhiên trong số đó; không thì trong số "Ngày đầu tiên". */
export const pickLookBack = (candidates: LookBack[], seed: number) => {
  if (candidates.length === 0) {
    return null
  }
  const anniversaries = candidates.filter((item) => item.label !== 'Ngày đầu tiên')
  const pool = anniversaries.length > 0 ? anniversaries : candidates
  return pool[Math.floor(seed * pool.length) % pool.length]
}

// ---------------------------------------------------------------------------
// 3. Cột mốc
// ---------------------------------------------------------------------------

export type Milestone = {
  /** Khoá ổn định để ghi nhớ đã xem / đã đóng */
  key: string
  plant: Plant
  kind: 'leaves' | 'days'
  value: number
  achievedAt: Date
}

const LEAF_MILESTONES = [5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500]
const DAY_MILESTONES = [30, 100, 200, 365, 500, 730, 1000, 1095, 1460, 1825]
/** Cột mốc đạt trong khoảng này mới hiện thẻ chúc mừng */
const MILESTONE_FRESH_DAYS = 7

export const getFreshMilestones = (plants: Plant[], today: Date): Milestone[] => {
  const now = today.getTime()
  const isFresh = (date: Date) => date.getTime() <= now && now - date.getTime() <= MILESTONE_FRESH_DAYS * DAY_MS
  const results: Milestone[] = []

  for (const plant of activePlants(plants)) {
    const entries = plant.timeline_entries
    if (entries.length === 0) {
      continue
    }
    // entries xếp mới → cũ: lá thứ N là entries[length - N]
    const leafMark = [...LEAF_MILESTONES].reverse().find((mark) => mark <= entries.length)
    if (leafMark) {
      const achievedAt = new Date(entries[entries.length - leafMark].taken_at)
      if (isFresh(achievedAt)) {
        results.push({ key: `${plant.id}:leaves:${leafMark}`, plant, kind: 'leaves', value: leafMark, achievedAt })
      }
    }

    const first = new Date(entries.at(-1)!.taken_at)
    // Ngày theo dõi thứ N (ngày chụp đầu tiên là ngày 1)
    const dayMark = [...DAY_MILESTONES].reverse().find((mark) => first.getTime() + (mark - 1) * DAY_MS <= now)
    if (dayMark) {
      const achievedAt = new Date(first.getTime() + (dayMark - 1) * DAY_MS)
      if (isFresh(achievedAt)) {
        results.push({ key: `${plant.id}:days:${dayMark}`, plant, kind: 'days', value: dayMark, achievedAt })
      }
    }
  }

  return results.sort((left, right) => right.achievedAt.getTime() - left.achievedAt.getTime())
}

// ---------------------------------------------------------------------------
// Ảnh cần ký sẵn trên server cho trang chủ
// ---------------------------------------------------------------------------

export const getMomentPhotoPaths = (plants: Plant[]) => [
  ...getMomentCandidates(plants).map(({ entry }) => entryThumb(entry)),
  ...getLookBackCandidates(plants, new Date()).map(({ then }) => entryThumb(then)),
]
