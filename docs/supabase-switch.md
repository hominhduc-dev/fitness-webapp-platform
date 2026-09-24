# Chuyển giữa Supabase Cloud và Supabase tự host trên VPS

Ứng dụng chạy được trên cả hai. Mỗi lần chuyển gồm đồng bộ dữ liệu và đổi env, không phải sửa code. Script nằm ở `scripts/supabase-switch/`, chạy trên VPS bằng user `duc` (thuộc nhóm docker), không cần cài thêm gì. `psql` và `pg_dump` lấy từ container `supabase-db`.

- Ở mỗi thời điểm chỉ có một nơi nhận dữ liệu ghi. Khi chuyển, backend được dừng khoảng 15–30 phút.
- Được chép sang: toàn bộ schema `public` (kèm `_prisma_migrations`), `auth.users` và `auth.identities`. ID và mật khẩu giữ nguyên. Avatar được chép qua Storage API.
- Mỗi lần chuyển, người dùng phải đăng nhập lại một lần, vì JWT secret và tên cookie `sb-<ref>-auth-token` khác nhau giữa hai bên.
- Phía cũ không bị xoá, nên luôn còn đường rollback.

## Chuẩn bị một lần

1. Chép script lên VPS vào `~/yeahbuddy-ops/supabase-switch/`, rồi `chmod 700 *.sh`.
2. Lúc backend còn trên Cloud, chạy `./capture-env.sh`. Script ghi `~/.config/yeahbuddy/cloud.env` và `vps.env` (mode 600), mỗi file có 5 biến: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Cho `duc` quyền vào thư mục backend:

   ```bash
   sudo apt-get install -y acl
   sudo setfacl -m u:duc:x /home/yeahbuddy /home/yeahbuddy/htdocs
   sudo setfacl -R -m u:duc:rwX -m d:u:duc:rwX /home/yeahbuddy/htdocs/backend.hominhduc.me
   ```

   Sau đó tạo file `docker-compose.override.yml` nằm cạnh `docker-compose.yml`. File này chỉ có trên server; thêm nó và `supabase.env` vào `.git/info/exclude`. Nó làm hai việc: đọc `supabase.env` sau `backend/.env`, và đưa backend vào chung network với Supabase:

   ```yaml
   services:
     backend:
       env_file:
         - path: ./backend/.env
         - path: ./supabase.env
           required: false
       networks: [default, supabase]
   networks:
     supabase:
       name: supabase_default
       external: true
   ```
4. Cấu hình Auth trong `~/supabase/.env`, xong thì chạy `docker compose up -d auth`:
   - `SITE_URL=<domain frontend>`.
   - `ADDITIONAL_REDIRECT_URLS=<domain>/**,http://localhost:3000/**`.
   - Google:
     - bỏ comment `GOTRUE_EXTERNAL_GOOGLE_*` trong `docker-compose.yml`;
     - trong `.env` đặt `GOOGLE_ENABLED=true`, `GOOGLE_CLIENT_ID` và `GOOGLE_SECRET`;
     - thêm `https://supabase.hominhduc.cloud/auth/v1/callback` vào Authorized redirect URIs trên Google Cloud Console.
   - SMTP thật (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME`). Mặc định đang là mail giả, nên email quên mật khẩu không gửi đi đâu cả.
5. Cài backup chạy hằng đêm bằng `crontab -e`:

   ```
   15 3 * * * /home/duc/yeahbuddy-ops/supabase-switch/backup.sh >>/home/duc/backups/backup.log 2>&1
   ```

   Nên chép thêm `~/backups` ra ngoài VPS.

## Chuyển Cloud → VPS

```bash
cd ~/yeahbuddy-ops/supabase-switch
./migrate.sh vps deploy          # đưa DB tự host lên cùng migration với Cloud
./sync-db.sh cloud vps           # tập dượt: chép hết, kiểm tra số dòng, rollback
./copy-avatars.sh cloud vps      # xem bao nhiêu avatar tải được

# bắt đầu bảo trì
docker stop yeahbuddy-backend
./sync-db.sh cloud vps --apply   # backup phía đích vào ~/backups rồi mới ghi
./verify.sh cloud vps            # các dòng khác nhau được đánh dấu "!"
./copy-avatars.sh cloud vps --apply
./switch-backend.sh vps          # chờ /api/health báo đã kết nối DB
```

Sau đó đổi env trên Vercel rồi **redeploy**. Biến `NEXT_PUBLIC_*` được nhúng lúc build, nên chỉ đổi env mà không build lại thì không có tác dụng.
- `NEXT_PUBLIC_SUPABASE_URL=https://supabase.hominhduc.cloud`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY trong ~/supabase/.env>`

## Chuyển VPS → Cloud

Làm được khi Cloud đã hết bị restrict (sang chu kỳ billing mới hoặc đã nâng Pro).

```bash
./migrate.sh cloud status
./sync-db.sh vps cloud           # tập dượt trên Cloud, không thay đổi gì
docker stop yeahbuddy-backend
./sync-db.sh vps cloud --apply
./verify.sh vps cloud
./copy-avatars.sh vps cloud --apply
./switch-backend.sh cloud
```

Sau đó trả env Vercel về giá trị Cloud (lấy trong `cloud.env`) rồi redeploy.

## Rollback

Nếu hỏng giữa chừng, chạy `./switch-backend.sh <phía cũ>` và trả env Vercel về như trước. Phía cũ vẫn giữ nguyên dữ liệu tại lúc dừng backend. `sync-db.sh --apply` luôn lưu một bản dump của phía đích vào `~/backups/<phía>-before-sync-*.dump` trước khi ghi.

## Kiểm tra sau mỗi lần chuyển

- `./verify.sh cloud vps` không còn dòng nào bị đánh dấu `!`. `./migrate.sh <phía mới>` báo up to date.
- Đăng nhập bằng email/mật khẩu của một tài khoản cũ, đăng nhập bằng Google, và thử quên mật khẩu (email phải tới nơi).
- Dashboard, Meals, Workout hiện dữ liệu cũ. Log một món ăn rồi reload, món vẫn còn. Avatar hiện đúng và upload avatar mới được.
- `docker logs yeahbuddy-backend` không có lỗi Prisma hay 401 từ Supabase.
