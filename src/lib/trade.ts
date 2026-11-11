import { formatVndAmount, parseVndAmount, type Plant } from '@/lib/garden'

// Giao dịch — port từ app iOS (tab Giao dịch + tab Xuất trong chi tiết cây).
// Bảng `sales` và `trade_logs` có sẵn từ supabase/migrations/0001_init.sql.

/** Một lượt xuất (bán cành / ngọn / cả cây) — cây vẫn ở trong vườn trừ khi đánh dấu "đã bán hẳn". */
export type Sale = {
  id: string
  plant_id: string
  /** `yyyy-mm-dd` */
  sold_at: string
  sold_price: number | null
  created_at: string
}

/** Nhật ký nhập / xuất dạng text tự do — mỗi dòng một giao dịch, giá ở cuối dòng. */
export type TradeLogs = { buy_log: string; sell_log: string }

export const EMPTY_TRADE_LOGS: TradeLogs = { buy_log: '', sell_log: '' }

export const TRADE_LOG_EXAMPLE = '01/03/2025 · Monstera · 250.000 ₫'

const logDateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** `yyyy-mm-dd` (ngày địa phương) hoặc ISO → "01/03/2025" — không lệch ngày do múi giờ. */
const formatLogDate = (value: string) => {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return logDateFormatter.format(dateOnly ? new Date(`${value}T00:00:00`) : new Date(value))
}

/** "01/03/2025 · Monstera · 250.000 ₫" (không có giá → "—"). */
export const formatTradeLogLine = (date: string, plantName: string, price: number | null) =>
  `${formatLogDate(date)} · ${plantName} · ${price != null ? formatVndAmount(price) : '—'}`

export const appendTradeLogLine = (log: string, line: string) => {
  const trimmedLine = line.trim()
  if (!trimmedLine) {
    return log
  }
  const trimmedLog = log.trim()
  return trimmedLog ? `${trimmedLog}\n${trimmedLine}` : trimmedLine
}

/** Giá viết tắt: 350k · 1,2tr · 2 triệu (lấy cụm cuối cùng). */
const parseShorthandAmount = (text: string): number | null => {
  const match = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|tr|triệu)(?![\p{L}])/giu)].at(-1)
  if (!match) {
    return null
  }
  const amount = Number(match[1].replace(',', '.')) * (/^(k|nghìn|ngàn)$/i.test(match[2]) ? 1_000 : 1_000_000)
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null
}

/**
 * Giá của một dòng nhật ký: ưu tiên đoạn cuối sau dấu "·", rồi viết tắt (350k, 1,2tr),
 * số có đơn vị ₫ / đ / vnd, cuối cùng là số cuối dòng (bỏ qua ngày dạng 01/03).
 */
export const parseTradeLogAmount = (line: string): number | null => {
  const trimmed = line.trim()
  if (!trimmed || trimmed === '—' || trimmed === '-') {
    return null
  }

  const segments = trimmed.split('·').map((segment) => segment.trim())
  if (segments.length > 1) {
    const last = segments[segments.length - 1]
    // Dòng tự sinh khi không nhập giá: "01/03/2025 · Monstera · —"
    if (last === '—' || last === '-') {
      return null
    }
    const fromLastSegment = parseShorthandAmount(last) ?? parseVndAmount(last)
    if (fromLastSegment != null) {
      return fromLastSegment
    }
  }

  // Bỏ ngày tháng (01/03, 01/03/2025, 1-3-25) để năm / ngày không bị hiểu nhầm là giá
  const withoutDates = trimmed.replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, ' ')

  const fromShorthand = parseShorthandAmount(withoutDates)
  if (fromShorthand != null) {
    return fromShorthand
  }

  const currencyMatch = withoutDates.match(/([\d.,\s]+)\s*(?:₫|đ|vnd)/i)
  if (currencyMatch) {
    const fromCurrency = parseVndAmount(currencyMatch[0])
    if (fromCurrency != null) {
      return fromCurrency
    }
  }

  const numbers = [...withoutDates.matchAll(/(\d[\d.,]*)/g)]
  for (let index = numbers.length - 1; index >= 0; index--) {
    const text = numbers[index][1]
    const value = parseVndAmount(text)
    if (value != null) {
      return value
    }
  }
  return null
}

export type TradeLogSum = { total: number; countedLines: number; lineCount: number }

export const sumTradeLog = (log: string): TradeLogSum => {
  const lines = log
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  let total = 0
  let countedLines = 0
  for (const line of lines) {
    const amount = parseTradeLogAmount(line)
    if (amount == null) continue
    total += amount
    countedLines += 1
  }
  return { total, countedLines, lineCount: lines.length }
}

/** Lượt xuất theo cây, mới nhất trước. */
export const groupSalesByPlant = (sales: Sale[]) => {
  const groups = new Map<string, Sale[]>()
  for (const sale of sales) {
    const list = groups.get(sale.plant_id) ?? []
    list.push(sale)
    groups.set(sale.plant_id, list)
  }
  for (const list of groups.values()) {
    list.sort((left, right) => right.sold_at.localeCompare(left.sold_at) || right.created_at.localeCompare(left.created_at))
  }
  return groups
}

/**
 * Thống kê tab Giao dịch (giống app iOS). Bản ghi xuất thủ công (`is_manual_sold_record`)
 * không tính vào thống kê / định giá.
 */
export const computeTradeStats = (plants: Plant[], sales: Sale[]) => {
  const tracked = plants.filter((plant) => !plant.is_manual_sold_record)
  const trackedIds = new Set(tracked.map((plant) => plant.id))
  const inGarden = tracked.filter((plant) => !plant.is_sold)
  const soldOut = tracked.filter((plant) => plant.is_sold)
  const trackedSales = sales.filter((sale) => trackedIds.has(sale.plant_id))
  const pricedSales = trackedSales.filter((sale) => sale.sold_price != null)
  const valued = inGarden.filter((plant) => plant.market_value != null && plant.market_value > 0)

  const totalPurchaseCost = tracked.reduce((sum, plant) => sum + (plant.purchase_price ?? 0), 0)
  const totalRevenue = pricedSales.reduce((sum, sale) => sum + (sale.sold_price ?? 0), 0)
  // Vốn của cây đã bán hẳn — so với tổng thu để ước tính lãi / lỗ
  const soldCostBasis = soldOut.reduce((sum, plant) => sum + (plant.purchase_price ?? 0), 0)

  return {
    totalBought: tracked.length,
    inGarden: inGarden.length,
    soldOut: soldOut.length,
    saleCount: trackedSales.length,
    totalPurchaseCost,
    totalRevenue,
    estimatedProfit: pricedSales.length > 0 ? totalRevenue - soldCostBasis : null,
    marketValue: valued.reduce((sum, plant) => sum + (plant.market_value ?? 0), 0),
    valuedCount: valued.length,
  }
}
