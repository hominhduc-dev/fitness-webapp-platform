/* Documentation generator. Reads source only; never calls a provider or database. */
const fs = require('node:fs');
const path = require('node:path');
const out = __dirname;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tex = s => String(s).replace(/[\\{}%&#_$^~]/g, c => ({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','%':'\\%','&':'\\&','#':'\\#','_':'\\_','$':'\\$','^':'\\textasciicircum{}','~':'\\textasciitilde{}'}[c]));
const write = (name, data) => fs.writeFileSync(path.join(out, name), data, 'utf8');
const cases = [
 {n:1,name:'Tạo chương trình tập nhiều tuần',actor:'Trainee',group:'training',api:'POST /api/ai/generate-program',pre:'Đã đăng nhập; cấu hình provider hợp lệ; còn quota và có catalog phù hợp.',input:'Goal, experienceLevel, daysPerWeek 2–7, durationWeeks 1–16, sessionDuration 20–180 phút, equipment, focusAreas, injuries.',steps:['Người dùng nhập mục tiêu và điều kiện tập.','API xác thực profile, validate input và quota ngày.','Service lọc catalog và bổ sung context tập luyện/phục hồi.','Tạo generation pending; gọi provider với refs bài tập.','Parse, map và validate output; có thể repair một lần.','Lưu completed và trả generationId cùng bản nháp để preview.'],post:'Có draft; chưa tạo Program/Workout nghiệp vụ.',alt:'Input sai; quota hết; catalog thiếu; provider/JSON/validation lỗi: từ chối hoặc lưu failed, không tạo program.',ac:'Với output hợp lệ, preview chỉ chứa variation được phép; chưa có Program mới trước accept. Output không hợp lệ không được lưu completed.',source:'backend/src/services/ai.service.ts',diagram:'sequence-program'},
 {n:2,name:'Tạo buổi tập theo ngày',actor:'Trainee',group:'training',api:'POST /api/ai/generate-workout',pre:'Đã đăng nhập; ngày hợp lệ, có catalog và còn quota workout_program.',input:'Date, goal, experienceLevel, energyLevel low/normal/high, sessionDuration 20–120 phút, equipment, focusAreas, injuries.',steps:['Trainee chọn ngày, mức năng lượng và điều kiện tập.','Service validate input, lọc catalog và tạo generation pending.','Provider sinh một buổi tập; backend validate workload và variations.','Lưu completed với mode daily và trả preview.'],post:'Draft một buổi, dùng loại workout_program và mode daily.',alt:'Ngày/input sai; workload vượt giới hạn; output không map được; lỗi provider: không tạo workout thật.',ac:'Draft có mode daily; ngày và thiết bị được bảo toàn; request accept-workout không được nhận draft program nhiều tuần.',source:'backend/src/services/ai.service.ts',diagram:'sequence-daily'},
 {n:3,name:'Xác nhận lưu chương trình hoặc buổi tập',actor:'Trainee',group:'training',api:'POST /api/ai/accept-program; POST /api/ai/accept-workout',pre:'Draft thuộc requester, đúng loại/mode và trạng thái completed.',input:'GenerationId UUID.',steps:['Trainee xem preview và bấm xác nhận.','Service đọc generation, kiểm tra chủ sở hữu, trạng thái và mode.','Transaction claim generation bằng conditional update.','Revalidate quyền truy cập variation và equipment trong transaction.','Tạo program, assignment, workout, exercises, sets; daily đặt scheduledDate.','Commit và trả programId; generation chuyển accepted.'],post:'Dữ liệu nghiệp vụ tạo đúng một lần trên đường accept được bảo vệ.',alt:'Draft không tìm thấy/khác chủ; đã accepted; catalog đổi; transaction lỗi: trả lỗi, rollback toàn bộ.',ac:'Hai request accept cùng draft không tạo hai program; catalog mất quyền không để lại dữ liệu ghi dở; accept không gọi lại LLM.',source:'backend/src/services/ai/acceptance.ts',diagram:'sequence-accept'},
 {n:4,name:'Coach tạo và gán program AI',actor:'Coach',group:'coach',api:'POST /api/coach/trainees/:traineeId/ai-program; POST /api/coach/trainees/:traineeId/ai-program/accept',pre:'Requester là coach và trainee thuộc coach; draft accept đúng trainee.',input:'TraineeId, input program; generationId khi accept.',steps:['Coach chọn trainee và nhập điều kiện program.','Service kiểm tra role, quan hệ coach–trainee và quota.','Tạo draft với coachGenerated và traineeId.','Coach review rồi gửi request accept riêng.','Transaction tạo program thuộc coach và assignment cho trainee.'],post:'Chương trình thuộc coach, được gán đúng trainee.',alt:'Sai role/quan hệ; draft dành trainee khác; catalog hoặc generation đổi: từ chối ghi.',ac:'Coach không tạo/gán program cho trainee ngoài quyền; ProgramAssignment.userId là trainee, không phải coach.',source:'backend/src/services/ai.service.ts',diagram:'sequence-coach-program'},
 {n:5,name:'Tạo thực đơn AI nhiều ngày',actor:'Trainee',group:'nutrition',api:'POST /api/ai/generate-meal-plan',pre:'Có mục tiêu calories hợp lệ, phần mục tiêu còn cần plan và food catalog phù hợp.',input:'Date, days 1–7, preferences, budget low/medium/high, cookingTime quick/normal; profile cung cấp goals/allergies/diet.',steps:['Trainee yêu cầu thực đơn cho ngày bắt đầu và số ngày.','Backend tính phần goals/bữa còn lại từ consumed meals và lọc food catalog.','Tạo pending rồi gọi model bằng catalog IDs.','Map food, tính calories/macros và validate từng ngày.','Tạo shopping list từ dữ liệu đã map; lưu completed.','Loại các draft completed cũ bằng discarded; trả draft mới.'],post:'Một draft mới được trả; chưa ghi bữa consumed hay planned.',alt:'Thiếu/không an toàn calorie goal; không còn bữa cần plan; catalog quá nhỏ; provider/output lỗi.',ac:'Totals và shopping list dựa trên catalog backend; phần consumed không bị lập lại; draft cũ không hồi sinh sau discard draft mới.',source:'backend/src/services/ai.service.ts',diagram:'sequence-meal'},
 {n:6,name:'Đọc, bỏ hoặc đổi một bữa trong draft',actor:'Trainee',group:'nutrition',api:'GET /api/ai/meal-plan-draft; POST /api/ai/discard-meal-plan; POST /api/ai/regenerate-meal-plan-meal',pre:'Draft meal_plan thuộc requester; đổi bữa yêu cầu completed và còn quota swap.',input:'GenerationId; date và mealType khi đổi bữa.',steps:['Đọc draft mới nhất để tiếp tục preview mà không generate lại.','Nếu bỏ draft, update completed sang discarded và giữ row quota.','Nếu đổi bữa, tính mục tiêu còn lại sau các bữa không đổi.','Gọi provider, validate bữa mới và cả ngày.','Update có điều kiện chỉ khi draft còn completed.'],post:'Draft giữ nguyên, discarded hoặc được thay đúng một bữa.',alt:'Draft cũ không parse được có thể trả không có draft; draft đã accept hoặc thay đổi đồng thời bị từ chối swap.',ac:'GET/discard không gọi LLM; swap không sửa bữa khác; accept đồng thời thắng thì swap không ghi đè draft accepted.',source:'backend/src/services/ai.service.ts',diagram:'sequence-draft'},
 {n:7,name:'Xác nhận lưu thực đơn dự kiến',actor:'Trainee',group:'nutrition',api:'POST /api/ai/accept-meal-plan',pre:'Generation meal_plan completed thuộc requester; override chỉ dùng food có trong draft.',input:'GenerationId, date và days/khẩu phần tùy chọn.',steps:['Trainee review và có thể chỉnh khẩu phần.','Service parse input, kiểm tra draft và các override.','Transaction claim generation rồi đọc catalog hiện tại.','Quy đổi khẩu phần và tính lại totals; validate draft chưa chỉnh theo targets.','Thay planned meals của những ngày trong plan, tạo Meal planned.','Commit generation accepted; trả kết quả.'],post:'Chỉ có bữa dự kiến; nhật ký consumed không tăng.',alt:'Food xóa/đổi hoặc ngoài draft; đơn vị không quy đổi được; draft đã accept; transaction lỗi: rollback.',ac:'Accept không làm tăng consumed totals; phần ăn trainee tự sửa không bị ép giữ nguyên target AI; lỗi catalog không xóa planned meals hiện có.',source:'backend/src/services/ai.service.ts',diagram:'sequence-meal-accept'},
 {n:8,name:'Xác nhận đã ăn bữa dự kiến',actor:'Trainee',group:'nutrition',api:'POST /api/meals/plans/consume',pre:'Planned meal thuộc trainee; thao tác nối tiếp AI meal lifecycle, không gọi AI.',input:'Thông tin planned meal theo route consume.',steps:['Trainee chọn bữa dự kiến và xác nhận đã ăn.','Service xác thực quyền, đọc planned items.','Transaction ghi consumed, xóa planned meal cũ và tính lại totals.','UI hiển thị nhật ký và totals consumed mới.'],post:'Bữa chuyển vào dữ liệu đã ăn; context dinh dưỡng phản ánh consumed.',alt:'Bữa không còn planned/khác chủ hoặc transaction lỗi: trả lỗi và không chuyển dở.',ac:'Chỉ thao tác consume mới tăng consumed totals; kiểm thử quyền và request lặp với fixture riêng.',source:'backend/src/services/nutrition.service.ts',diagram:'sequence-consume'},
 {n:9,name:'Coach review thực đơn dự kiến',actor:'Coach',group:'coach',api:'GET /api/coach/trainees/:traineeId/meal-plans; PATCH/DELETE .../items/:itemId; POST .../review',pre:'Coach sở hữu trainee và item đang planned.',input:'Date, itemId, amountValue/amountUnit hoặc coachNote tùy thao tác.',steps:['Coach xem planned meals của trainee.','Coach chỉnh khẩu phần hoặc xóa planned item.','Service xác minh quyền và planned status trước ghi.','Khi duyệt, lưu coachNote/coachReviewedAt và tạo notification trainee.'],post:'Planned meals cập nhật; consumed là record của trainee.',alt:'Trainee ngoài quyền; item consumed/khác chủ; khẩu phần sai: từ chối.',ac:'Coach không sửa consumed item bằng các route planned; duyệt có timestamp/note và notification theo code.',source:'backend/src/services/meal-plan-review.service.ts',diagram:'sequence-review'},
 {n:10,name:'Chat AI và tạo draft qua tool',actor:'Trainee',group:'chat',api:'POST /api/ai/chat',pre:'Profile xác thực, còn quota chat và provider cấu hình hợp lệ; UI chat dành trainee.',input:'Message tối đa 2000 ký tự; history role user/assistant, schema tối đa 40 messages; service giữ 6 messages sau sanitize.',steps:['Trainee gửi câu hỏi.','Service sanitize history, phát hiện intent bằng luật và chọn context.','Gọi provider với hai tool cho phép hoặc text fallback nếu không hỗ trợ tools.','Nếu model yêu cầu tool, validate args và gọi service tạo draft.','Trả tool results cho follow-up; tối đa một draft thành công trong message.','Trả reply và action draft nếu có; trainee xác nhận riêng để lưu.'],post:'Có reply và có thể có generation draft; không tự accept.',alt:'Context lỗi dùng prompt chung; tool không tồn tại bị từ chối; follow-up lỗi vẫn giữ action draft; provider chính lỗi trả lỗi.',ac:'Không thực thi tên tool tùy ý; reply chỉ dẫn không làm phát sinh business write; quota chat tool và quota generation đều áp dụng.',source:'backend/src/services/ai.service.ts',diagram:'sequence-chat'},
 {n:11,name:'Tạo và đọc insight dinh dưỡng',actor:'Trainee',group:'nutrition',api:'GET/POST /api/ai/nutrition-insight',pre:'Profile xác thực; date và locale hợp lệ; tạo mới cần dữ liệu phù hợp và quota.',input:'Date, locale vi/en.',steps:['GET đọc insight gần nhất và so fingerprint để trả stale.','POST dựng findings từ intake/ngày và cửa sổ 7 ngày.','Backend tính status/coverage và chọn candidate foods.','Model viết summary/points và chọn suggestedFoodIds; backend validate cả ID và ngôn ngữ.','Lưu insight completed với fingerprint, promptVersion, locale, tokenUsage.'],post:'Nhận xét lưu riêng; không tạo meal hoặc đổi mục tiêu.',alt:'Không đủ dữ liệu; quota; sai locale/output; provider 429 được xử lý trả quota theo nhánh insight.',ac:'Dữ liệu ăn thay đổi làm báo stale; chỉ food ID trong candidates được trả; GET không gọi provider.',source:'backend/src/services/ai/nutrition-insight.ts',diagram:'sequence-insight'},
 {n:12,name:'Coach phân tích tiến độ trainee',actor:'Coach',group:'coach',api:'GET/POST /api/coach/trainees/:traineeId/ai-insight',pre:'Coach sở hữu trainee; cửa sổ 7/14/28 ngày; tạo mới có dữ liệu và quota coach.',input:'TraineeId, days, locale vi/en.',steps:['Kiểm tra role coach và quyền trainee.','Backend tính findings kỳ hiện tại và kỳ liền trước: adherence, e1RM, cân nặng, intake, recovery, wearable.','Nếu tạo mới, lưu pending và gọi provider nhận findings đã tính.','Validate summary, sections, suggestions và ngôn ngữ; lưu completed.','Nếu đọc, trả bản đúng locale ưu tiên và stale theo fingerprint.'],post:'Báo cáo hỗ trợ quyết định; không tự sửa program/meals.',alt:'Sai quyền; NO_TRAINEE_DATA; sai language/output; quota/provider lỗi.',ac:'Không truy cập trainee ngoài quyền; thiếu log không bị coi là ăn đủ; GET không tốn provider token; data đổi báo stale.',source:'backend/src/services/coach-trainee-insight.service.ts',diagram:'sequence-coach-insight'},
 {n:13,name:'Ước tính dinh dưỡng món chưa có',actor:'Trainee',group:'nutrition',api:'POST /api/ai/food-nutrition',pre:'Người dùng chưa tìm thấy món; còn quota lookup.',input:'Query 2–120 ký tự, locale vi/en.',steps:['Trainee nhập tên món.','Provider ước tính serving, calories/macros và confidence.','Backend validate serving/khối lượng, macros và năng lượng Atwater.','Trả dữ liệu để prefill form custom food.','Trainee review và submit qua flow custom-food/admin review hiện có.'],post:'Kết quả ước tính chưa tự tạo Food trong lookup.',alt:'Input sai; output bất hợp lý; provider lỗi: từ chối, lượt lookup thất bại được release theo service.',ac:'Lookup không tạo row Food; UI cho người dùng review trước lưu; kết quả ghi rõ là ước tính.',source:'backend/src/services/ai/food-nutrition.ts',diagram:'sequence-food'},
 {n:14,name:'Ước tính vi chất món ăn nội bộ',actor:'Người vận hành dữ liệu',group:'ops',api:'CLI estimate:dish-nutrients [--all]',pre:'Có quyền chạy backend script, provider và file dữ liệu; không phải API end-user.',input:'Danh sách món Việt chưa có dữ liệu, hoặc --all để ước tính lại các row AI.',steps:['Script chọn món không có mapping/row USDA được bảo vệ.','Gọi provider ước tính công thức chuẩn và nutrients.','Validate giới hạn vi chất/100g và quan hệ nutrients.','Ghi source ai và sourceRef recipe vào file dữ liệu sau mỗi món.'],post:'File food-nutrients.data.json cập nhật, không ghi đè USDA.',alt:'Provider 429 retry có backoff, tối đa 4 attempts; dừng lỗi vẫn giữ các món đã checkpoint.',ac:'Row USDA không bị ghi đè; kết quả giữ provenance ai; khởi chạy không tạo meal người dùng.',source:'backend/src/scripts/estimate-dish-nutrients.ts',diagram:'sequence-ops'},
 {n:15,name:'Phân loại muscle profile bài tập nội bộ',actor:'Người vận hành dữ liệu',group:'ops',api:'CLI classify:exercise-muscles --dry-run hoặc --apply',pre:'Có quyền CLI/DB/provider; chọn đúng một mode; variation chưa có muscleProfileSource.',input:'Batch-size, limit, delay, report, resume-after và mode.',steps:['Đọc variations cần phân loại, bỏ mục đã có report khi dry-run.','Provider phân loại activity và muscle targets theo batch.','Validator kiểm tra các classification và ghi report/checkpoint.','Dry-run chỉ ghi report; apply ghi profile trong transaction với source ai và reviewedAt null.'],post:'Có report; chỉ mode apply cập nhật DB thành dữ liệu AI chưa review.',alt:'Output sai/variation thiếu được ghi failure; provider rate-limit theo classifier retry; cần review trước rollout.',ac:'Dry-run không update variation; apply giữ source ai và chưa reviewed; report hỗ trợ resume và phân biệt failure.',source:'backend/src/scripts/classify-exercise-muscles.ts',diagram:'sequence-muscles'}
];
const fr = c => 'FR-AI-' + String(c.n).padStart(2,'0');
const uc = c => 'UC-AI-' + String(c.n).padStart(2,'0');
const sources = [...new Set(cases.map(c=>c.source))];
write('requirements.json',JSON.stringify({version:'1.0',snapshot:'772cb878',date:'2026-10-05',status:'Mô tả hiện trạng theo mã nguồn; chưa nghiệm thu runtime',cases},null,2)+'\n');

// Keep the existing technical report as an appendix in the SAME .tex document.
const report = path.resolve(out,'../ai-features-report.tex');
const old = fs.readFileSync(report,'utf8');
const preamble = old.slice(0,old.indexOf('\\title{'));
const mark='% BEGIN TECHNICAL APPENDIX';
let appendix=old.includes(mark) ? old.split(mark)[1].split('\\end{document}')[0] : old.slice(old.indexOf('\\section{Tóm tắt điều hành}'),old.lastIndexOf('\\end{document}'));
appendix=appendix.replace('Các chức năng AI không ghi thẳng dữ liệu quan trọng nếu chưa qua bước xác nhận của người dùng;', 'Các luồng tạo program/meal cho người dùng yêu cầu xác nhận trước khi ghi dữ liệu nghiệp vụ; CLI nội bộ có thể ghi file hoặc DB theo mode được chọn;');
let srs = String.raw`\title{\textbf{SRS --- Các tính năng AI của YeahBuddy}}
\author{Hồ Minh Đức --- Lớp 24CT4}
\date{05/10/2026}
\begin{document}
\reportcover
\setcounter{page}{1}
\tableofcontents
\clearpage
\section{Mục đích, phạm vi và căn cứ}
Tài liệu đặc tả các yêu cầu AI hiện có của hệ thống để phục vụ phát triển, kiểm thử và đối chiếu sơ đồ. Baseline: repo \path{G:/fitness-app}, commit \code{772cb878}, ngày 05/10/2026. Các yêu cầu ký hiệu FR/BR/IR/NFR mô tả hiện trạng quan sát từ code; không đồng nghĩa đã nghiệm thu runtime. Các mục GAP là đề xuất cần quyết định, không được coi là đã triển khai.

Phạm vi gồm AI tập luyện, meal plan, chat/tool-call, insight dinh dưỡng, insight coach, food lookup và hai workflow AI nội bộ. Consume planned meals và coach meal review là chức năng nghiệp vụ nối tiếp AI, không gọi LLM. Ngoài phạm vi: đăng ký/đăng nhập tổng thể, tự huấn luyện model, vector RAG, triển khai production và các integration không trực tiếp gọi AI.

\section{Thuật ngữ và tác nhân}
\begin{description}
  \item[LLM/provider] Dịch vụ sinh text, JSON và tool-call; OpenAI-compatible hoặc Anthropic qua adapter.
  \item[Draft] Generation completed chưa accept; khác với Program hay Meal đã được lưu nghiệp vụ.
  \item[Catalog/context] Tập đối tượng được phép và dữ liệu được chọn để đưa vào prompt.
  \item[Fingerprint/stale] Dấu dữ liệu để báo nhận xét đã cũ; không phải chứng nhận tính đúng.
  \item[RIR/e1RM] Reps in reserve và ước lượng one-rep max; không phải chẩn đoán y tế.
  \item[Trainee] Tác nhân chính cho workout, meal, chat và insight cá nhân.
  \item[Coach] Quản lý trainee thuộc quyền, tạo/gán program, review planned meals và insight trainee.
  \item[Người vận hành dữ liệu] Chạy CLI bảo trì; không suy diễn mọi admin đều có quyền hệ điều hành.
  \item[Provider AI] Tác nhân hỗ trợ bên ngoài trong use case cần sinh nội dung; DB là thành phần nội bộ.
\end{description}
Các route AI chung yêu cầu profile xác thực nhưng không có role gate trainee trên toàn router; UI trainee và quyền service là hai lớp khác nhau. SRS không tuyên bố API đã chặn coach/admin cho mọi thao tác cá nhân. Coach routes kiểm tra role và quan hệ sở hữu trainee tại service.

\section{Quy tắc nghiệp vụ và giao diện chung}
\begin{description}
  \item[BR-AI-01] Sinh program/meal chỉ tạo draft; accept là request độc lập theo quyết định người dùng.
  \item[BR-AI-02] Draft phải đúng requester, type/mode và completed trước accept; kiểm tra catalog lại trong transaction.
  \item[BR-AI-03] Meal accept tạo planned; consume mới ghi consumed và tăng totals đã ăn.
  \item[BR-AI-04] Backend quyết định ID, totals, workload, findings và recommendation; LLM sinh/chọn/diễn giải trong khung đó.
  \item[BR-AI-05] Coach chỉ thao tác trainee thuộc quyền; program coach thuộc coach và được gán cho trainee.
  \item[BR-AI-06] Lịch ngày theo X-Timezone của request, mặc định Việt Nam; date-only dùng khóa UTC midnight.
  \item[BR-AI-07] Chat chỉ cho phép hai tool tạo draft, tối đa một draft thành công mỗi message; không tự accept.
  \item[BR-AI-08] Insight có thể stale hoặc locale khác bản yêu cầu; trả metadata để UI yêu cầu tạo lại.
  \item[BR-AI-09] CLI vi chất bảo vệ row USDA; CLI muscle dry-run không ghi DB, apply ghi dữ liệu AI chưa review.
  \item[IR-AI-01] API dùng envelope \code{\{data, error, meta\}}; frontend gọi qua lớp API/proxy. Endpoint chi tiết ở từng use case.
  \item[IR-AI-02] Input chịu schema bounds; provider text/JSON không phải dữ liệu đáng tin cho đến khi validator nhận.
  \item[IR-AI-03] Thiếu key trả AI\_NOT\_CONFIGURED (503); generation/type-specific errors và HTTP status phải bám code, không gom mọi lỗi vào một status.
\end{description}

\section{Yêu cầu chức năng và đặc tả use case}
Mỗi UC-AI-n tương ứng FR-AI-n và một sơ đồ sequence. Các bước dưới đây là hành vi yêu cầu theo hiện trạng; tiêu chí nghiệm thu là kịch bản cần kiểm thử, chưa đánh dấu đã pass.
`;
for(const c of cases){
 srs += `\n\\subsection{${uc(c)} --- ${tex(c.name)}}\n\\label{uc-ai-${c.n}}\n`;
 srs += `\\textbf{Yêu cầu ${fr(c)}:} Hệ thống phải hỗ trợ ${tex(c.name.toLowerCase())} với các kiểm tra và kết quả sau.\n\n`;
 srs += `\\begin{description}\n\\item[Tác nhân] ${tex(c.actor)}.\n\\item[Kích hoạt/API] \\path{${c.api}}\n\\item[Tiền điều kiện] ${tex(c.pre)}\n\\item[Dữ liệu vào] ${tex(c.input)}\n\\item[Hậu điều kiện] ${tex(c.post)}\n\\end{description}\n`;
 srs += `\\textbf{Luồng chính:}\n\\begin{enumerate}\n${c.steps.map(s=>'  \\item '+tex(s)).join('\n')}\n\\end{enumerate}\n`;
 srs += `\\textbf{Luồng thay thế/ngoại lệ:} ${tex(c.alt)}\n\n\\textbf{Tiêu chí nghiệm thu AC-AI-${String(c.n).padStart(2,'0')}:} ${tex(c.ac)}\n\n`;
 srs += `\\textbf{Nguồn đối chiếu:} \\evidence{${c.source}}. \\textbf{Sequence:} \\path{docs/ai-srs-diagrams/${c.diagram}.html}.\n`;
}
srs += String.raw`
\section{Dữ liệu và vòng đời}
\begin{description}
  \item[DR-AI-01] AIGeneration giữ userId, type, status, input, output, tokenUsage, errorMsg và programId khi phù hợp; insight giữ locale, fingerprint và promptVersion trong payload.
  \item[DR-AI-02] Types: workout\_program (program/daily), meal\_plan, nutrition\_insight, coach\_trainee\_insight. Trạng thái pending chuyển completed hoặc failed; completed có thể accepted/discarded tùy flow, không phải mọi type dùng mọi trạng thái.
  \item[DR-AI-03] Claim accept trong transaction, rollback khôi phục trạng thái nếu business write lỗi. Insight không có bước accept. Food lookup và chat reply không lưu như mọi generation.
  \item[DR-AI-04] Draft meal mới có thể discard draft cũ; discard giữ row quota. Insight provider 429 có nhánh xóa row; không nên giả định mọi generation thất bại đều giữ hoặc đều trả quota.
  \item[DR-AI-05] Dữ liệu context có thể gồm profile, notes, recovery, lịch sử và catalog gửi provider; chính sách retention/consent phải xác minh riêng tại deployment.
\end{description}

\section{Yêu cầu phi chức năng và giới hạn hiện trạng}
\begin{description}
  \item[NFR-AI-01 --- Validation] JSON hợp lệ cú pháp vẫn phải qua schema/catalog/workload. Helper có tối đa một repair khi validator trả AppError 422; không phải retry vô hạn mọi lỗi.
  \item[NFR-AI-02 --- Tính toàn vẹn] Accept không để lại business records ghi dở khi rollback; conditional claim bảo vệ cùng draft. Quota count-then-create chưa là reservation nguyên tử.
  \item[NFR-AI-03 --- Timeout] Mỗi provider request mặc định 60000 ms, cấu hình bằng AI\_REQUEST\_TIMEOUT\_MS; không coi đây là SLA toàn flow vì có repair/follow-up/SDK retry.
  \item[NFR-AI-04 --- Quota] Program/daily 5, meal plan 10, nutrition insight 10 theo user/ngày; coach insight 20 theo coach/ngày. Chat 40, chat program 3, chat meal 5, swap 20, lookup 30 theo counter instance/ngày. Tool draft còn chịu quota generation chung.
  \item[NFR-AI-05 --- Middleware] AI router áp limiter 30 request/giờ cho đoạn sau middleware, kể cả accept; GET insight và đọc/discard meal draft nằm trước. Development bỏ qua limiter; coach insight route riêng chưa gắn aiLimiter.
  \item[NFR-AI-06 --- Ngôn ngữ] Insight hỗ trợ vi/en và heuristic kiểm tra ngôn ngữ. Không suy diễn mọi chat/program đã có cùng locale contract.
  \item[NFR-AI-07 --- Truy vết] Generation lưu tokenUsage và payload phù hợp; promptVersion cho các flow có hỗ trợ. Đây chưa là bảng chi phí hay audit toàn bộ hội thoại.
  \item[NFR-AI-08 --- An toàn] Prompt có quy tắc tránh chẩn đoán/thuốc và red flags; sanitize input và allowlist tools là defense in depth. Chưa có chứng cứ đảm bảo mọi output y tế được kiểm duyệt bằng validator ngữ nghĩa.
\end{description}

\section{Yêu cầu đề xuất chưa được coi là đã triển khai}
\begin{description}
  \item[GAP-AI-01] Quota dùng shared store/reservation nguyên tử khi scale nhiều instance; mức tải và SLA cần thống nhất trước thiết kế.
  \item[GAP-AI-02] Chốt consent, dữ liệu tối thiểu gửi provider, retention, log redaction và quy trình xóa dữ liệu.
  \item[GAP-AI-03] Quyết định role gate cho API AI chung thay vì suy diễn từ visibility UI.
  \item[GAP-AI-04] Đánh giá output bằng bộ fixture về chấn thương, an toàn, ngôn ngữ, prompt injection và tính đúng số liệu; định nghĩa ngưỡng pass trước nghiệm thu.
  \item[GAP-AI-05] Theo dõi latency/token/cost/provider failure có dashboard và ngưỡng cảnh báo; không tự đặt một SLA chưa được đồng ý.
\end{description}

\section{Ma trận truy vết và kế hoạch nghiệm thu}
\begin{longtable}{p{0.16\linewidth}p{0.16\linewidth}p{0.50\linewidth}}
\toprule
\textbf{Requirement} & \textbf{Use case} & \textbf{Sequence / tiêu chí} \\
\midrule
\endhead
`;
for(const c of cases) srs+=`${fr(c)} & ${uc(c)} & \\path{${c.diagram}}; AC-AI-${String(c.n).padStart(2,'0')} \\\\\n`;
srs+=String.raw`\bottomrule
\end{longtable}
\begin{enumerate}
  \item Rà các yêu cầu với code/fixtures: quyền, schema, output invalid, generation lifecycle, catalog đổi và concurrency accept.
  \item Chạy test hiện có phù hợp từng use case; không dùng việc render sơ đồ làm bằng chứng nghiệp vụ pass.
  \item Provider smoke test trong môi trường riêng: JSON/tools, locale, timeout và quota; ghi model/config mà không ghi secret.
  \item Browser kiểm tra form, preview, draft restore, planned/consumed, coach panel và stale indicator.
  \item Compile SRS và kiểm tra typography; kiểm tra use case/sequence khớp IDs, actors và nhánh ngoại lệ.
\end{enumerate}
Trạng thái: code review đã thực hiện; live provider, production, E2E/browser ứng dụng và nghiệm thu các AC chưa thực hiện. Compiler tích hợp từng báo lỗi môi trường trước khi compile tài liệu; trạng thái lần kiểm tra cuối phải ghi trong README bàn giao.

\section{Chỉ dẫn đọc sơ đồ}
Trang tổng hợp: \path{docs/ai-srs-diagrams/index.html}. Use case UML chia theo nhóm để giữ rõ tác nhân và system boundary. Provider chỉ nối các UC thực sự gọi LLM; consume/review/accept không nối provider. Không dùng include/extend để diễn tả tạo draft rồi accept vì đó là hai request độc lập. CLI nội bộ nằm trong boundary riêng.

Sequence HTML mô tả đường chính; file Mermaid .mmd và đặc tả UC đi kèm thể hiện ngoại lệ với các nhánh alt/opt để chỉnh sửa và review chi tiết. Lifeline API gộp route/service, lifeline UI gộp actor/giao diện; xác thực Supabase được mô tả như tiền điều kiện và profile check, không vẽ DB tự quyết quyền. Viewer HTML Archify có các nút tiếng Anh, nội dung domain bằng tiếng Việt.

\clearpage
\appendix
`;
fs.writeFileSync(report,preamble+srs+mark+'\n'+appendix+'\n\\end{document}\n','utf8');

const p=[{id:'ui',type:'frontend',label:'Người dùng / UI'},{id:'api',type:'backend',label:'API + service'},{id:'db',type:'database',label:'Prisma / DB'},{id:'llm',type:'external',label:'Provider AI'}];
const seqs = {
 'sequence-program': [['ui','api','POST generate-program'],['api','db','Profile, quota, catalog'],['db','api','Bài tập và context','return'],['api','db','Generation pending'],['api','llm','Prompt + catalog refs'],['llm','api','JSON + tokenUsage','return'],['api','db','Validate; completed'],['api','ui','201 · draft + generationId','return']],
 'sequence-daily': [['ui','api','POST generate-workout'],['api','db','Quota và catalog theo ngày'],['db','api','Context + equipment','return'],['api','db','Pending; mode daily'],['api','llm','Ngày + energy + catalog'],['llm','api','JSON một buổi tập','return'],['api','db','Validate; completed daily'],['api','ui','201 · preview buổi tập','return']],
 'sequence-accept': [['ui','api','POST accept-program/workout'],['api','db','Đọc draft đúng chủ/mode'],['db','api','Generation completed','return'],['api','db','Transaction: claim draft'],['api','db','Revalidate variations'],['api','db','Program + assignment + sets'],['db','api','Commit accepted','return'],['api','ui','200 · programId','return']],
 'sequence-coach-program': [['ui','api','Coach chọn trainee; generate'],['api','db','Role + sở hữu trainee'],['db','api','Profile và catalog','return'],['api','llm','Sinh program cho trainee'],['llm','api','JSON program','return'],['api','db','Lưu draft coachGenerated'],['api','ui','Preview draft','return'],['ui','api','Accept riêng; traineeId'],['api','db','Claim; tạo/gán program'],['api','ui','Program coach → trainee','return']],
 'sequence-meal': [['ui','api','POST generate-meal-plan'],['api','db','Goals, consumed, catalog'],['db','api','Bữa và targets còn lại','return'],['api','db','Tạo pending'],['api','llm','Ngày + food IDs'],['llm','api','JSON meal plan','return'],['api','db','Validate; lưu draft mới'],['api','ui','201 · draft + shopping list','return']],
 'sequence-draft': [['ui','api','GET meal-plan-draft'],['api','db','Draft completed mới nhất'],['api','ui','Preview draft','return'],['ui','api','POST regenerate một bữa'],['api','db','Check owner/status + foods'],['api','llm','Mục tiêu bữa còn lại'],['llm','api','JSON bữa thay thế','return'],['api','db','Validate; update có điều kiện'],['api','ui','Draft cập nhật hoặc 409','return']],
 'sequence-meal-accept': [['ui','api','POST accept-meal-plan'],['api','db','Đọc draft + kiểm override'],['db','api','Completed đúng chủ','return'],['api','db','Transaction: claim'],['api','db','Revalidate foods + portions'],['api','db','Thay planned của ngày plan'],['db','api','Commit accepted','return'],['api','ui','200 · planned, chưa consumed','return']],
 'sequence-consume': [['ui','api','POST plans/consume'],['api','db','Đọc planned đúng chủ'],['db','api','Planned items','return'],['api','db','Transaction: ghi consumed'],['api','db','Xóa planned; tính totals'],['db','api','Commit','return'],['api','ui','200 · nhật ký đã ăn','return']],
 'sequence-review': [['ui','api','Coach GET meal-plans'],['api','db','Check coach–trainee'],['db','api','Planned meals','return'],['api','ui','Bữa dự kiến','return'],['ui','api','PATCH/DELETE item'],['api','db','Check planned; cập nhật'],['ui','api','POST review + note'],['api','db','Lưu review + notification'],['api','ui','200 · review đã lưu','return']],
 'sequence-chat': [['ui','api','POST chat + history'],['api','db','Profile + context theo intent'],['db','api','Context + recommendation','return'],['api','llm','Chat + hai tool cho phép'],['llm','api','Text hoặc tool-call','return'],['api','db','Tool: pending + catalog'],['api','llm','Sinh draft qua service'],['llm','api','JSON draft','return'],['api','db','Validate; lưu completed'],['api','llm','Tool result; follow-up'],['api','ui','Reply + action draft','return']],
 'sequence-insight': [['ui','api','POST nutrition-insight'],['api','db','Intake + goals + foods'],['db','api','Dữ liệu ngày / 7 ngày','return'],['api','db','Findings; pending'],['api','llm','Findings + candidate foods'],['llm','api','Nhận xét + food IDs','return'],['api','db','Validate; lưu insight'],['api','ui','Insight + locale + stale','return']],
 'sequence-coach-insight': [['ui','api','POST trainee ai-insight'],['api','db','Check quyền; hai kỳ dữ liệu'],['db','api','Logs + meals + recovery','return'],['api','db','Findings; pending của coach'],['api','llm','Stats đã tính + signals'],['llm','api','Summary + sections','return'],['api','db','Validate; lưu fingerprint'],['api','ui','Insight; không sửa program','return']],
 'sequence-food': [['ui','api','POST food-nutrition'],['api','llm','Tên món + locale'],['llm','api','Serving, macros, confidence','return'],['api','ui','Validate; prefill form','return'],['ui','api','Submit custom food riêng'],['api','db','Flow review food hiện có'],['api','ui','Kết quả submit','return']],
 'sequence-ops': [['ui','api','CLI estimate:dish-nutrients'],['api','db','Đọc file; lọc row USDA'],['db','api','Món cần ước tính','return'],['api','llm','Công thức + vi chất'],['llm','api','Nutrients + recipe','return'],['api','db','Validate; checkpoint file'],['api','ui','Report; source ai','return']],
 'sequence-muscles': [['ui','api','CLI dry-run hoặc apply'],['api','db','Variation chưa có source'],['db','api','Tên bài + equipment','return'],['api','llm','Phân loại batch'],['llm','api','Muscles + activity','return'],['api','db','Validate; report checkpoint'],['api','db','Chỉ apply: transaction DB'],['api','ui','Report AI chưa reviewed','return']]
};
for(const c of cases){
 let parts=p.map(x=>({...x}));
 if(['sequence-accept','sequence-meal-accept','sequence-consume','sequence-review'].includes(c.diagram)) parts=parts.filter(x=>x.id!=='llm');
 if(c.group==='ops'){parts[0].label='Người vận hành';parts[1].label='CLI + validator';if(c.n===14)parts[2].label='File nutrients';}
 const steps=seqs[c.diagram];
 const height= Math.max(650,220+steps.length*50);
 const spec={schema_version:1,diagram_type:'sequence',meta:{title:uc(c)+' · '+c.name,quality_profile:'showcase',column_fit:'spread',viewBox:[1600,height]},participants:parts,messages:steps.map((m,i)=>({id:'m'+(i+1),from:m[0],to:m[1],y:180+i*50,label:m[2],...(m[3]?{variant:m[3]}:{})}))};
 write(c.diagram+'.json',JSON.stringify(spec,null,2)+'\n');
 // Editable UML sequence source with true alt/opt fragments.
 let mm='sequenceDiagram\n  autonumber\n'+parts.map(x=>`  participant ${x.id} as ${x.label}`).join('\n')+'\n';
 mm+='  Note over ui,api: '+uc(c)+' / '+fr(c)+' — profile xác thực; quyền ở service\n';
 mm+='  alt Tiền điều kiện và input hợp lệ\n';
 for(const m of steps){
   mm+=`    ${m[0]}${m[3]==='return'?'-->>':'->>'}${m[1]}: ${m[2]}\n`;
   if(m[0]==='llm'&&m[1]==='api'&&![10,14,15].includes(c.n))mm+='    opt Validator AppError 422 ở lần đầu\n      api->>llm: Một repair với feedback\n      llm-->>api: Output sửa, vẫn phải validate trước lưu\n    end\n';
 }
 mm+='  else Sai quyền/input/quota hoặc lỗi khi xử lý\n    api-->>ui: Lỗi; không ghi nghiệp vụ dở dang\n  end\n';
 if(c.n===6) mm+='  opt Người dùng bỏ draft thay vì đổi bữa\n    ui->>api: POST discard-meal-plan\n    api->>db: completed thành discarded; giữ row quota\n    api-->>ui: Kết quả discard; không gọi provider\n  end\n';
 if([11,12].includes(c.n))mm+='  opt Đọc báo cáo đã lưu\n    ui->>api: GET insight\n    api->>db: Bản đúng chủ, locale và cửa sổ\n    api-->>ui: Insight + stale; không gọi provider\n  end\n';
 if(c.n===10)mm+='  Note over api,llm: Context lỗi: prompt chung. Follow-up lỗi: giữ draft action.\n';
 write(c.diagram+'.mmd',mm);
}

// Actual UML use-case ellipses, actor associations and explicit system boundaries.
// No include/extend links are used to confuse temporal draft/accept requests.
const groups=[['training','Trainee · tập luyện'],['nutrition','Trainee · dinh dưỡng'],['chat','Trainee · hội thoại'],['coach','Coach · trainee thuộc quyền'],['ops','CLI · bảo trì dữ liệu']];
let uml='@startuml\nleft to right direction\nskinparam defaultFontName SansSerif\n';
uml+='actor Trainee as T\nactor Coach as C\nactor "Người vận hành dữ liệu" as O\nactor "Provider AI" as P\nrectangle "YeahBuddy — phân hệ AI và nghiệp vụ nối tiếp" {\n';
for(const c of cases.filter(c=>c.group!=='ops'))uml+=`  usecase "${uc(c)}\\n${c.name}" as U${c.n}\n`;
uml+='}\nrectangle "Workflow AI nội bộ (CLI)" {\n';
for(const c of cases.filter(c=>c.group==='ops'))uml+=`  usecase "${uc(c)}\\n${c.name}" as U${c.n}\n`;
uml+='}\n';
for(const c of cases){uml+=`${c.actor==='Coach'?'C':c.group==='ops'?'O':'T'} -- U${c.n}\n`;if(![3,8,9].includes(c.n))uml+=`P -- U${c.n}\n`;}
uml+='note bottom\nAccept/consume/review không gọi LLM.\nUC-AI-06 và UC-AI-11/12 chỉ gọi provider ở nhánh generate/swap.\nCLI không phải màn hình admin end-user.\nend note\n@enduml\n';
write('use-cases.puml',uml);
let sections='';
for(const [key,title] of groups){
 const list=cases.filter(c=>c.group===key),h=Math.max(450,170+list.length*112);
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1140 ${h}" role="img" aria-labelledby="title-${key}"><title id="title-${key}">${esc(title)}</title><style>text{font-family:Arial,sans-serif;fill:#172554} .edge{fill:none;stroke:#64748b;stroke-width:1.6} .uc{fill:#eff6ff;stroke:#2563eb;stroke-width:1.5}</style><rect x="205" y="35" width="730" height="${h-65}" rx="8" fill="#fff" stroke="#475569"/><text x="225" y="64" font-size="18" font-weight="bold">${esc(key==='ops'?'Workflow AI nội bộ (CLI)':'YeahBuddy — '+title)}</text>`;
 const actorY=h/2;function actor(x,y,label){return `<circle cx="${x}" cy="${y-45}" r="13" fill="none" stroke="#334155" stroke-width="2"/><path d="M${x},${y-32}v42m-25,-27h50m-25,27l-23,30m23,-30l23,30" class="edge"/><text x="${x}" y="${y+60}" text-anchor="middle" font-size="17">${esc(label)}</text>`;}
 svg+=actor(95,actorY,key==='coach'?'Coach':key==='ops'?'Vận hành':'Trainee');
 const withLLM=list.some(c=>![3,8,9].includes(c.n));if(withLLM)svg+=actor(1050,actorY,'Provider AI');
 list.forEach((c,i)=>{const y=115+i*112;svg+=`<path d="M125,${actorY} L185,${y} L340,${y}" class="edge"/>`;if(![3,8,9].includes(c.n))svg+=`<path d="M1020,${actorY} L955,${y} L800,${y}" class="edge"/>`;svg+=`<ellipse cx="570" cy="${y}" rx="230" ry="43" class="uc"/><text x="570" y="${y-9}" text-anchor="middle" font-size="16" font-weight="bold">${uc(c)} / ${fr(c)}</text><text x="570" y="${y+15}" text-anchor="middle" font-size="16">${esc(c.name)}</text>`;});
 svg+='</svg>';
 write('use-case-'+key+'.svg',svg);
 sections+=`<section id="${key}"><h2>${esc(title)}</h2>${svg}<p>Đường nối là association UML. Provider tham gia UC đọc/swap/insight chỉ ở nhánh sinh mới; accept, consume và review không gọi LLM.</p></section>`;
}
write('use-cases.html',`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Use case AI — SRS</title><style>body{margin:0;background:#f1f5f9;color:#172554;font:16px/1.6 Arial}main{max-width:1140px;margin:auto;padding:24px}nav{display:flex;gap:15px;flex-wrap:wrap}a{color:#1d4ed8}section{background:white;border-radius:12px;padding:18px;margin:24px 0}svg{width:100%;height:auto}h1{font-size:28px}p{color:#475569}</style><main><a href="index.html">← Bộ sơ đồ SRS</a><h1>Use case AI của YeahBuddy</h1><p>Baseline 772cb878 · 15 use case · yêu cầu hiện trạng, chưa nghiệm thu runtime.</p><nav>${groups.map(([k,t])=>`<a href="#${k}">${t}</a>`).join('')}</nav>${sections}</main></html>`);
write('index.html',`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SRS AI — sơ đồ và truy vết</title><style>body{background:#f1f5f9;color:#172554;font:16px/1.6 Arial;margin:0}main{max-width:1120px;margin:auto;padding:30px}a{color:#1d4ed8}table{border-collapse:collapse;background:white;width:100%}td,th{padding:12px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#dbeafe}code{font-size:14px}.box{background:white;padding:20px;border-radius:10px;margin-bottom:20px}</style><main><h1>SRS AI · YeahBuddy</h1><div class="box"><p>Baseline <code>772cb878</code> · 05/10/2026. Một SRS LaTeX chính: <a href="../ai-features-report.tex">ai-features-report.tex</a>.</p><p><a href="use-cases.html">Mở sơ đồ use case UML</a> · <a href="use-cases.puml">Nguồn PlantUML</a> · <a href="requirements.json">Danh mục yêu cầu</a></p><p>HTML sequence là đường chính; source Mermaid chứa alt/opt. Cards ghi lỗi và điều kiện nghiệm thu. Actor/UI và route/service được gộp để dễ đọc. Sơ đồ không chứng minh provider hay ứng dụng đã chạy thành công.</p></div><table><thead><tr><th>UC / FR</th><th>Chức năng</th><th>Tác nhân</th><th>Sequence</th></tr></thead><tbody>${cases.map(c=>`<tr><td>${uc(c)}<br>${fr(c)}</td><td>${esc(c.name)}</td><td>${esc(c.actor)}</td><td><a href="${c.diagram}.html">Xem</a> · <a href="${c.diagram}.mmd">Mermaid</a></td></tr>`).join('')}</tbody></table></main></html>`);
write('README.md',`# SRS AI và sơ đồ\n\nSRS chính: [ai-features-report.tex](../ai-features-report.tex). Baseline code: \`772cb878\`, 05/10/2026.\n\nMở [index.html](index.html) để xem 15 sequence và use case UML chia 5 nhóm. \`requirements.json\` chứa đặc tả có mã UC/FR/AC; source PlantUML và Mermaid dùng để chỉnh sửa.\n\n## Phạm vi\n\nTrainee, coach và CLI vận hành; provider là actor hỗ trợ. Accept/consume/review không gọi LLM. UC-06 và UC-11/12 có nhánh đọc không gọi provider. DB không phải actor use case. API AI chung chưa chặn riêng role trainee ở toàn router.\n\nHTML Archify thể hiện happy path; cards mô tả ngoại lệ. Mermaid thể hiện alt/opt. Sơ đồ lifecycle chi tiết nằm trong SRS; không suy diễn mọi generation type đều accept/discard.\n\n## Tái tạo\n\nTừ repo root: \`node docs/ai-srs-diagrams/build.cjs\`. Chỉ sinh tài liệu, không gọi provider/DB. Sau đó chạy Archify validate/deliver cho từng sequence JSON; không coi JSON mới là HTML đã validate.\n\n## Trạng thái kiểm tra\n\nChưa nghiệm thu các AC, chưa gọi live provider hay kiểm tra production. Compiler LaTeX tích hợp cần kiểm tra riêng. Validation/render/browser receipts được ghi sau khi chạy thực tế.\n`);
console.log('Generated SRS, 15 sequence specs/sources, UML use-case views and index.');
