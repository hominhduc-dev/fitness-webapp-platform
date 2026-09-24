# Handoff: quay lại Supabase Cloud

Viết ngày 24/09/2026. Tài liệu này dành cho lúc project Cloud `bljmubatdtvuomucqmoj` hết bị restrict và bạn muốn chuyển app từ Supabase tự host trên VPS về lại Cloud. Cách chạy chi tiết từng script nằm ở [supabase-switch.md](supabase-switch.md).

## Tình trạng khi bàn giao

| Thành phần | Đang trỏ về | Ghi chú |
|---|---|---|
| Backend `yeahbuddy-backend` | **VPS** (`supabase-db:5432`, `https://supabase.hominhduc.cloud`) | Chuyển lúc 12:31 ngày 24/09, downtime khoảng 16 giây |
| Dữ liệu | **VPS** là nơi nhận ghi | Dữ liệu trên Cloud đứng yên ở thời điểm 12:31 ngày 24/09 |
| Frontend Vercel (`www.hominhduc.me`) | **VPS** | Đổi `NEXT_PUBLIC_SUPABASE_URL` / `_PUBLISHABLE_KEY` bằng Vercel CLI, build lại từ git lúc 13:5x ngày 24/09 |
| Google OAuth, email quên mật khẩu (bản tự host) | Chưa cấu hình | Cần `GOOGLE_*` và `SMTP_*` trong `~/supabase/.env` |

Lý do chuyển: Cloud bị chặn vì `exceed_egress_quota` (gói Free có 5 GB egress). Nguồn tốn egress chính là việc đọc `Variation.metadata`, đã được giảm ở PR #228 (từ 11 MB xuống 504 KB mỗi lần tải thư viện bài tập).

## Mọi thứ nằm ở đâu (VPS `duc@187.77.133.167`)

| Thứ | Vị trí |
|---|---|
| Script | `~/yeahbuddy-ops/supabase-switch/` (bản gốc trong repo: `scripts/supabase-switch/`) |
| Profile env của backend | `~/.config/yeahbuddy/cloud.env`, `vps.env` (mode 600, mỗi file 5 biến) |
| Profile đang dùng | `/home/yeahbuddy/htdocs/backend.hominhduc.me/supabase.env` |
| Compose override (chỉ có trên server, không nằm trong git) | `/home/yeahbuddy/htdocs/backend.hominhduc.me/docker-compose.override.yml` |
| Supabase tự host | `~/supabase` (`.env`, `docker-compose.yml`, bản sao `.env.bak-*`) |
| Backup | `~/backups/`: dump chạy mỗi đêm `vps-*.dump` (giữ 7 bản), dump trước mỗi lần đồng bộ `*-before-sync-*.dump`, và bản ngày 12/09 |
| Cron | Chạy `crontab -l` để xem; `backup.sh` chạy lúc 03:15 mỗi ngày |

## Khi nào quay lại được

Cả hai điều kiện sau phải đúng:
1. Supabase Dashboard không còn báo restrict (đã sang chu kỳ billing mới hoặc đã nâng gói).
2. Auth của Cloud trả `401` chứ không còn `402`:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://bljmubatdtvuomucqmoj.supabase.co/auth/v1/health
   ```

Nên xem Usage trên Supabase trước: gói Free chỉ có 5 GB/tháng. Nếu lượng dùng thực tế vẫn vượt mức đó, nên nâng Pro (250 GB) trước khi quay về.

## Các bước quay về

Tất cả chạy trên VPS, trong `~/yeahbuddy-ops/supabase-switch`.

### 1. Đưa hai phía về cùng migration

Trong thời gian chạy trên VPS, nếu có deploy migration mới thì chúng chỉ được áp dụng lên VPS.

```bash
./migrate.sh vps status
./migrate.sh cloud status
./migrate.sh cloud deploy      # chỉ khi Cloud đang thiếu migration
```

`migrate.sh` dùng image `yeahbuddy-backend:latest`, nên hãy build/deploy backend mới nhất trước. Nếu một migration kiểu "backfill" báo lỗi `already exists`, đọc chú thích ở đầu file migration đó. Thường chỉ cần chạy `./migrate.sh <phía> resolve --applied <tên>`, giống cách đã xử lý `20260629_add_ai_generation` trên VPS.

### 2. Tập dượt (không thay đổi gì)

```bash
./sync-db.sh vps cloud          # chép hết vào Cloud trong một transaction, đếm số dòng, rồi ROLLBACK
./copy-avatars.sh vps cloud     # đếm số avatar sẽ chép
```

Lần tập dượt này chưa từng chạy với Cloud làm phía nhận, vì lúc đó Cloud đang bị chặn. Nếu lỗi quyền, ví dụ `permission denied` khi `truncate auth.users` hoặc khi `set session_replication_role`, xem mục [Sự cố hay gặp](#su-co-hay-gap).

### 3. Chuyển thật

```bash
./cutover.sh vps cloud </dev/null
```

Script tự làm lần lượt: dừng backend → backup Cloud vào `~/backups/cloud-before-sync-*.dump` → đồng bộ → so số dòng → chép avatar → đưa backend về Cloud và chờ `/api/health`. Nếu lỗi ở bất kỳ bước nào, backend tự quay lại VPS.

Luôn chạy với `</dev/null` hoặc từ terminal. Đừng pipe script vào `bash -s`.

### 4. Đổi frontend trên Vercel

Project `v0-fitness-app-design`, môi trường Production:
- `NEXT_PUBLIC_SUPABASE_URL=https://bljmubatdtvuomucqmoj.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = anon/publishable key của Cloud. Lấy trong Supabase Dashboard → Project Settings → API Keys, hoặc biến `SUPABASE_ANON_KEY` trong `~/.config/yeahbuddy/cloud.env`.

