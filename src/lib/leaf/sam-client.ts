'use client'

import type { SamPoint, SamRequest, SamResponse } from './sam-protocol'

/** Các mặt nạ ứng viên, sắp theo diện tích tăng dần (mảnh nhỏ → cả vật thể). */
export type SamMasks = { candidates: { mask: Uint8Array; score: number; area: number }[]; width: number; height: number }
export type ModelProgress = { loaded: number; total: number }

/**
 * Giao tiếp với worker SAM. Worker dùng chung cho cả phiên (mô hình chỉ tải 1 lần),
 * file mô hình được trình duyệt cache lại cho lần sau.
 */
class SamClient {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (value: SamResponse) => void; reject: (error: Error) => void }>()
  private readyPromise: Promise<string> | null = null
  private progressListeners = new Set<(progress: ModelProgress) => void>()
  private fileProgress = new Map<string, ModelProgress>()

  private getWorker() {
    if (!this.worker) {
      this.worker = new Worker(new URL('./sam.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (event: MessageEvent<SamResponse>) => this.handle(event.data)
      // Worker chết (không tải được script / hết bộ nhớ) → báo lỗi thay vì treo
      this.worker.onerror = (event) => {
        event.preventDefault()
        this.fail(event.message || 'Không khởi động được mô hình AI.')
      }
    }
    return this.worker
  }

  private failListeners = new Set<(message: string) => void>()

  private fail(message: string) {
    for (const waiter of this.pending.values()) waiter.reject(new Error(message))
    this.pending.clear()
    this.failListeners.forEach((listener) => listener(message))
    this.worker?.terminate()
    this.worker = null
    this.readyPromise = null
  }

  private handle(message: SamResponse) {
    if (message.type === 'progress') {
      this.fileProgress.set(message.file, { loaded: message.loaded, total: message.total })
      let loaded = 0
      let total = 0
      for (const file of this.fileProgress.values()) {
        loaded += file.loaded
        total += file.total
      }
      this.progressListeners.forEach((listener) => listener({ loaded, total }))
      return
    }
    if ((message.type === 'embedded' || message.type === 'mask' || message.type === 'error') && message.id) {
      const waiter = this.pending.get(message.id)
      this.pending.delete(message.id)
      if (message.type === 'error') {
        waiter?.reject(new Error(message.message))
      } else {
        waiter?.resolve(message)
      }
    }
  }

  private request(message: SamRequest & { id: number }, transfer: Transferable[] = []) {
    return new Promise<SamResponse>((resolve, reject) => {
      this.pending.set(message.id, { resolve, reject })
      this.getWorker().postMessage(message, transfer)
    })
  }

  /** Tải mô hình (lần đầu ~28MB). Trả về thiết bị chạy: webgpu | wasm. */
  load(onProgress?: (progress: ModelProgress) => void) {
    if (onProgress) {
      this.progressListeners.add(onProgress)
    }
    this.readyPromise ??= new Promise<string>((resolve, reject) => {
      const worker = this.getWorker()
      const onMessage = (event: MessageEvent<SamResponse>) => {
        if (event.data.type === 'ready') {
          worker.removeEventListener('message', onMessage)
          resolve(event.data.device)
        } else if (event.data.type === 'error' && event.data.id == null) {
          worker.removeEventListener('message', onMessage)
          this.readyPromise = null
          reject(new Error(event.data.message))
        }
      }
      worker.addEventListener('message', onMessage)
      const onFail = (message: string) => {
        this.failListeners.delete(onFail)
        reject(new Error(message))
      }
      this.failListeners.add(onFail)
      let device: 'webgpu' | 'wasm' | undefined
      try {
        const forced = window.localStorage.getItem('dg.samDevice')
        device = forced === 'wasm' || forced === 'webgpu' ? forced : undefined
      } catch {
        // bỏ qua
      }
      worker.postMessage({ type: 'load', device } satisfies SamRequest)
    })
    return this.readyPromise.finally(() => {
      if (onProgress) {
        this.progressListeners.delete(onProgress)
      }
    })
  }

  async embed(image: ImageData) {
    const data = new Uint8ClampedArray(image.data)
    await this.request({ type: 'embed', id: this.nextId++, data, width: image.width, height: image.height }, [
      data.buffer,
    ])
  }

  async decode(points: SamPoint[]): Promise<SamMasks> {
    const response = await this.request({ type: 'decode', id: this.nextId++, points })
    if (response.type !== 'mask') {
      throw new Error('Không tạo được mặt nạ.')
    }
    const size = response.width * response.height
    const candidates = Array.from({ length: response.count }, (_, index) => {
      const mask = response.masks.subarray(index * size, (index + 1) * size)
      let area = 0
      for (let i = 0; i < size; i += 1) area += mask[i] ? 1 : 0
      return { mask, score: response.scores[index], area }
    }).sort((left, right) => left.area - right.area)
    return { candidates, width: response.width, height: response.height }
  }
}

let client: SamClient | null = null
export const getSamClient = () => (client ??= new SamClient())
