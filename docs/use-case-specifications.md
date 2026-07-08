# 1.3. Đặc tả Use Case cho toàn hệ thống

Tài liệu này đặc tả 6 use case chính của hệ thống YeahBuddy Fitness theo format bảng giống mockup. Các chức năng như profile, avatar, resume workout, notification, AI, export và exercise import được mô tả trong luồng phụ của use case chính tương ứng.

## 1.3.1. Use Case: Đăng ký tài khoản

<table>
  <tbody>
    <tr>
      <td>
        <strong>Ca sử dụng:</strong> Đăng ký tài khoản<br>
        <strong>Các tác nhân:</strong> Khách truy cập, Supabase Auth, Hệ thống<br>
        <strong>Điều kiện trước:</strong> Khách truy cập chưa đăng nhập; email, username và số điện thoại chưa được đăng ký; mật khẩu hợp lệ theo chính sách hệ thống.<br>
        <strong>Điều kiện sau:</strong> Tài khoản Supabase Auth được tạo; hồ sơ người dùng trong bảng <code>User</code> được tạo hoặc chờ xác nhận email; nếu có session thì người dùng được điều hướng theo vai trò.<br>
        <strong>Mô tả:</strong> Khách truy cập tạo tài khoản bằng cách nhập thông tin cá nhân, thông tin đăng nhập và vai trò. Hệ thống kiểm tra dữ liệu, tạo tài khoản xác thực qua Supabase Auth, sau đó đồng bộ hồ sơ người dùng vào cơ sở dữ liệu của ứng dụng.
      </td>
    </tr>
    <tr>
      <th align="center">Luồng sự kiện chính</th>
    </tr>
    <tr>
      <td>
        <ol>
          <li>Khách truy cập chọn chức năng đăng ký.</li>
          <li>Hệ thống hiển thị form đăng ký.</li>
          <li>Khách truy cập nhập họ tên, email, username, số điện thoại, mật khẩu và vai trò.</li>
          <li>Khách truy cập gửi form đăng ký.</li>
          <li>Frontend gửi yêu cầu <code>POST /api/auth/register</code>.</li>
          <li>Backend kiểm tra dữ liệu đầu vào và vai trò hợp lệ.</li>
          <li>Backend gọi Supabase Auth để tạo auth user.</li>
          <li>Backend tạo local <code>User</code> profile trong PostgreSQL.</li>
          <li>Hệ thống trả kết quả đăng ký thành công và điều hướng người dùng theo vai trò nếu session được tạo ngay.</li>
        </ol>
      </td>
    </tr>
    <tr>
      <th align="center">Luồng sự kiện phụ</th>
    </tr>
    <tr>
      <td>
        <ol>
          <li>Email, username hoặc số điện thoại đã tồn tại: hệ thống thông báo lỗi và yêu cầu nhập lại.</li>
          <li>Mật khẩu không hợp lệ: hệ thống thông báo lỗi theo chính sách xác thực.</li>
          <li>Supabase yêu cầu xác nhận email: hệ thống trả trạng thái chờ xác nhận và yêu cầu người dùng kiểm tra email.</li>
          <li>Vai trò không hợp lệ: hệ thống từ chối yêu cầu đăng ký.</li>
        </ol>
      </td>
    </tr>
  </tbody>
</table>

## 1.3.2. Use Case: Đăng nhập

