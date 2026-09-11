const fs = require('fs');
const path = require('path');
const out = __dirname;
const participants = [
  {id:'ui',type:'frontend',label:'Người dùng / UI',sublabel:'Next.js'},
  {id:'api',type:'backend',label:'API và AI Service',sublabel:'Express'},
  {id:'db',type:'database',label:'Database',sublabel:'Qua Prisma'},
  {id:'llm',type:'external',label:'Nhà cung cấp AI',sublabel:'Anthropic / OpenAI-compatible'},
];
function seq(file,title,rows,cards){
 fs.writeFileSync(path.join(out,file+'.notes.json'),JSON.stringify(cards,null,2)+'\n');
 if(rows.length>9){
   seq(file+'-accept',title.replace('Tạo và lưu','Lưu').replace('Gợi ý và ghi nhận','Ghi nhận'),rows.slice(9),[]);
   rows=rows.slice(0,9);
   title=title.replace('Tạo và lưu','Tạo').replace('Gợi ý và ghi nhận','Gợi ý');
 }
 const spec={schema_version:1,diagram_type:'sequence',meta:{title,quality_profile:'showcase',column_fit:'spread',viewBox:[1040,510]},participants:rows.some(r=>r[0]==='llm'||r[1]==='llm')?participants:participants.slice(0,3),
 messages:rows.map(([from,to,label,variant='default'],i)=>({id:`m${i+1}`,from,to,label,variant,y:170+i*32}))};
 fs.writeFileSync(path.join(out,file+'.json'),JSON.stringify(spec,null,2)+'\n');
}
seq('sequence-workout','AI · Tạo và lưu chương trình tập',[
 ['ui','api','Yêu cầu tạo lịch + access token','emphasis'],
 ['api','db','Xác thực profile; đếm quota'],
 ['db','api','Profile hợp lệ; chưa đủ 5 lần/ngày','return'],
 ['api','db','Đọc bài tập + log; tạo pending'],
 ['db','api','Catalog và số buổi 30 ngày','return'],
 ['api','llm','Prompt mục tiêu + catalog','emphasis'],
 ['llm','api','JSON lịch tuần đầu + token usage','return'],
 ['api','db','Ghép bài đạt ≥70%: completed'],
 ['api','ui','201: bản xem trước + generationId','return'],
 ['ui','api','Xác nhận lưu + generationId','emphasis'],
 ['api','db','Xác thực; đọc chủ sở hữu và trạng thái'],
 ['db','api','Generation của user, completed','return'],
 ['api','db','Transaction: tạo chương trình và bài'],
 ['db','api','Gán cho user; accepted; commit','return'],
 ['api','ui','200: chương trình → /workout','return'],
],[{dot:'cyan',title:'API',items:['POST /api/ai/generate-program','POST /api/ai/accept-program']},{dot:'rose',title:'Nhánh lỗi',items:['Hết quota → 429; tỷ lệ ghép <70% → failed, 422.','Lỗi provider/parse → failed, 500; không lưu chương trình.']},{dot:'amber',title:'Giới hạn hiện tại',items:['Chỉ sinh tuần đầu; chưa có tăng tải từng tuần.','Kiểm tra completed nằm ngoài transaction; có nguy cơ lưu trùng.']}]);
seq('sequence-meals','AI · Gợi ý và ghi nhận thực đơn',[
 ['ui','api','Ngày + sở thích + access token','emphasis'],
 ['api','db','Xác thực profile; đếm quota'],
 ['db','api','Profile hợp lệ; chưa đủ 10 lần/ngày','return'],
 ['api','db','Đọc foods, bữa gần đây; tạo pending'],
 ['db','api','Catalog + món trong 7 ngày','return'],
 ['api','llm','Prompt mục tiêu + thực phẩm','emphasis'],
 ['llm','api','JSON 4 bữa + tổng dinh dưỡng','return'],
 ['api','db','Ghép món; bỏ món lạ; completed'],
 ['api','ui','201: xem trước; tổng do AI trả','return'],
 ['ui','api','Xác nhận generationId + ngày','emphasis'],
 ['api','db','Xác thực; đọc chủ sở hữu và trạng thái'],
 ['db','api','Generation của user, completed','return'],
 ['api','db','Lặp: addMealItemForUser'],
 ['api','db','Đánh dấu accepted sau vòng lặp'],
 ['api','ui','200: accepted=true; tải lại bữa ăn','return'],
],[{dot:'cyan',title:'API',items:['POST /api/ai/generate-meal-plan','POST /api/ai/accept-meal-plan']},{dot:'rose',title:'Nhánh lỗi hiện tại',items:['Lỗi tạo AI → failed, 500; hết quota → 429.','Lỗi từng món khi lưu bị bỏ qua; vẫn trả accepted=true.']},{dot:'amber',title:'Ý nghĩa nghiệp vụ',items:['Xác nhận thêm thẳng món vào nhật ký ăn uống.','Preview lấy tổng từ AI; lúc lưu tính khẩu phần qua nutrition service.']}]);
seq('sequence-chat','AI · Chat với dữ liệu cá nhân',[
 ['ui','api','Câu hỏi + history + access token','emphasis'],
 ['api','db','Xác thực và lấy profile'],
 ['db','api','Thông tin người dùng','return'],
 ['api','db','Sau kiểm tra input/quota: đọc ngữ cảnh'],
 ['db','api','Cân nặng; bữa ăn; log; sets','return'],
 ['api','llm','Prompt + ngữ cảnh + 6 tin gần nhất','emphasis'],
 ['llm','api','Nội dung trả lời','return'],
 ['api','ui','200: reply; hiển thị trong chat','return'],
],[{dot:'cyan',title:'API và dữ liệu',items:['POST /api/ai/chat; giới hạn câu hỏi 2.000 ký tự.','Không ghi AIGeneration; hội thoại chỉ ở state giao diện.']},{dot:'amber',title:'Quota và fallback',items:['40 tin/ngày/user trong RAM; restart sẽ mất bộ đếm.','Đọc ngữ cảnh lỗi → vẫn gọi AI với thông tin profile.']},{dot:'rose',title:'Phạm vi',items:['Chỉ hỏi đáp; không tự tạo/sửa lịch hoặc thực đơn.','Chat bubble chỉ hiện cho trainee; API kiểm tra đăng nhập.']}]);


