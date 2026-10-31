'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { sortTimelineEntries, type Plant, type TimelineEntry } from '@/lib/garden'
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

const PLANTS_QUERY_KEY = ['plants'] as const

const supabase = () => getSupabaseBrowserClient()

const throwIfError = <T>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) {
    throw new Error(error.message)
  }
  // Không có lỗi ⇒ Supabase luôn trả data
  return data as NonNullable<T>
}

const getCurrentUserId = async () => {
  const { data } = await supabase().auth.getSession()
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
  const rows = throwIfError(
    await supabase()
      .from('plants')
      .select('*, timeline_entries(*)')
      .order('created_at', { ascending: false }),
  ) as Plant[]

  const plants = rows.map((plant) => ({
    ...plant,
    timeline_entries: sortTimelineEntries(plant.timeline_entries ?? []),
  }))

  // Xin signed URL cho thumbnail mọi cây trong 1 request, song song với lúc React render danh sách
  primeSignedUrls(
    plants.map((plant) => plant.timeline_entries[0]?.thumb_path ?? plant.timeline_entries[0]?.photo_path),
  )
  return plants
}

/** Toàn bộ kho cây (kèm nhật ký lá) — vườn cá nhân nên tải 1 lần là đủ. */
export const usePlants = () => useQuery({ queryKey: PLANTS_QUERY_KEY, queryFn: fetchPlants })

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
    | 'rank_score'
    | 'purchased_at'
    | 'purchase_price'
    | 'market_value'
    | 'parent_plant_id'
  >
>

const useInvalidatePlants = () => {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: PLANTS_QUERY_KEY })
}

export const useCreatePlant = () => {
  const invalidate = useInvalidatePlants()
  return useMutation({
    mutationFn: async (input: PlantInput & { name: string }) =>
      throwIfError(await supabase().from('plants').insert(input).select('id').single()),
    onSuccess: invalidate,
  })
}

export const useUpdatePlant = () => {
  const invalidate = useInvalidatePlants()
  return useMutation({
    mutationFn: async ({ id, ...input }: PlantInput & { id: string }) =>
      throwIfError(await supabase().from('plants').update(input).eq('id', id)),
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
    await supabase().storage.from(PHOTOS_BUCKET).remove(paths)
  }
}

export const useDeletePlant = () => {
  const invalidate = useInvalidatePlants()
  return useMutation({
    mutationFn: async (plant: Plant) => {
      throwIfError(await supabase().from('plants').delete().eq('id', plant.id))
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
          const bucket = supabase().storage.from(PHOTOS_BUCKET)

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

          const { error } = await supabase().from('timeline_entries').insert({
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
      throwIfError(await supabase().from('timeline_entries').update(input).eq('id', id)),
    onSuccess: invalidate,
  })
}

export const useDeleteTimelineEntry = () => {
  const invalidate = useInvalidatePlants()
  return useMutation({
    mutationFn: async (entry: TimelineEntry) => {
      throwIfError(await supabase().from('timeline_entries').delete().eq('id', entry.id))
      await removePhotoFiles([entry])
    },
    onSuccess: invalidate,
  })
}