<table>
  <tbody>
    <tr>
      <td>
        <strong>Ca sử dụng:</strong> Đăng nhập<br>
        <strong>Các tác nhân:</strong> Người dùng, Supabase Auth, Hệ thống<br>
        <strong>Điều kiện trước:</strong> Người dùng đã có tài khoản hợp lệ; tài khoản chưa bị khóa; hệ thống xác thực đang hoạt động.<br>
        <strong>Điều kiện sau:</strong> Người dùng có session hợp lệ; hệ thống xác định được vai trò; người dùng được chuyển đến màn hình phù hợp với vai trò.<br>
        <strong>Mô tả:</strong> Người dùng đăng nhập bằng email, username hoặc số điện thoại cùng mật khẩu. Hệ thống xác thực với Supabase Auth, tải hồ sơ người dùng trong ứng dụng, kiểm tra trạng thái hoạt động và điều hướng theo vai trò trainee, coach hoặc admin.
      </td>
    </tr>
    <tr>
      <th align="center">Luồng sự kiện chính</th>
    </tr>
    <tr>
      <td>
        <ol>
          <li>Người dùng chọn chức năng đăng nhập.</li>
          <li>Hệ thống hiển thị form đăng nhập.</li>
          <li>Người dùng nhập email, username hoặc số điện thoại và mật khẩu.</li>
          <li>Frontend gửi yêu cầu <code>POST /api/auth/login</code>.</li>
          <li>Backend xác thực thông tin đăng nhập với Supabase Auth.</li>
          <li>Backend tải hoặc đồng bộ hồ sơ <code>User</code> từ PostgreSQL.</li>
          <li>Hệ thống kiểm tra trạng thái hoạt động và vai trò của người dùng.</li>
          <li>Hệ thống tạo session cho trình duyệt.</li>
          <li>Hệ thống điều hướng trainee đến <code>/dashboard</code>, coach đến <code>/coach</code>, admin đến <code>/admin</code>.</li>
        </ol>
      </td>
    </tr>
    <tr>
      <th align="center">Luồng sự kiện phụ</th>
    </tr>
    <tr>
      <td>
        <ol>
          <li>Sai tài khoản hoặc mật khẩu: hệ thống thông báo đăng nhập thất bại.</li>
          <li>Tài khoản bị khóa: hệ thống từ chối đăng nhập vào ứng dụng.</li>
          <li>Session hết hạn: hệ thống gọi <code>POST /api/auth/refresh</code> hoặc yêu cầu đăng nhập lại.</li>
          <li>Người dùng quên mật khẩu: hệ thống gọi <code>POST /api/auth/forgot-password</code> để gửi hướng dẫn khôi phục.</li>
          <li>Người dùng cập nhật hồ sơ: hệ thống gọi <code>PATCH /api/auth/me</code>.</li>
          <li>Người dùng upload avatar: hệ thống gọi <code>POST /api/auth/me/avatar</code> và lưu URL ảnh vào hồ sơ.</li>
          <li>App shell tải thông báo: hệ thống gọi <code>GET /api/notifications</code>; người dùng có thể đánh dấu đã đọc bằng <code>PATCH /api/notifications/:notificationId/read</code> hoặc <code>POST /api/notifications/read-all</code>.</li>
        </ol>
      </td>
    </tr>
  </tbody>
</table>

## 1.3.3. Use Case: Trainee thực hiện và ghi log buổi tập

<table>
  <tbody>
    <tr>
      <td>
        <strong>Ca sử dụng:</strong> Trainee thực hiện và ghi log buổi tập<br>
        <strong>Các tác nhân:</strong> Trainee, Hệ thống, Browser localStorage, PostgreSQL<br>
        <strong>Điều kiện trước:</strong> Người dùng đã đăng nhập với vai trò trainee; workout tồn tại và trainee có quyền truy cập; trình duyệt hỗ trợ localStorage để lưu buổi tập đang dở.<br>
        <strong>Điều kiện sau:</strong> Workout log được tạo khi trainee hoàn tất buổi tập; dữ liệu session tạm được xóa sau khi lưu thành công; lịch sử tập luyện và tiến độ được cập nhật.<br>
        <strong>Mô tả:</strong> Trainee chọn hoặc tạo workout, bắt đầu buổi tập, nhập kết quả từng set như reps, weight, RIR và trạng thái hoàn thành. Hệ thống lưu tạm tiến độ trên trình duyệt để có thể tiếp tục nếu trainee rời trang, sau đó tạo workout log khi buổi tập hoàn tất.
      </td>
    </tr>
    <tr>
      <th align="center">Luồng sự kiện chính</th>
    </tr>
    <tr>
      <td>
        <ol>
          <li>Trainee mở dashboard hoặc trang workout.</li>
          <li>Hệ thống tải danh sách workout bằng <code>GET /api/workouts</code>.</li>
          <li>Trainee chọn một workout và bấm bắt đầu.</li>
          <li>Frontend gọi <code>GET /api/workouts/:workoutId</code> để lấy chi tiết workout.</li>
          <li>Hệ thống hiển thị danh sách bài tập và các set cần thực hiện.</li>
          <li>Trainee nhập kết quả từng set trong buổi tập.</li>
          <li>Hệ thống lưu tạm tiến độ vào <code>localStorage</code> theo key <code>workout-session:{workoutId}</code>.</li>
          <li>Trainee bấm hoàn tất buổi tập.</li>
          <li>Frontend gửi kết quả qua <code>POST /api/workouts/:workoutId/logs</code>.</li>
          <li>Backend tạo snapshot, tính tổng volume và lưu <code>WorkoutLog</code>.</li>
          <li>Hệ thống xóa session tạm và cập nhật lịch sử tập luyện.</li>
        </ol>
      </td>
    </tr>
    <tr>
      <th align="center">Luồng sự kiện phụ</th>
    </tr>
    <tr>
      <td>
        <ol>
          <li>Trainee tạo workout cá nhân: hệ thống tải exercise library bằng <code>GET /api/exercises/library</code> và lưu bằng <code>POST /api/workouts</code>.</li>
          <li>Trainee sửa hoặc xóa workout cá nhân: hệ thống gọi <code>PATCH /api/workouts/:workoutId</code> hoặc <code>DELETE /api/workouts/:workoutId</code>.</li>
          <li>Trainee rời trang khi đang tập: app shell hiển thị resume card dựa trên dữ liệu localStorage.</li>
          <li>Trainee chọn tiếp tục buổi tập: hệ thống mở lại trang start workout và khôi phục tiến độ.</li>
          <li>Trainee chọn hủy session: hệ thống xóa dữ liệu localStorage và ẩn resume card.</li>
          <li>Workout không tồn tại hoặc trainee không có quyền: hệ thống trả lỗi 404 hoặc 403.</li>
          <li>Trainee export workout log: hệ thống gọi <code>POST /api/workouts/logs/export/google-sheets</code>.</li>
        </ol>
      </td>
    </tr>
  </tbody>
