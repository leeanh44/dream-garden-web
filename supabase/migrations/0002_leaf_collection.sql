-- Bộ sưu tập lá đẹp nhất theo dòng
-- Chạy sau 0001_init.sql (Supabase Dashboard → SQL Editor, hoặc `supabase db push`).

-- Dòng / cultivar (VD: Thai Constellation, Albo, Mint) — dùng để gom bộ sưu tập
alter table public.plants add column if not exists cultivar text;

-- Lá đã tách nền từ một ảnh Nhật ký (một ảnh có thể tách nhiều lá)
create table public.leaf_cutouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plant_id uuid not null references public.plants (id) on delete cascade,
  entry_id uuid not null references public.timeline_entries (id) on delete cascade,
  -- PNG/WebP nền trong suốt, cắt sát lá: {user_id}/{plant_id}/cutouts/{uuid}.webp
  cutout_path text not null,
  thumb_path text,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  -- Tỉ lệ diện tích var (trắng/kem/vàng) trên diện tích lá, 0–1 — ước tính từ mặt nạ
  var_ratio real check (var_ratio is null or var_ratio between 0 and 1),
  -- Điểm chạm dùng để tách (toạ độ 0–1 theo ảnh gốc) — để chỉnh lại sau này
  points jsonb,
  created_at timestamptz not null default now()
);

create index leaf_cutouts_user_id_idx on public.leaf_cutouts (user_id, created_at desc);
create index leaf_cutouts_plant_id_idx on public.leaf_cutouts (plant_id);
create index leaf_cutouts_entry_id_idx on public.leaf_cutouts (entry_id);

alter table public.leaf_cutouts enable row level security;

create policy "leaf_cutouts: owner" on public.leaf_cutouts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.timeline_entries e
      where e.id = leaf_cutouts.entry_id and e.plant_id = leaf_cutouts.plant_id and e.user_id = (select auth.uid())
    )
  );