Sau đó **redeploy** (xem các lưu ý ở mục Vercel bên dưới).

### 5. Kiểm tra

```bash
./verify.sh vps cloud                                   # không còn dòng nào đánh dấu "!"
curl -s https://www.hominhduc.me/backend/api/health     # "connected":true
```

Kiểm tra bundle frontend đã đổi URL: lệnh dưới phải in ra `bljmubatdtvuomucqmoj.supabase.co` và không còn `supabase.hominhduc.cloud`.

```bash
for js in $(curl -s https://www.hominhduc.me/ | grep -oE '/_next/static/[^"]+\.js' | sort -u); do curl -s "https://www.hominhduc.me$js" | grep -oE 'https://[a-z0-9.-]*(supabase\.co|supabase\.hominhduc\.cloud)'; done | sort -u
```

Trên trình duyệt:
- đăng nhập bằng email/mật khẩu và bằng Google;
- thử quên mật khẩu;
- mở Dashboard, Meals, Workout, và log thử một món ăn;
- xem avatar.

Mọi người phải đăng nhập lại một lần.

### 6. Sau khi về Cloud

- Để stack tự host chạy thêm vài ngày làm dự phòng. Muốn quay lại VPS thì chạy `./cutover.sh cloud vps </dev/null`.
- Cron `backup.sh` chỉ backup DB tự host. Khi Cloud là nơi chính, backup do Supabase lo (gói Free không có PITR).
- Theo dõi Usage → Egress trên Supabase Dashboard trong vài ngày đầu.
- Template email nằm trong `public/email-templates/`. Bản tự host đọc chúng qua `MAILER_TEMPLATES_*` trong `~/supabase/.env`, từ bucket công khai `email-templates` trong Storage tự host (`https://supabase.hominhduc.cloud/storage/v1/object/public/email-templates/…`). Mỗi lần sửa file trong repo, phải tải lại lên bucket này (upsert) rồi khởi động lại auth. Trên Cloud, dán nội dung vào Authentication → Emails, và kiểm tra ảnh không trỏ vào Storage của Cloud.

## Dev local

Kể từ ngày 24/09, môi trường dev ở máy local cũng trỏ về Supabase trên VPS.
- Auth và Storage dùng `https://supabase.hominhduc.cloud`. `ADDITIONAL_REDIRECT_URLS` đã có sẵn `http://localhost:3000/**`.
- DB đi qua SSH tunnel: cổng `127.0.0.1:55432` ở máy local nối tới pooler trên VPS (`127.0.0.1:5432`). Pooler chỉ nghe ở 127.0.0.1 nên không truy cập được thẳng từ internet.

**Chạy dev:** chạy `npm run dev:backend` như bình thường. `scripts/dev-backend.mjs` sẽ:
- đọc `DEV_DB_SSH_TUNNEL` trong `backend/.env`, mở tunnel và chờ cổng sẵn sàng rồi mới chạy backend;
- đóng tunnel khi bạn dừng backend;
- dùng lại tunnel nếu cổng đã có sẵn một tunnel đang mở;
- không mở tunnel nếu `backend/.env` không có biến này (ví dụ khi đang trỏ về Cloud).

Tunnel dùng SSH key của máy bạn tới `duc@187.77.133.167`.

**Đổi env local:** chạy trong Git Bash ở thư mục repo.
```bash
scripts/supabase-switch/local-env.sh vps     # trỏ về VPS: key và mật khẩu lấy thẳng từ ~/supabase/.env, không in ra
scripts/supabase-switch/local-env.sh cloud   # trả lại bản Cloud đã lưu
```
Lần đầu chạy `vps`, script lưu bản cũ (bản trỏ về Cloud) vào `~/.config/yeahbuddy/local-cloud/`, nằm ngoài repo. **Khi quay về Cloud, nhớ chạy `local-env.sh cloud`.**

