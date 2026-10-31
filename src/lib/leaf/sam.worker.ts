/// <reference lib="webworker" />
/**
 * Segment Anything (SlimSAM) chạy trong Web Worker.
 * - `embed`: mã hoá ảnh 1 lần (nặng, ~1–5 giây).
 * - `decode`: mỗi lần chạm → mặt nạ mới trong ~50–200ms, dùng lại embedding.
 */
import { AutoProcessor, RawImage, SamModel, Tensor, env, type Processor } from '@huggingface/transformers'
import type { SamRequest, SamResponse } from './sam-protocol'

const MODEL_ID = 'Xenova/slimsam-77-uniform'

env.allowLocalModels = false

// Runtime ONNX phục vụ từ cùng domain (/public/ort, copy từ onnxruntime-web) thay vì CDN:
// khi trang được cross-origin isolated, WASM chạy đa luồng và cần tạo worker con từ cùng nguồn.
const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown; numThreads?: number } }
if (onnx.wasm) {
  onnx.wasm.wasmPaths = {
    mjs: new URL('/ort/ort-wasm-simd-threaded.asyncify.mjs', self.location.origin).href,
    wasm: new URL('/ort/ort-wasm-simd-threaded.asyncify.wasm', self.location.origin).href,
  }
  onnx.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1
}

const post = (message: SamResponse, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message, transfer)

type ImageInputs = {
  pixel_values: Tensor
  original_sizes: [number, number][]
  reshaped_input_sizes: [number, number][]
}

let loading: Promise<{ model: SamModel; processor: Processor; device: string }> | null = null
let imageInputs: ImageInputs | null = null
let embeddings: Record<string, Tensor> | null = null

const hasWebGPU = async () => {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
    return Boolean(gpu && (await gpu.requestAdapter()))
  } catch {
    return false
  }
}

const load = (preferred?: 'webgpu' | 'wasm') => {
  loading ??= (async () => {
    const progress_callback = (info: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (info.status === 'progress' && info.file && info.total) {
        post({ type: 'progress', file: info.file, loaded: info.loaded ?? 0, total: info.total })
      }
    }
    const processor = await AutoProcessor.from_pretrained(MODEL_ID, { progress_callback })

    // Chọn thiết bị:
    // - Trang cross-origin isolated (Chrome/Edge/Firefox) → WASM đa luồng + int8: nhanh và ổn định nhất trên CPU.
    // - Không isolated (Safari iOS) → WebGPU nếu có, vì WASM đơn luồng rất chậm.
    const threadedWasm = self.crossOriginIsolated && (navigator.hardwareConcurrency || 1) >= 4
    const useWebGPU = preferred === 'webgpu' || (preferred !== 'wasm' && !threadedWasm)
    if (useWebGPU && (await hasWebGPU())) {
      try {
        const model = (await SamModel.from_pretrained(MODEL_ID, {
          device: 'webgpu',
          dtype: 'fp32',
          progress_callback,
        })) as SamModel
        return { model, processor, device: 'webgpu' }
      } catch {
        // rơi xuống WASM
      }
    }
    const model = (await SamModel.from_pretrained(MODEL_ID, {
      device: 'wasm',
      // CPU: bản lượng tử hoá int8 nhanh hơn ~2–3 lần, mặt nạ gần như không khác (độ chi tiết do decoder 256px quyết định)
      dtype: { vision_encoder: 'q8', prompt_encoder_mask_decoder: 'q8' },
      progress_callback,
    })) as SamModel
    return { model, processor, device: 'wasm' }
  })()
  loading.catch(() => {
    loading = null
  })
  return loading
}

self.onmessage = async (event: MessageEvent<SamRequest>) => {
  const request = event.data
  try {
    if (request.type === 'load') {
      const { device } = await load(request.device)
      post({ type: 'ready', device })
      return
    }

    if (request.type === 'embed') {
      const { model, processor } = await load()
      const image = new RawImage(request.data, request.width, request.height, 4).rgb()
      imageInputs = (await processor(image)) as ImageInputs
      embeddings = (await model.get_image_embeddings(imageInputs)) as unknown as Record<string, Tensor>
      post({ type: 'embedded', id: request.id })
      return
    }

    if (request.type === 'decode') {
      const { model, processor } = await load()
      if (!imageInputs || !embeddings) {
        throw new Error('Ảnh chưa được phân tích.')
      }
      const [reshapedH, reshapedW] = imageInputs.reshaped_input_sizes[0]
      const coords = request.points.flatMap((point) => [point.x * reshapedW, point.y * reshapedH])
      const input_points = new Tensor('float32', coords, [1, 1, request.points.length, 2])
      const input_labels = new Tensor(
        'int64',
        request.points.map((point) => BigInt(point.label)),
        [1, 1, request.points.length],
      )
      const outputs = await model({ ...embeddings, input_points, input_labels })
      const masks = await (
        processor as unknown as {
          post_process_masks: (
            masks: Tensor,
            original: [number, number][],
            reshaped: [number, number][],
          ) => Promise<Tensor[]>
        }
      ).post_process_masks(outputs.pred_masks, imageInputs.original_sizes, imageInputs.reshaped_input_sizes)

      // SAM trả 3 mặt nạ ở 3 mức chi tiết (mảnh nhỏ → cả vật thể) — gửi cả 3 để chọn
      const scores = Array.from(outputs.iou_scores.data as Float32Array)
      const tensor = masks[0]
      const [, count, height, width] = tensor.dims
      const size = width * height
      const all = new Uint8Array((tensor.data as Uint8Array).subarray(0, count * size))
      post({ type: 'mask', id: request.id, masks: all, count, width, height, scores }, [all.buffer])
    }
  } catch (error) {
    post({
      type: 'error',
      id: 'id' in request ? request.id : undefined,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
