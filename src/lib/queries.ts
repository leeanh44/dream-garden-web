'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { toDateInputValue, type Plant, type TimelineEntry } from '@/lib/garden'
import { useServerDataPending } from '@/lib/server-data-pending'
import {
  EMPTY_TRADE_LOGS,
  appendTradeLogLine,
  formatTradeLogLine,
  type Sale,
  type TradeLogs,
} from '@/lib/trade'
import { PLANTS_QUERY_KEY, getPlantCoverPath, selectPlants } from '@/lib/plants-data'
import {
  PHOTOS_BUCKET,
  PHOTO_CACHE_CONTROL,
  SIGNED_URL_STALE_MS,
  forgetSignedUrls,
  getCachedSignedUrl,
  getSignedPhotoUrl,
  preparePhoto,
  primeSignedUrls,
} from '@/lib/photos'

const supabase = getSupabaseBrowserClient

const throwIfError = <T>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) {
    throw new Error(error.message)
  }
  // Không có lỗi ⇒ Supabase luôn trả data
  return data as NonNullable<T>
}

const getCurrentUserId = async () => {
  const { data } = await (await supabase()).auth.getSession()
  const userId = data.session?.user.id
  if (!userId) {
    throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.')
  }
  return userId
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const fetchPlants = async (): Promise<Plant[]> => {
  const plants = await selectPlants(await supabase())
  // Xin signed URL cho thumbnail mọi cây trong 1 request, song song với lúc React render danh sách
  primeSignedUrls(plants.map(getPlantCoverPath))
  return plants
}

/**
 * Toàn bộ kho cây (kèm nhật ký lá) — vườn cá nhân nên tải 1 lần là đủ.
 * `enabled: false` khi trang đang chờ dữ liệu server gửi kèm HTML (vẫn trả về dữ liệu đã cache).
 */
/**
 * Toàn bộ kho cây (kèm nhật ký lá) — vườn cá nhân nên tải 1 lần là đủ.
 * Không tự gọi Supabase khi trang đang chờ dữ liệu server gửi kèm HTML (vẫn trả về dữ liệu đã cache).
 */
export const usePlants = () => {
  const serverDataPending = useServerDataPending()
  return useQuery({ queryKey: PLANTS_QUERY_KEY, queryFn: fetchPlants, enabled: !serverDataPending })
}

export const usePlant = (plantId: string) => {
  const query = usePlants()
  return { ...query, plant: query.data?.find((plant) => plant.id === plantId) ?? null }
}

export const usePhotoUrl = (path: string | null | undefined) =>
  useQuery({
    queryKey: ['photo-url', path],
    queryFn: () => getSignedPhotoUrl(path as string),
    enabled: Boolean(path),
    // URL đã có trong cache bền → hiện ảnh ngay frame đầu, không nháy skeleton
    initialData: () => getCachedSignedUrl(path),
    staleTime: SIGNED_URL_STALE_MS,
    gcTime: SIGNED_URL_STALE_MS * 4,
    retry: 1,
  })

// ---------------------------------------------------------------------------
// Mutations — cây
// ---------------------------------------------------------------------------

export type PlantInput = Partial<
  Pick<
    Plant,
    | 'name'
    | 'scientific_name'
    | 'cultivar'
    | 'rank_score'
    | 'purchased_at'
    | 'purchase_price'
    | 'market_value'
    | 'parent_plant_id'
    | 'is_sold'
    | 'sold_at'
  >
>

const useInvalidatePlants = () => {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: PLANTS_QUERY_KEY })
}

export const useCreatePlant = () => {
  const invalidate = useInvalidatePlants()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: PlantInput & { name: string }) => {
      const created = throwIfError(await (await supabase()).from('plants').insert(input).select('id').single())
      // Giống app iOS: tự ghi 1 dòng vào Nhật ký nhập — lỗi ở đây không chặn việc thêm cây
      await appendTradeLog(
        'buy_log',
        formatTradeLogLine(input.purchased_at ?? toDateInputValue(new Date()), input.name, input.purchase_price ?? null),
      ).catch(() => {})
      return created
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TRADE_LOGS_QUERY_KEY })
      return invalidate()
    },
  })
}

export const useUpdatePlant = () => {
  const invalidate = useInvalidatePlants()
  return useMutation({
    mutationFn: async ({ id, ...input }: PlantInput & { id: string }) =>
      throwIfError(await (await supabase()).from('plants').update(input).eq('id', id)),
    onSuccess: invalidate,
  })
}

