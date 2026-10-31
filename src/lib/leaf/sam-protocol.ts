/** Điểm chạm, toạ độ chuẩn hoá 0–1 theo ảnh. label 1 = thuộc lá, 0 = không thuộc lá. */
export type SamPoint = { x: number; y: number; label: 0 | 1 }

export type SamRequest =
  | { type: 'load'; device?: 'webgpu' | 'wasm' }
  | { type: 'embed'; id: number; data: Uint8ClampedArray; width: number; height: number }
  | { type: 'decode'; id: number; points: SamPoint[] }

export type SamResponse =
  | { type: 'progress'; file: string; loaded: number; total: number }
  | { type: 'ready'; device: string }
  | { type: 'embedded'; id: number }
  | { type: 'mask'; id: number; masks: Uint8Array; count: number; width: number; height: number; scores: number[] }
  | { type: 'error'; id?: number; message: string }