**Cẩn thận:** ở chế độ này, local ghi thẳng vào **dữ liệu production**.
- Không chạy `prisma migrate dev`, `prisma db push`, các script seed (`seed:foods`…) hay các script sync ở local.
- Migration mới đi đường thường: tạo file migration bằng tay → merge vào `main` → CI chạy `migrate deploy` trên VPS.
- Nếu muốn tách hẳn, tạo một database dev riêng trong Postgres tự host rồi trỏ `DATABASE_URL` vào đó.

## Rollback

Nếu Cloud có vấn đề sau khi chuyển:

```bash
./switch-backend.sh vps
```

Sau đó trả env Vercel về giá trị VPS rồi redeploy. Dữ liệu ghi vào Cloud trong khoảng thời gian đó sẽ không có trên VPS. Nếu cần giữ lại, chạy `./cutover.sh cloud vps </dev/null` thay cho lệnh trên.

## Vercel: biến do tích hợp quản lý

Các biến `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_*` và `POSTGRES_*` do **tích hợp Supabase trên Vercel** tạo ra. Frontend chỉ đọc hai biến `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `NEXT_PUBLIC_SUPABASE_ANON_KEY` chỉ là dự phòng. Ngày 24/09, hai biến này đã được sửa bằng CLI mà không cần ngắt tích hợp. Nếu sau này tích hợp tự ghi đè lại giá trị Cloud (ví dụ khi đổi cấu hình phía Supabase), hãy chạy lại lệnh CLI bên dưới, hoặc ngắt tích hợp rồi tự tạo lại hai biến đó.

**Đổi env bằng CLI** (repo đã `vercel link`, chạy trong PowerShell ở thư mục repo). CLI sửa được cả biến do tích hợp quản lý. Key phải dùng `--type config`: anon/publishable key được phép công khai.
```powershell
"https://bljmubatdtvuomucqmoj.supabase.co" | vercel env update NEXT_PUBLIC_SUPABASE_URL production --yes
"<anon key của Cloud>" | vercel env update NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production --yes --type config
```

**Phải build mới từ git, không được "Redeploy" một bản cũ:** redeploy sẽ kế thừa env của bản gốc, nên bundle vẫn giữ URL cũ. Hãy tạo deployment mới từ một commit trên `main` có sửa frontend, hoặc push một commit có sửa frontend. Sau khi build xong, kiểm tra lại bundle bằng lệnh ở bước 5.

**Redeploy bị bỏ qua:** `vercel.json` có `ignoreCommand`, bỏ qua build khi commit mới nhất chỉ sửa `backend/`, `.github` hoặc `docker-compose.yml`. Nếu build báo CANCELED, hãy tạo deployment mới từ git với một commit trên `main` có sửa frontend. Có thể dùng Vercel connector (`create_deployment` với `gitSource`, target production), cách đã dùng ngày 24/09 với commit `e29d55b`. Hoặc push một commit có sửa frontend.

`NEXT_PUBLIC_*` được nhúng lúc build, nên chỉ đổi env mà không build lại thì không có tác dụng.

## Sự cố hay gặp

- **`migrations differ`:** chạy `./migrate.sh <phía thiếu> deploy`.
- **`the two sides have different tables`:** lệch migration hoặc có bảng tạo tay. Đưa hai phía về cùng migration trước.
- **Lỗi quyền trên Cloud** (`permission denied for table users`, `session_replication_role`): role `postgres` trên Cloud không phải superuser.
  - Thử lấy URL kết nối trực tiếp (`db.<ref>.supabase.co:5432`) trong Dashboard → Connect và đặt vào `DIRECT_URL` của `cloud.env`.
  - Nếu vẫn bị chặn, chỉ đồng bộ `public` bằng Supabase CLI (`supabase db dump --data-only`), còn tài khoản đăng nhập thì giữ nguyên như trên Cloud. Chỉ tài khoản đăng ký trong thời gian chạy trên VPS là cần tạo lại.
- **Script dừng giữa chừng mà không báo lỗi:** do chạy qua stdin. Chạy lại với `</dev/null`.
- **Backend không lên sau khi chuyển:** xem `docker logs yeahbuddy-backend`. `switch-backend.sh` so `SUPABASE_URL` và kiểm tra `/api/health` có `"connected":true`.
- **CI "Deploy to VPS" báo `.git/index: Permission denied`:** một file trong thư mục backend bị đổi chủ sang `duc`, thường do chạy `git status`/`git pull` bằng `duc` trong thư mục đó. Đừng chạy git ở đó bằng `duc`. Nếu đã lỡ, cấp lại quyền cho user deploy: `find /home/yeahbuddy/htdocs/backend.hominhduc.me -user duc -exec setfacl -m u:yeahbuddy:rw,m::rw {} +`, rồi chạy lại job deploy.
- **Không có quyền sửa thư mục backend:** `duc` đang được cấp quyền bằng ACL (`setfacl`). Nếu bị mất quyền, chạy lại lệnh ở bước 3 trong phần Chuẩn bị của runbook.