const removePhotoFiles = async (entries: Pick<TimelineEntry, 'photo_path' | 'thumb_path'>[]) => {
  const paths = entries.flatMap((entry) =>
    entry.thumb_path ? [entry.photo_path, entry.thumb_path] : [entry.photo_path],
  )
  if (paths.length > 0) {
    forgetSignedUrls(paths)
    // Lỗi xóa file không chặn việc xóa dữ liệu — file mồ côi chỉ tốn dung lượng.
    await (await supabase()).storage.from(PHOTOS_BUCKET).remove(paths)
  }
}

export const useDeletePlant = () => {
  const invalidate = useInvalidatePlants()
  return useMutation({
    mutationFn: async (plant: Plant) => {
      throwIfError(await (await supabase()).from('plants').delete().eq('id', plant.id))
      await removePhotoFiles(plant.timeline_entries)
    },
    onSuccess: invalidate,
  })
}

// ---------------------------------------------------------------------------
// Mutations — nhật ký lá
// ---------------------------------------------------------------------------

export type UploadProgress = { done: number; total: number }

/** `plantId` cố định theo hook, hoặc truyền khi gọi `mutate` (màn Chụp nhanh chọn cây sau khi chụp). */
export const useAddTimelinePhotos = (defaultPlantId?: string) => {
  const invalidate = useInvalidatePlants()
  return useMutation({
    mutationFn: async ({
      files,
      onProgress,
      plantId = defaultPlantId,
    }: {
      files: File[]
      onProgress?: (progress: UploadProgress) => void
      plantId?: string
    }) => {
      if (!plantId) {
        throw new Error('Chưa chọn mẫu cây.')
      }
      const userId = await getCurrentUserId()
      const errors: string[] = []
      let done = 0
      onProgress?.({ done, total: files.length })

      // Tuần tự để không giữ quá nhiều bitmap lớn trong bộ nhớ (điện thoại).
      for (const file of files) {
        try {
          const { full, thumb, takenAt } = await preparePhoto(file)
          const id = crypto.randomUUID()
          const photoPath = `${userId}/${plantId}/${id}.jpg`
          const thumbPath = `${userId}/${plantId}/${id}_thumb.jpg`
          const bucket = (await supabase()).storage.from(PHOTOS_BUCKET)

          const options = { contentType: 'image/jpeg', cacheControl: PHOTO_CACHE_CONTROL }
          // Tải song song bản full + thumbnail
          try {
            await Promise.all([
              bucket.upload(photoPath, full, options).then(throwIfError),
              bucket.upload(thumbPath, thumb, options).then(throwIfError),
            ])
          } catch (uploadError) {
            await bucket.remove([photoPath, thumbPath])
            throw uploadError
          }

          const { error } = await (await supabase()).from('timeline_entries').insert({
            id,
            plant_id: plantId,
            photo_path: photoPath,
            thumb_path: thumbPath,
            taken_at: takenAt.toISOString(),
          })
          if (error) {
            await bucket.remove([photoPath, thumbPath])
            throw new Error(error.message)
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error))
        }
        done += 1
        onProgress?.({ done, total: files.length })
      }

      return { uploaded: files.length - errors.length, errors }
    },
    onSettled: invalidate,
  })
}

export const useUpdateTimelineEntry = () => {
  const invalidate = useInvalidatePlants()
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<Pick<TimelineEntry, 'note' | 'taken_at'>> & { id: string }) =>
      throwIfError(await (await supabase()).from('timeline_entries').update(input).eq('id', id)),
    onSuccess: invalidate,
  })
}

export const useDeleteTimelineEntry = () => {
  const invalidate = useInvalidatePlants()
  return useMutation({
    mutationFn: async (entry: TimelineEntry) => {
      throwIfError(await (await supabase()).from('timeline_entries').delete().eq('id', entry.id))
      await removePhotoFiles([entry])
    },
    onSuccess: invalidate,
  })
}

// ---------------------------------------------------------------------------
// Bộ sưu tập — đánh dấu ảnh đẹp nhất
// ---------------------------------------------------------------------------

