'use client'

import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import { CheckIcon, TrashIcon, WalletIcon } from '@/components/icons'
import {
  VND_INPUT_PLACEHOLDER,
  formatDate,
  formatPriceInput,
  formatVndAmount,
  parseVndAmount,
  toDateInputValue,
  type Plant,
} from '@/lib/garden'
import { useDeleteSale, useRecordSale, useSales, useUpdatePlant } from '@/lib/queries'

/** Tab Xuất (chi tiết cây): ghi lượt xuất, lịch sử, đánh dấu đã bán hẳn. */
export function TradeTab({ plant }: { plant: Plant }) {
  const salesQuery = useSales()
  const recordSale = useRecordSale()
  const deleteSale = useDeleteSale()
  const updatePlant = useUpdatePlant()

  const [soldAt, setSoldAt] = useState(() => toDateInputValue(new Date()))
  const [price, setPrice] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const sales = useMemo(
    () => (salesQuery.data ?? []).filter((sale) => sale.plant_id === plant.id),
    [salesQuery.data, plant.id],
  )
  const revenue = sales.reduce((sum, sale) => sum + (sale.sold_price ?? 0), 0)
  const profit = plant.purchase_price != null && revenue > 0 ? revenue - plant.purchase_price : null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    recordSale.mutate(
      { plant, soldAt, soldPrice: parseVndAmount(price) },
      {
        onSuccess: () => {
          setPrice('')
          setSavedAt(Date.now())
        },
      },
    )
  }

  const handleToggleSold = () => {
    if (!plant.is_sold) {
      if (plant.timeline_entries.length === 0) {
        window.alert('Cần ít nhất một ảnh trong Nhật ký trước khi đánh dấu đã bán hẳn.')
        return
      }
      if (!window.confirm(`Đánh dấu "${plant.name}" đã bán hẳn? Cây chuyển sang danh sách Đã xuất và không còn tính vào giá trị vườn.`)) {
        return
      }
    }
    updatePlant.mutate({
      id: plant.id,
      is_sold: !plant.is_sold,
      sold_at: plant.is_sold ? null : new Date().toISOString(),
    })
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <form onSubmit={handleSubmit} className="card space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-on-surface">Ghi lượt xuất</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Bán cành, ngọn hay cả cây đều ghi ở đây. Mỗi lượt tự thêm một dòng vào{' '}
              <Link href="/insights" className="font-semibold text-primary underline-offset-2 hover:underline">
                Nhật ký xuất
              </Link>
              .
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Ngày xuất</span>
              <input
                type="date"
                required
                value={soldAt}
                onChange={(event) => setSoldAt(event.target.value)}
                className="field-input"
              />
            </label>
            <label className="block">
              <span className="field-label">Giá xuất (₫)</span>
              <input
                inputMode="numeric"
                value={price}
                onChange={(event) => setPrice(formatPriceInput(event.target.value))}
                className="field-input"
                placeholder={VND_INPUT_PLACEHOLDER}
              />
            </label>
          </div>

          {recordSale.error ? (
            <p className="rounded-2xl bg-error-container px-4 py-3 text-sm text-on-error-container">{recordSale.error.message}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-surface-container-high pt-5">
            <button type="submit" disabled={recordSale.isPending || !soldAt} className="btn-primary">
              <WalletIcon /> {recordSale.isPending ? 'Đang ghi…' : 'Ghi lượt xuất'}
            </button>
            {savedAt && !recordSale.isPending ? (
              <span className="inline-flex animate-fade-in items-center gap-1.5 text-sm font-semibold text-success-green">
                <CheckIcon /> Đã ghi
              </span>
            ) : null}
          </div>
        </form>

        <section className="card p-5 sm:p-6" aria-label="Lịch sử xuất">
          <h2 className="mb-4 font-serif text-xl font-semibold text-on-surface">Lịch sử xuất</h2>
          {salesQuery.isPending ? (
            <div className="space-y-2" aria-busy="true">
              <div className="skeleton h-12 rounded-2xl" />
              <div className="skeleton h-12 rounded-2xl" />
            </div>
          ) : salesQuery.error ? (
            <p className="text-sm text-error">Không tải được lượt xuất: {salesQuery.error.message}</p>
          ) : sales.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Chưa có lượt xuất nào.</p>
          ) : (
            <ul className="divide-y divide-surface-container-high">
              {sales.map((sale) => (
                <li key={sale.id} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1 text-sm text-on-surface-variant">{formatDate(`${sale.sold_at}T00:00:00`)}</span>
                  <span className="font-semibold text-on-surface">
                    {sale.sold_price != null ? formatVndAmount(sale.sold_price) : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Xoá lượt xuất này? Dòng trong Nhật ký xuất giữ nguyên.')) {
                        deleteSale.mutate(sale)
                      }
                    }}
                    disabled={deleteSale.isPending}
                    className="btn-ghost -mr-2 min-h-9 px-2.5 text-outline hover:text-error"
                    aria-label={`Xoá lượt xuất ngày ${formatDate(`${sale.sold_at}T00:00:00`)}`}
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {deleteSale.error ? <p className="mt-2 text-sm text-error">{deleteSale.error.message}</p> : null}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-[calc(env(safe-area-inset-top)+9rem)]">
        <dl className="card grid grid-cols-2 gap-4 p-5 text-sm">
          <Figure label="Lượt xuất" value={String(sales.length)} />
          <Figure label="Tổng thu" value={revenue > 0 ? formatVndAmount(revenue) : '—'} tone="text-warm" />
          <Figure label="Giá nhập" value={plant.purchase_price != null ? formatVndAmount(plant.purchase_price) : '—'} />
          <Figure
            label={profit != null && profit < 0 ? 'Còn lỗ' : 'Lãi'}
            value={profit != null ? formatVndAmount(Math.abs(profit)) : '—'}
            tone={profit == null ? undefined : profit >= 0 ? 'text-success-green' : 'text-error'}
          />
        </dl>

        <div className="card p-5">
          <p className="mb-1 font-semibold text-on-surface">{plant.is_sold ? 'Đã bán hẳn' : 'Bán hẳn cây này'}</p>
          <p className="mb-3 text-sm text-on-surface-variant">
            {plant.is_sold
              ? `Cây đã chuyển sang danh sách Đã xuất${plant.sold_at ? ` từ ${formatDate(plant.sold_at)}` : ''}.`
              : 'Chuyển cây sang danh sách Đã xuất, không còn tính vào giá trị vườn. Lịch sử xuất vẫn giữ nguyên.'}
          </p>
          <button type="button" onClick={handleToggleSold} disabled={updatePlant.isPending} className="btn-secondary w-full">
            {updatePlant.isPending ? 'Đang lưu…' : plant.is_sold ? 'Đưa cây về vườn' : 'Đánh dấu đã bán hẳn'}
          </button>
          {updatePlant.error ? <p className="mt-2 text-sm text-error">{updatePlant.error.message}</p> : null}
        </div>
      </aside>
    </div>
  )
}

function Figure({ label, value, tone = 'text-on-surface' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-on-surface-variant">{label}</dt>
      <dd className={`truncate font-serif text-lg font-semibold ${tone}`}>{value}</dd>
    </div>
  )
}
