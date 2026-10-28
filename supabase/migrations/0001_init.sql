-- Dream's Garden Web — schema khởi tạo
-- Chạy trong Supabase Dashboard → SQL Editor (hoặc `supabase db push`).
-- Shape bám theo type `Plant` của app iOS (garden-app/src/App.tsx) để sau này import/đồng bộ.

-- ---------------------------------------------------------------------------
-- Bảng
-- ---------------------------------------------------------------------------

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  -- Tên khoa học — dùng để tra Gemini (giai đoạn 3)
  scientific_name text,
  rank_score smallint not null default 5 check (rank_score between 1 and 10),
  purchased_at date,
  purchase_price bigint check (purchase_price is null or purchase_price > 0),
  market_value bigint check (market_value is null or market_value > 0),
  parent_plant_id uuid references public.plants (id) on delete set null,
  is_sold boolean not null default false,
  sold_at timestamptz,
  -- Bản ghi đã xuất thêm thủ công — không tính thống kê / định giá vườn
  is_manual_sold_record boolean not null default false,
  -- Thông tin cây từ Gemini AI
  ai_info jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plants_user_id_idx on public.plants (user_id);
create index plants_parent_plant_id_idx on public.plants (parent_plant_id);

-- Nhật ký lá
create table public.timeline_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plant_id uuid not null references public.plants (id) on delete cascade,
  -- Đường dẫn trong bucket `plant-photos`: {user_id}/{plant_id}/{uuid}.jpg
  photo_path text not null,
  thumb_path text,
  -- Ngày chụp (EXIF nếu có) — dùng để sắp xếp timeline và dựng video
  taken_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index timeline_entries_plant_id_idx on public.timeline_entries (plant_id, taken_at desc);
create index timeline_entries_user_id_idx on public.timeline_entries (user_id);

-- Lượt xuất (giai đoạn 3)
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plant_id uuid not null references public.plants (id) on delete cascade,
  sold_at date not null default current_date,
  sold_price bigint check (sold_price is null or sold_price > 0),
  created_at timestamptz not null default now()
);

create index sales_plant_id_idx on public.sales (plant_id);
create index sales_user_id_idx on public.sales (user_id);

-- Nhật ký nhập / xuất dạng text (giai đoạn 3)
create table public.trade_logs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  buy_log text not null default '',
  sell_log text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger plants_set_updated_at
  before update on public.plants
  for each row execute function public.set_updated_at();

create trigger trade_logs_set_updated_at
  before update on public.trade_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — mỗi người chỉ thấy dữ liệu của mình
-- ---------------------------------------------------------------------------

alter table public.plants enable row level security;
alter table public.timeline_entries enable row level security;
alter table public.sales enable row level security;
alter table public.trade_logs enable row level security;

create policy "plants: owner" on public.plants
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "timeline_entries: owner" on public.timeline_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.plants p
      where p.id = plant_id and p.user_id = (select auth.uid())
    )
  );

create policy "sales: owner" on public.sales
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.plants p
      where p.id = plant_id and p.user_id = (select auth.uid())
    )
  );

create policy "trade_logs: owner" on public.trade_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Storage: bucket ảnh lá (private, đọc qua signed URL)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plant-photos', 'plant-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "plant-photos: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "plant-photos: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "plant-photos: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "plant-photos: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