</table>

## 1.3.4. Use Case: Trainee ghi nhận dinh dưỡng và theo dõi tiến độ

<table>
  <tbody>
    <tr>
      <td>
        <strong>Ca sử dụng:</strong> Trainee ghi nhận dinh dưỡng và theo dõi tiến độ<br>
        <strong>Các tác nhân:</strong> Trainee, Hệ thống, USDA API, AI Provider, PostgreSQL<br>
        <strong>Điều kiện trước:</strong> Người dùng đã đăng nhập với vai trò trainee; ngày ghi nhận hợp lệ; food hoặc dữ liệu cân nặng nhập vào hợp lệ.<br>
        <strong>Điều kiện sau:</strong> Meal log, macro và body metrics được cập nhật; hệ thống hiển thị analytics tiến độ dựa trên meal, weight và workout log.<br>
        <strong>Mô tả:</strong> Trainee ghi nhận món ăn trong ngày, theo dõi tổng calories và macro, ghi cân nặng/body metrics và xem phân tích tiến độ tập luyện. AI meal plan là luồng mở rộng hỗ trợ tạo thực đơn và ghi vào meal log.
      </td>
    </tr>
    <tr>
      <th align="center">Luồng sự kiện chính</th>
    </tr>
    <tr>
      <td>
        <ol>
          <li>Trainee mở trang meals.</li>
          <li>Frontend gọi <code>GET /api/meals?date=YYYY-MM-DD</code>.</li>
          <li>Hệ thống hiển thị daily nutrition gồm bữa ăn, món ăn, calories và macro.</li>
          <li>Trainee tìm food bằng <code>GET /api/foods?query=...</code>.</li>
          <li>Trainee chọn food, nhập khẩu phần và meal type.</li>
          <li>Frontend gọi <code>POST /api/meals/items</code> để thêm món vào bữa ăn.</li>
          <li>Hệ thống tính lại calories, protein, carbs và fat trong ngày.</li>
          <li>Trainee mở trang progress hoặc track weight.</li>
          <li>Frontend gọi <code>GET /api/progress/weight</code> để lấy lịch sử cân nặng.</li>
          <li>Trainee nhập cân nặng mới và gửi qua <code>POST /api/progress/weight</code>.</li>
          <li>Hệ thống gọi <code>GET /api/progress/analytics</code> để hiển thị biểu đồ tiến độ.</li>
        </ol>
      </td>
    </tr>
    <tr>
      <th align="center">Luồng sự kiện phụ</th>
    </tr>
    <tr>
      <td>
        <ol>
          <li>Food chưa tồn tại: trainee tạo food cá nhân bằng <code>POST /api/foods</code>.</li>
          <li>Trainee xóa món khỏi bữa ăn: hệ thống gọi <code>DELETE /api/meals/items/:itemId</code>.</li>
          <li>Trainee cập nhật nutrition target: hệ thống gọi <code>PATCH /api/auth/me</code>.</li>
          <li>Trainee dùng AI meal plan: hệ thống gọi <code>POST /api/ai/generate-meal-plan</code> và accept bằng <code>POST /api/ai/accept-meal-plan</code>.</li>
          <li>USDA API lỗi: hệ thống vẫn trả kết quả food local nếu có.</li>
          <li>Chưa có workout log hoặc body metrics: hệ thống hiển thị trạng thái rỗng cho analytics.</li>
          <li>Ngày, tháng hoặc năm không hợp lệ: hệ thống thông báo lỗi nhập liệu.</li>
        </ol>
      </td>
    </tr>
  </tbody>
