# Dream's Garden — Web

Bản web của app iOS **Dream's Garden** (`../garden-app`): quản lý vườn kiểng lá variegated — Kho cây, Nhật ký lá, Giao dịch — thêm **video timelapse từ Nhật ký lá** và **thiết kế vườn 3D**.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · Supabase (Auth, Postgres, Storage) · TanStack Query · Vercel.

## Lộ trình

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 1 | Đăng nhập, Kho cây, Chi tiết cây (Nhật ký lá + Hồ sơ), upload ảnh | ✅ |
| 2 | Video timelapse từ Nhật ký lá (9:16 · 1:1 · 16:9, MP4) | ✅ |
| 2.5 | PWA (cài lên điện thoại, Chụp nhanh) · Bộ sưu tập lá (AI tách nền, % var) | ✅ |
| 3 | Gemini AI, tab Xuất, tab Giao dịch | ⏳ |
| 4 | Thiết kế vườn 3D | ⏳ |

## Cài đặt

### 1. Supabase

1. Tạo project tại [supabase.com](https://supabase.com) (free tier).
2. **SQL Editor** → lần lượt chạy [`0001_init.sql`](supabase/migrations/0001_init.sql) rồi [`0002_leaf_collection.sql`](supabase/migrations/0002_leaf_collection.sql) trong `supabase/migrations/`. Tạo bảng, RLS, bucket `plant-photos` (private) và bảng `leaf_cutouts` cho Bộ sưu tập lá.
3. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (đổi sang domain Vercel khi deploy)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://<domain>.vercel.app/auth/callback`
4. **Project Settings → API**: lấy Project URL và publishable key (hoặc anon key).

> Muốn đăng ký không cần xác nhận email (tiện khi dev): **Authentication → Sign In / Providers → Email** → tắt *Confirm email*.

### 1b. (Tuỳ chọn) Supabase local bằng Docker — không cần tài khoản

```bash
npx supabase start   # tự áp dụng supabase/migrations, in ra API URL + PUBLISHABLE_KEY
```

- API `http://127.0.0.1:54321` · Studio `http://127.0.0.1:54323` · Mailpit `http://127.0.0.1:54324`
- Local không yêu cầu xác nhận email. Dừng bằng `npx supabase stop`.
- `supabase/config.toml` đã tắt realtime, edge functions, analytics cho nhẹ.

### 2. Chạy local

```bash
cp .env.example .env.local   # điền URL + key
npm install
npm run dev                  # http://localhost:3000
```

### 3. Deploy Vercel

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
vercel --prod
```

Hoặc push lên GitHub rồi import repo trên vercel.com (nhớ thêm 2 biến môi trường).

## Cấu trúc

```
src/
├── proxy.ts                   # (Next 16: thay middleware) refresh session, chặn route khi chưa đăng nhập
├── app/
│   ├── login/                 # Đăng nhập / đăng ký email
│   ├── auth/callback|signout  # Xác nhận email, đăng xuất
│   └── (app)/                 # Các trang cần đăng nhập
│       ├── page.tsx           # Kho cây
│       └── plants/[id]/       # Chi tiết cây
├── components/
│   ├── garden/                # Kho cây: list item, Nổi bật, thêm cây
│   └── plant/                 # Chi tiết cây: Nhật ký, Hồ sơ
└── lib/
    ├── garden.ts              # Types + helper port từ app (rank, VNĐ, ngày)
    ├── queries.ts             # TanStack Query hooks (CRUD Supabase)
    ├── photos.ts              # EXIF, nén ảnh, signed URL batch
    └── supabase/              # Client browser / server
```

## Ghi chú kỹ thuật

- **Ảnh:** nén trên trình duyệt trước khi upload — bản full ≤2048px + thumbnail ≤480px (JPEG). Ngày chụp đọc từ EXIF (`exifr`). Bucket private, đọc qua signed URL (gom nhiều ảnh thành 1 request, cache ~50 phút). Đường dẫn: `{user_id}/{plant_id}/{uuid}.jpg`.
- **Video (`src/lib/video/`):** render + encode hoàn toàn trên trình duyệt — canvas vẽ từng frame (`scene.ts`, dùng chung cho preview và xuất), [Mediabunny](https://mediabunny.dev) + WebCodecs mã hoá MP4/H.264 (fallback WebM nếu không có H.264). Chỉ giải mã ~4 ảnh quanh vị trí đang phát để chạy được trên điện thoại.
- **Tách lá (`src/lib/leaf/`):** Segment Anything (SlimSAM, `@huggingface/transformers`) chạy trong Web Worker, hoàn toàn trên thiết bị. Mặt nạ chỉ thêm kênh alpha cho ảnh gốc — không vẽ lại pixel nên mảng var giữ nguyên. Mặc định chọn mức "cả vật thể" vì SAM hay tách mảng xanh / mảng var thành hai vật. % var = tỉ lệ pixel trắng/kem/vàng trong lá (ước tính). Mô hình ~15MB tải từ HuggingFace lần đầu rồi được cache.
- **Cross-origin isolation:** `next.config.ts` đặt `COOP: same-origin` + `COEP: credentialless` để WASM chạy đa luồng (nhanh ~2,5 lần). Runtime ONNX phục vụ từ `public/ort/` (copy từ `onnxruntime-web`, cập nhật khi nâng `@huggingface/transformers`). Mọi tài nguyên bên thứ ba cần tải qua CORS hoặc không kèm cookie.
- **Service worker:** không cache script Web Worker — Turbopack truyền danh sách chunk qua `#params` mà Cache API bỏ qua.
- **Bảo mật:** RLS trên mọi bảng + storage policy theo thư mục `user_id`.
- **Font:** Lora thay Libre Caslon Text của app vì Caslon không có glyph tiếng Việt. Body vẫn là Plus Jakarta Sans.
- **Thuật ngữ UI** giữ theo app: Kho cây, Nhật ký lá, Hồ sơ, Nhập/Xuất, Đã xuất, Nổi bật.
- **Cache Components:** dữ liệu runtime (cookies, params, searchParams) nằm trong `<Suspense>` để trang có static shell.