/** Đưa ảnh vào / gỡ khỏi Bộ sưu tập. Cập nhật lạc quan để ngôi sao đổi ngay khi bấm. */
export const useToggleFeatured = () => {
  const queryClient = useQueryClient()
  const setFeatured = (entryId: string, featuredAt: string | null) =>
    queryClient.setQueryData<Plant[]>(PLANTS_QUERY_KEY, (plants) =>
      plants?.map((plant) => ({
        ...plant,
        timeline_entries: plant.timeline_entries.map((entry) =>
          entry.id === entryId ? { ...entry, featured_at: featuredAt } : entry,
        ),
      })),
    )

  return useMutation({
    mutationFn: async ({ entry, featured }: { entry: TimelineEntry; featured: boolean }) => {
      const { error } = await (await supabase())
        .from('timeline_entries')
        .update({ featured_at: featured ? new Date().toISOString() : null })
        .eq('id', entry.id)
      if (error) {
        throw new Error(
          /featured_at/.test(error.message)
            ? 'Cơ sở dữ liệu chưa có Bộ sưu tập — cần chạy migration 0003_featured_photos.sql.'
            : error.message,
        )
      }
    },
    onMutate: ({ entry, featured }) => {
      setFeatured(entry.id, featured ? new Date().toISOString() : null)
      return { previous: entry.featured_at ?? null }
    },
    onError: (_error, { entry }, context) => setFeatured(entry.id, context?.previous ?? null),
  })
}

// ---------------------------------------------------------------------------
// Giao dịch — lượt xuất + nhật ký nhập / xuất
// ---------------------------------------------------------------------------

export const SALES_QUERY_KEY = ['sales'] as const
export const TRADE_LOGS_QUERY_KEY = ['trade-logs'] as const

/** Mọi lượt xuất của vườn, mới nhất trước (truy vấn riêng để lỗi bảng `sales` không làm hỏng Kho cây). */
export const useSales = () =>
  useQuery({
    queryKey: SALES_QUERY_KEY,
    queryFn: async (): Promise<Sale[]> =>
      throwIfError(
        await (await supabase())
          .from('sales')
          .select('*')
          .order('sold_at', { ascending: false })
          .order('created_at', { ascending: false }),
      ) as Sale[],
  })

const fetchTradeLogs = async (): Promise<TradeLogs> => {
  const { data, error } = await (await supabase()).from('trade_logs').select('buy_log, sell_log').maybeSingle()
  if (error) {
    throw new Error(error.message)
  }
  return data ?? EMPTY_TRADE_LOGS
}

export const useTradeLogs = () => useQuery({ queryKey: TRADE_LOGS_QUERY_KEY, queryFn: fetchTradeLogs })

const saveTradeLogs = async (logs: Partial<TradeLogs>) => {
  const userId = await getCurrentUserId()
  throwIfError(await (await supabase()).from('trade_logs').upsert({ user_id: userId, ...logs }, { onConflict: 'user_id' }))
}

/** Đọc bản mới nhất trên server rồi nối thêm dòng — tránh ghi đè chỉnh sửa ở tab khác. */
const appendTradeLog = async (field: keyof TradeLogs, line: string) => {
  const current = await fetchTradeLogs()
  await saveTradeLogs({ [field]: appendTradeLogLine(current[field], line) })
}

/** Lưu nhật ký nhập / xuất (ô ghi chép tự do, tự lưu khi gõ). */
export const useSaveTradeLogs = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveTradeLogs,
    onSuccess: (_data, logs) =>
      queryClient.setQueryData<TradeLogs>(TRADE_LOGS_QUERY_KEY, (previous) => ({ ...(previous ?? EMPTY_TRADE_LOGS), ...logs })),
  })
}

/** Ghi một lượt xuất + tự thêm dòng vào Nhật ký xuất. */
export const useRecordSale = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      plant,
      soldAt,
      soldPrice,
    }: {
      plant: Pick<Plant, 'id' | 'name'>
      soldAt: string
      soldPrice: number | null
    }) => {
      throwIfError(
        await (await supabase()).from('sales').insert({ plant_id: plant.id, sold_at: soldAt, sold_price: soldPrice }),
      )
      await appendTradeLog('sell_log', formatTradeLogLine(soldAt, plant.name, soldPrice)).catch(() => {})
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: SALES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: TRADE_LOGS_QUERY_KEY }),
      ]),
  })
}

/** Xoá một lượt xuất (dòng trong Nhật ký xuất giữ nguyên — sửa tay nếu cần). */
export const useDeleteSale = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sale: Sale) => throwIfError(await (await supabase()).from('sales').delete().eq('id', sale.id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SALES_QUERY_KEY }),
  })
}
