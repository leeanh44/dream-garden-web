import { Fragment } from 'react'

/** Bậc phân loại / ký hiệu viết đứng (không nghiêng) theo quy ước danh pháp thực vật. */
const ROMAN_TOKENS = new Set(['var.', 'subsp.', 'ssp.', 'f.', 'cv.', 'sp.', 'spp.', 'aff.', 'cf.', '×', 'x'])

/**
 * Danh pháp đúng quy ước: chi + loài in nghiêng, tên dòng viết đứng trong dấu nháy đơn.
 * Ví dụ: *Monstera deliciosa* 'Thai Constellation'.
 */
export function ScientificName({ latin, cultivar }: { latin: string; cultivar?: string | null }) {
  const tokens = latin.trim().split(/\s+/).filter(Boolean)
  return (
    <>
      {tokens.map((token, index) => (
        <Fragment key={index}>
          {index > 0 ? ' ' : null}
          {ROMAN_TOKENS.has(token) ? <span className="not-italic">{token}</span> : <i>{token}</i>}
        </Fragment>
      ))}
      {cultivar ? <span className="not-italic">{tokens.length > 0 ? ' ' : null}‘{cultivar}’</span> : null}
    </>
  )
}

/** Tiêu đề cây: danh pháp nếu có, không thì tên Việt. Dùng cùng `getPlantDisplayName`. */
export function PlantTitle({ display }: { display: { title: string; latin: string | null; cultivar: string | null } }) {
  return display.latin ? <ScientificName latin={display.latin} cultivar={display.cultivar} /> : <>{display.title}</>
}