</table>

## 1.3.5. Use Case: Coach quản lý giáo án và trainee

<table>
  <tbody>
    <tr>
      <td>
        <strong>Ca sử dụng:</strong> Coach quản lý giáo án và trainee<br>
        <strong>Các tác nhân:</strong> Coach, Trainee, Hệ thống, AI Provider, n8n/Google Sheets<br>
        <strong>Điều kiện trước:</strong> Coach đã đăng nhập và có quyền coach; trainee thuộc quyền quản lý của coach khi xem chi tiết, comment, check-in hoặc export; dữ liệu program/workout log tồn tại khi thao tác.<br>
        <strong>Điều kiện sau:</strong> Coach request, program, assignment, feedback, body metrics, check-in hoặc export được xử lý theo thao tác; dữ liệu coaching được cập nhật trong hệ thống.<br>
        <strong>Mô tả:</strong> Coach quản lý toàn bộ luồng coaching gồm kết nối với trainee, tạo và gán giáo án, theo dõi tiến độ, phản hồi workout log, tạo check-in và export dữ liệu. AI workout program và exercise import request là luồng phụ hỗ trợ công việc của coach.
      </td>
    </tr>
    <tr>
      <th align="center">Luồng sự kiện chính</th>
    </tr>
    <tr>
      <td>
        <ol>
          <li>Trainee tìm coach bằng <code>GET /api/coach/discover</code>.</li>
          <li>Trainee gửi yêu cầu kết nối bằng <code>POST /api/coach/requests</code>.</li>
          <li>Coach mở dashboard bằng <code>GET /api/coach/dashboard</code>.</li>
          <li>Coach duyệt hoặc từ chối request bằng <code>PATCH /api/coach/requests/:requestId</code>.</li>
          <li>Coach mở trình tạo giáo án và tải exercises, trainees.</li>
          <li>Coach tạo program bằng <code>POST /api/coach/programs</code>.</li>
          <li>Hệ thống tạo <code>Program</code>, <code>Workout</code>, <code>WorkoutExercise</code> và <code>ExerciseSet</code>.</li>
          <li>Coach gán giáo án cho trainee bằng <code>POST /api/coach/programs/:programId/assignments</code>.</li>
          <li>Coach mở chi tiết trainee bằng <code>GET /api/coach/trainees/:traineeId</code>.</li>
          <li>Coach xem workout logs bằng <code>GET /api/coach/trainees/:traineeId/workout-logs</code>.</li>
          <li>Coach phản hồi workout log hoặc tạo check-in nếu cần.</li>
        </ol>
      </td>
    </tr>
    <tr>
      <th align="center">Luồng sự kiện phụ</th>
    </tr>
    <tr>
      <td>
        <ol>
          <li>Coach assign, unassign hoặc adjust program bằng các endpoint assignment/adjustment của <code>/api/coach/programs</code>.</li>
          <li>Coach archive hoặc restore program bằng <code>POST /api/coach/programs/:programId/archive</code> hoặc <code>POST /api/coach/programs/:programId/restore</code>.</li>
          <li>Coach dùng AI tạo giáo án: hệ thống gọi <code>POST /api/ai/generate-program</code> và <code>POST /api/ai/accept-program</code>.</li>
          <li>Coach comment workout log bằng <code>POST /api/coach/workout-logs/:workoutLogId/comments</code>.</li>
          <li>Coach ghi body metrics bằng <code>POST /api/coach/trainees/:traineeId/body-metrics</code>.</li>
          <li>Coach tạo check-in bằng <code>POST /api/coach/trainees/:traineeId/check-ins</code>.</li>
          <li>Coach export logs bằng <code>POST /api/coach/trainees/:traineeId/workout-logs/export/google-sheets</code>.</li>
          <li>Coach gửi exercise import request bằng <code>POST /api/coach/exercise-import-requests</code>; admin xử lý trong UC quản trị hệ thống.</li>
          <li>Trainee không thuộc coach hoặc dữ liệu không tồn tại: hệ thống trả lỗi 403 hoặc 404.</li>
        </ol>
      </td>
    </tr>
  </tbody>
