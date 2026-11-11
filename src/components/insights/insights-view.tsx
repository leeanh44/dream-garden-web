'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CheckIcon, WalletIcon } from '@/components/icons'
import { PlantPhoto } from '@/components/plant-photo'
import { formatDate, formatVndAmount, type Plant } from '@/lib/garden'
import { getPlantCoverPath } from '@/lib/plants-data'
import { usePlants, useSales, useSaveTradeLogs, useTradeLogs } from '@/lib/queries'
import {
  TRADE_LOG_EXAMPLE,
  computeTradeStats,
  groupSalesByPlant,
  sumTradeLog,
  type Sale,
  type TradeLogSum,
  type TradeLogs,
} from '@/lib/trade'

const SAVE_DELAY_MS = 800

const saleDate = (sale: Sale) => formatDate(`${sale.sold_at}T00:00:00`)

/** Giao dịch: thống kê nhập / xuất, giá trị vườn, nhật ký ghi chép, danh sách đã xuất. */
export function InsightsView() {
  const plantsQuery = usePlants()
  const salesQuery = useSales()
  const plants = useMemo(() => plantsQuery.data ?? [], [plantsQuery.data])
  const sales = useMemo(() => salesQuery.data ?? [], [salesQuery.data])
  const stats = useMemo(() => computeTradeStats(plants, sales), [plants, sales])
  const salesReady = !salesQuery.isPending && !salesQuery.error

  // Cây có lượt xuất hoặc đã bán hẳn — lượt xuất gần nhất lên đầu
  const exported = useMemo(() => {
    const byPlant = groupSalesByPlant(sales)
    return plants
      .filter((plant) => plant.is_sold || byPlant.has(plant.id))
      .map((plant) => ({ plant, sales: byPlant.get(plant.id) ?? [] }))
      .sort((left, right) => latestKey(right).localeCompare(latestKey(left)))
  }, [plants, sales])

  if (plantsQuery.isPending) {
    return <InsightsSkeleton />
  }
  if (plantsQuery.error) {
    return <div className="card p-8 text-center text-on-surface-variant">Không tải được dữ liệu: {plantsQuery.error.message}</div>
  }

  const count = (value: number) => (salesReady ? String(value) : '—')

  return (
    <div className="animate-fade-in">
      <section className="relative mb-6 overflow-hidden rounded-[2rem] bg-surface-container-lowest p-6 shadow-leaf ring-1 ring-surface-container-high md:p-8">
        <WalletIcon className="pointer-events-none absolute -top-6 -right-4 h-44 w-44 rotate-12 text-primary/5" />
        <p className="eyebrow">Sổ sách vườn</p>
        <h1 className="font-serif text-3xl font-semibold text-on-surface md:text-4xl">Giao dịch</h1>
        <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
          Nhập cây, xuất cành và lãi lỗ. Ghi lượt xuất ở tab <strong className="font-semibold">Xuất</strong> trong trang từng cây.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 md:max-w-2xl">
          <Stat label="Đã nhập" value={String(stats.totalBought)} />
          <Stat label="Đang ươm" value={String(stats.inGarden)} tone="text-primary" />
          <Stat label="Lượt xuất" value={count(stats.saleCount)} tone="text-warm" />
          <Stat label="Đã bán hẳn" value={String(stats.soldOut)} />
        </dl>
      </section>

      {salesQuery.error ? (
        <p className="mb-6 rounded-2xl bg-error-container px-4 py-3 text-sm text-on-error-container">
          Không tải được lượt xuất: {salesQuery.error.message}
        </p>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6" aria-label="Giá trị vườn">
            <h2 className="font-serif text-xl font-semibold text-on-surface">Giá trị vườn</h2>
            <p className="mt-2 font-serif text-3xl font-semibold text-warm">
              {stats.marketValue > 0 ? formatVndAmount(stats.marketValue) : '—'}
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {stats.valuedCount}/{stats.inGarden} cây đang ươm đã định giá. Nhập định giá ở tab Hồ sơ của từng cây.
            </p>
          </section>

          <section className="card p-5 sm:p-6" aria-label="Tài chính">
            <h2 className="mb-3 font-serif text-xl font-semibold text-on-surface">Tài chính</h2>
            <dl className="divide-y divide-surface-container-high text-sm">
              <Row label="Tổng chi nhập" value={stats.totalPurchaseCost > 0 ? formatVndAmount(stats.totalPurchaseCost) : '—'} />
              <Row
                label="Tổng thu xuất"
                value={salesReady && stats.totalRevenue > 0 ? formatVndAmount(stats.totalRevenue) : '—'}
              />
              <Row
                label="Lãi / lỗ ước tính"
                value={salesReady && stats.estimatedProfit != null ? signedVnd(stats.estimatedProfit) : '—'}
                tone={
                  !salesReady || stats.estimatedProfit == null
                    ? undefined
                    : stats.estimatedProfit >= 0
                      ? 'text-success-green'
                      : 'text-error'
                }
                strong
              />
            </dl>
            <p className="mt-3 text-xs text-outline">
              Lãi / lỗ = tổng thu xuất − giá nhập của cây đã bán hẳn. Bản ghi xuất thủ công không được tính.
            </p>
          </section>

          <section className="card p-5 sm:p-6" aria-label="Đã xuất">
            <h2 className="mb-3 font-serif text-xl font-semibold text-on-surface">Đã xuất</h2>
            {!salesReady && salesQuery.isPending ? (
              <div className="space-y-2" aria-busy="true">
                <div className="skeleton h-14 rounded-2xl" />
                <div className="skeleton h-14 rounded-2xl" />
              </div>
            ) : exported.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                Chưa có lượt xuất nào. Mở một cây → tab <strong className="font-semibold">Xuất</strong> để ghi lượt đầu tiên.
              </p>
            ) : (
              <ul className="-mx-2">
                {exported.map(({ plant, sales: plantSales }) => (
                  <ExportedRow key={plant.id} plant={plant} sales={plantSales} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <TradeLogsCard />
      </div>
    </div>
  )
}

const latestKey = ({ plant, sales }: { plant: Plant; sales: Sale[] }) =>
  sales[0]?.sold_at ?? plant.sold_at?.slice(0, 10) ?? ''

const signedVnd = (amount: number) => `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${formatVndAmount(Math.abs(amount))}`

function ExportedRow({ plant, sales }: { plant: Plant; sales: Sale[] }) {
  const latest = sales[0]
  const coverPath = getPlantCoverPath(plant)
  return (
    <li>
      <Link
        href={`/plants/${plant.id}`}
        className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-surface-container-low"
      >
        <PlantPhoto path={coverPath} alt="" className="h-12 w-12 shrink-0 rounded-xl" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold text-on-surface">{plant.name}</span>
            {plant.is_sold ? (
              <span className="pill shrink-0 bg-tertiary-container text-on-tertiary-container">
                {plant.is_manual_sold_record ? 'Bản ghi' : 'Bán hẳn'}
              </span>
            ) : null}
          </span>
          <span className="block truncate text-xs text-on-surface-variant">
            {sales.length > 0 ? `${sales.length} lượt · gần nhất ${saleDate(latest)}` : 'Chưa ghi lượt xuất'}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-warm">
          {latest?.sold_price != null ? formatVndAmount(latest.sold_price) : '—'}
        </span>
      </Link>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Nhật ký nhập / xuất — ghi chép tự do, tự lưu
// ---------------------------------------------------------------------------

function TradeLogsCard() {
  const logsQuery = useTradeLogs()

  return (
    <section className="card space-y-5 p-5 sm:p-6 lg:sticky lg:top-[calc(env(safe-area-inset-top)+5rem)]" aria-label="Nhật ký nhập / xuất">
      <div>
        <h2 className="font-serif text-xl font-semibold text-on-surface">Nhật ký nhập / xuất</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Mỗi dòng một giao dịch, giá để cuối dòng. Thêm cây hoặc ghi lượt xuất sẽ tự thêm dòng. Tự lưu khi gõ.
        </p>
      </div>
      {logsQuery.isPending ? (
        <div className="space-y-3" aria-busy="true">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      ) : logsQuery.error ? (
        <p className="rounded-2xl bg-error-container px-4 py-3 text-sm text-on-error-container">
          Không tải được nhật ký: {logsQuery.error.message}
        </p>
      ) : (
        <TradeLogsEditor logs={logsQuery.data} />
      )}
    </section>
  )
}

function TradeLogsEditor({ logs }: { logs: TradeLogs }) {
  const [drafts, setDrafts] = useState(logs)
  const [baseline, setBaseline] = useState(logs)

  // Server có bản mới (VD vừa ghi lượt xuất ở trang cây) → nhận bản mới cho ô nào đang không sửa dở
  if (logs.buy_log !== baseline.buy_log || logs.sell_log !== baseline.sell_log) {
    setBaseline(logs)
    setDrafts((previous) => ({
      buy_log: previous.buy_log === baseline.buy_log ? logs.buy_log : previous.buy_log,
      sell_log: previous.sell_log === baseline.sell_log ? logs.sell_log : previous.sell_log,
    }))
  }

  // Tính trên bản đang gõ để số liệu cập nhật tức thì
  const buy = sumTradeLog(drafts.buy_log)
  const sell = sumTradeLog(drafts.sell_log)
  const hasBoth = buy.countedLines > 0 && sell.countedLines > 0
  const difference = sell.total - buy.total
  const setField = (field: keyof TradeLogs) => (value: string) => setDrafts((previous) => ({ ...previous, [field]: value }))

  return (
    <>
      <LogField
        field="buy_log"
        label="Nhật ký nhập"
        value={drafts.buy_log}
        serverValue={logs.buy_log}
        onChange={setField('buy_log')}
        placeholder={`VD:\n${TRADE_LOG_EXAMPLE}\n05/03/2025 · Philo Pink · 180.000 ₫`}
      />
      <LogField
        field="sell_log"
        label="Nhật ký xuất"
        value={drafts.sell_log}
        serverValue={logs.sell_log}
        onChange={setField('sell_log')}
        placeholder={'VD:\n10/04/2025 · Ngọn Monstera Albo · 1.200.000 ₫'}
      />
      <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-container-low p-3 text-sm">
        <LogTotal label="Tổng chi" sum={buy} />
        <LogTotal label="Tổng thu" sum={sell} tone="text-warm" />
        <div className="min-w-0">
          <dt className="text-xs text-on-surface-variant">Chênh lệch</dt>
          <dd className={`truncate font-semibold ${hasBoth ? (difference >= 0 ? 'text-success-green' : 'text-error') : 'text-on-surface'}`}>
            {hasBoth ? signedVnd(difference) : '—'}
          </dd>
        </div>
      </dl>
    </>
  )
}

function LogField({
  field,
  label,
  value,
  serverValue,
  onChange,
  placeholder,
}: {
  field: keyof TradeLogs
  label: string
  value: string
  serverValue: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const { mutate, isPending, error } = useSaveTradeLogs()
  const dirty = value !== serverValue

  // Tự lưu sau khi ngừng gõ
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => mutate({ [field]: value }), SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [dirty, field, mutate, value])

  const status = error
    ? { text: 'Lưu lỗi — thử gõ lại', tone: 'text-error' }
    : isPending
      ? { text: 'Đang lưu…', tone: 'text-on-surface-variant' }
      : dirty
        ? { text: 'Chưa lưu', tone: 'text-on-surface-variant' }
        : { text: 'Đã lưu', tone: 'text-success-green' }

  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="field-label mb-0">{label}</span>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${status.tone}`} aria-live="polite">
          {!dirty && !isPending && !error ? <CheckIcon className="h-3.5 w-3.5" /> : null}
          {status.text}
        </span>
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (dirty) mutate({ [field]: value })
        }}
        rows={7}
        spellCheck={false}
        className="field-input min-h-40 resize-y py-3 font-mono text-[13px] leading-relaxed"
        placeholder={placeholder}
      />
    </label>
  )
}

function LogTotal({ label, sum, tone = 'text-on-surface' }: { label: string; sum: TradeLogSum; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-on-surface-variant">{label}</dt>
      <dd className={`truncate font-semibold ${tone}`}>{sum.countedLines > 0 ? formatVndAmount(sum.total) : '—'}</dd>
      <dd className="text-[11px] text-outline">
        {sum.countedLines}/{sum.lineCount} dòng có giá
      </dd>
    </div>
  )
}

function Stat({ label, value, tone = 'text-on-surface' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-surface-container-low px-4 py-2 ring-1 ring-surface-container-high">
      <dt className="text-[11px] font-semibold tracking-wide text-on-surface-variant uppercase">{label}</dt>
      <dd className={`font-serif text-xl font-semibold ${tone}`}>{value}</dd>
    </div>
  )
}

function Row({ label, value, tone = 'text-on-surface', strong = false }: { label: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className={`text-right ${strong ? 'font-serif text-lg font-semibold' : 'font-semibold'} ${tone}`}>{value}</dd>
    </div>
  )
}

function InsightsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải">
      <div className="skeleton mb-6 h-52 rounded-[2rem]" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="skeleton h-36 rounded-3xl" />
          <div className="skeleton h-48 rounded-3xl" />
        </div>
        <div className="skeleton h-[28rem] rounded-3xl" />
      </div>
    </div>
  )
}
