const fs=require('fs');const path=require('path');
const cases=[['UC-AI-01','Tạo chương trình tập',180,true],['UC-AI-02','Lưu chương trình đã tạo',280,false],['UC-AI-03','Gợi ý thực đơn một ngày',380,true],['UC-AI-04','Ghi thực đơn vào nhật ký',480,false],['UC-AI-05','Chat AI Coach',580,true]];
const text=(x,y,t,size=18)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="#dce8f5">${t}</text>`;
function actor(x,y,label){return `<g stroke="#9fbbd6" stroke-width="2" fill="none"><circle cx="${x}" cy="${y-52}" r="16"/><path d="M${x} ${y-36}v48m-32-30h64m-32 30l-26 36m26-36l26 36"/></g>${text(x,y+78,label)}`;}
const edges=cases.map(([, ,y,ai])=>`<path d="M182 380 L480 ${y}"/>${ai?`<path d="M800 ${y} L1090 380"/>`:''}`).join('');
const nodes=cases.map(([id,label,y])=>`<ellipse cx="640" cy="${y}" rx="160" ry="37" fill="#102a40" stroke="#54c8be" stroke-width="1.5"/>${text(640,y-7,id,13)}${text(640,y+17,label,18)}`).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="760" viewBox="0 0 1280 760" role="img" aria-labelledby="title desc"><title id="title">Use case AI — Fitness App</title><desc id="desc">Người dùng đã đăng nhập thực hiện năm use case. Nhà cung cấp AI hỗ trợ tạo chương trình, gợi ý thực đơn và chat. Hai use case lưu chỉ sử dụng kết quả đã tạo.</desc><rect width="1280" height="760" rx="20" fill="#081521"/>${text(640,52,'USE CASE · CHỨC NĂNG AI',26)}<rect x="330" y="95" width="620" height="555" rx="4" stroke="#6385a0" fill="none"/>${text(640,122,'Fitness App — phân hệ AI',17)}<g stroke="#65869d" stroke-width="1.5" fill="none">${edges}</g>${nodes}${actor(150,380,'Người dùng')}${text(150,482,'đã đăng nhập',15)}${actor(1122,380,'Nhà cung cấp AI')}${text(1122,482,'Anthropic / API',14)}${text(1122,504,'tương thích OpenAI',14)}${text(640,693,'UC-AI-02 / 04: kết quả phải thuộc người dùng và có trạng thái completed.',16)}${text(640,722,'Chat bubble hiện cho trainee; các API AI hiện chỉ kiểm tra đăng nhập.',16)}</svg>`;
fs.writeFileSync(path.join(__dirname,'usecase-ai.svg'),svg);
fs.writeFileSync(path.join(__dirname,'usecase-ai.html'),`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Use case AI — Fitness App</title><style>body{margin:0;background:#081521;color:#dce8f5;font-family:system-ui,sans-serif;min-height:100vh;display:grid;place-items:center}main{width:min(96vw,1450px)}svg{display:block;width:100%;height:auto}a{color:#65d6cc}nav{padding:8px;text-align:center}</style><main>${svg}<nav><a href="index.html">Tất cả sơ đồ</a> · <a href="usecase-ai.svg" download>Tải SVG</a> · <a href="usecase-ai.puml" download>Nguồn PlantUML</a></nav></main></html>`);
fs.writeFileSync(path.join(__dirname,'usecase-ai.puml'),`@startuml
left to right direction
skinparam shadowing false
actor "Người dùng đã đăng nhập" as User
actor "Nhà cung cấp AI" as Provider
rectangle "Fitness App — phân hệ AI" {
usecase "UC-AI-01\nTạo chương trình tập" as GenerateProgram
usecase "UC-AI-02\nLưu chương trình đã tạo" as AcceptProgram
usecase "UC-AI-03\nGợi ý thực đơn một ngày" as GenerateMeal
usecase "UC-AI-04\nGhi thực đơn vào nhật ký" as AcceptMeal
usecase "UC-AI-05\nChat AI Coach" as Chat
}
User -- GenerateProgram
User -- AcceptProgram
User -- GenerateMeal
User -- AcceptMeal
User -- Chat
GenerateProgram -- Provider
GenerateMeal -- Provider
Chat -- Provider
note bottom of AcceptProgram
Tiền điều kiện: generation thuộc user,
trạng thái completed.
end note
note bottom of AcceptMeal
Tiền điều kiện: generation thuộc user,
trạng thái completed.
end note
note bottom of User
API chỉ kiểm tra đăng nhập.
Chat bubble chỉ hiện cho trainee.
end note
@enduml
`);
fs.writeFileSync(path.join(__dirname,'index.html'),`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sơ đồ AI — Fitness App</title><style>body{background:#091522;color:#e0eaf4;font:18px/1.6 system-ui;margin:0}main{max-width:880px;margin:8vh auto;padding:24px}h1{font-size:40px}a{display:block;padding:20px;margin:16px 0;background:#14283b;border:1px solid #2b5267;border-radius:12px;color:#78e2ce;text-decoration:none}p{color:#aac0d2}</style><main><p>FITNESS APP · TÀI LIỆU KỸ THUẬT</p><h1>Sơ đồ luồng AI</h1><p>Phản ánh mã nguồn ngày 08/09/2026. Các điểm cần cải thiện nằm trong ghi chú, không được mô tả như chức năng đã có.</p><a href="usecase-ai.html">01 · Use case tổng thể — 5 chức năng AI</a><a href="sequence-workout.html">02 · Sequence — tạo và lưu chương trình tập</a><a href="sequence-meals.html">03 · Sequence — gợi ý và ghi nhận thực đơn</a><a href="sequence-chat.html">04 · Sequence — chat với dữ liệu cá nhân</a><p>Sequence được dựng bằng Archify. Use case dùng SVG UML và có nguồn PlantUML vì Archify chưa hỗ trợ loại sơ đồ này. Nội dung tiếng Việt; UI cố định của Archify và html lang dùng tiếng Anh.</p></main></html>`);