</table>

## 1.3.6. Use Case: Admin quản trị hệ thống

<table>
  <tbody>
    <tr>
      <td>
        <strong>Ca sử dụng:</strong> Admin quản trị hệ thống<br>
        <strong>Các tác nhân:</strong> Admin, Coach, Trainee, Supabase Auth, Hệ thống<br>
        <strong>Điều kiện trước:</strong> Người dùng đã đăng nhập với vai trò admin; target user, program, exercise hoặc request tồn tại khi thao tác; dữ liệu import/sync hợp lệ nếu admin xử lý exercise library.<br>
        <strong>Điều kiện sau:</strong> User, role, connection, coach request, program, exercise hoặc import request được cập nhật; hệ thống ghi <code>AdminAuditLog</code> cho các thao tác quản trị.<br>
        <strong>Mô tả:</strong> Admin vận hành nền tảng bằng cách quản lý người dùng, phân quyền, kết nối coach-trainee, coach request, program, exercise library, import request và audit log. Đây là use case quản trị tổng hợp của hệ thống.
      </td>
    </tr>
    <tr>
      <th align="center">Luồng sự kiện chính</th>
    </tr>
    <tr>
      <td>
        <ol>
          <li>Admin mở trang quản trị.</li>
          <li>Frontend gọi <code>GET /api/admin/dashboard</code>.</li>
          <li>Hệ thống xác thực vai trò admin và hiển thị dashboard nền tảng.</li>
          <li>Admin tìm kiếm người dùng bằng <code>GET /api/admin/users</code>.</li>
          <li>Admin cập nhật vai trò hoặc trạng thái active bằng <code>PATCH /api/admin/users/:userId</code>.</li>
          <li>Hệ thống cập nhật <code>User</code> và ghi <code>AdminAuditLog</code>.</li>
          <li>Admin quản lý kết nối coach-trainee bằng <code>GET</code>, <code>POST</code> hoặc <code>DELETE /api/admin/connections</code>.</li>
          <li>Admin quản lý program, coach request và exercise library bằng các endpoint admin tương ứng.</li>
          <li>Admin xem audit log bằng <code>GET /api/admin/audit-logs</code>.</li>
        </ol>
      </td>
    </tr>
    <tr>
      <th align="center">Luồng sự kiện phụ</th>
    </tr>
    <tr>
      <td>
        <ol>
          <li>Admin reset mật khẩu user: hệ thống gọi <code>POST /api/admin/users/:userId/reset-password</code> và cập nhật Supabase Auth.</li>
          <li>Admin duyệt hoặc xóa coach request: hệ thống gọi <code>PATCH</code> hoặc <code>DELETE /api/admin/coach-requests/:requestId</code>.</li>
          <li>Admin xóa program: hệ thống gọi <code>DELETE /api/admin/programs/:programId</code>.</li>
          <li>Admin tạo, sửa, xóa exercise bằng <code>POST</code>, <code>PATCH</code>, <code>DELETE /api/admin/exercises</code>.</li>
          <li>Admin import exercise hàng loạt bằng <code>POST /api/admin/exercises/import</code>.</li>
          <li>Admin preview/apply sync exercise bằng <code>POST /api/admin/exercises/sync-preview</code> và <code>POST /api/admin/exercises/sync-apply</code>.</li>
          <li>Admin duyệt exercise import request từ coach bằng <code>GET /api/admin/exercise-import-requests</code> và <code>PATCH /api/admin/exercise-import-requests/:requestId</code>.</li>
          <li>Target không tồn tại, role không phù hợp hoặc dữ liệu import sai: hệ thống thông báo lỗi và không ghi thay đổi không hợp lệ.</li>
        </ol>
      </td>
    </tr>
  </tbody>
</table>
