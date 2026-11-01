-- Bộ sưu tập: đánh dấu ảnh lá đẹp nhất trong Nhật ký (thay cho tính năng tách lá).
-- Chạy sau 0001. Không cần 0002 (tách lá đã gỡ). Chỉ thêm cột — RLS hiện có đã bao phủ.
-- Chạy lại nhiều lần vẫn an toàn.

-- Dòng / cultivar (trước nằm trong 0002) — dùng cho gợi ý tên & gom Bộ sưu tập
alter table public.plants
  add column if not exists cultivar text;

alter table public.timeline_entries
  add column if not exists featured_at timestamptz;

create index if not exists timeline_entries_featured_idx
  on public.timeline_entries (featured_at desc)
  where featured_at is not null;
