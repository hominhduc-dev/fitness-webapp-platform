const fs = require('node:fs');
const path = require('node:path');
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const file = path.resolve(__dirname, '../docs/fitness-platform-diagram.drawio');
const msg = (a,b,label,reply=false) => ({ type:'message', a,b,label,reply });
const self = (a,label) => msg(a,a,label);
const open = (kind,label) => ({type:'open',kind,label});
const branch = label => ({type:'branch',label});
const close = () => ({type:'close'});
const base = [['user','Trainee / Coach'],['ui','Giao diện Next.js'],['api','Express API'],['service','AI Service'],['db','PostgreSQL / Prisma'],['llm','LLM Provider']];
const specs = [
  { code:'AI-UC02', title:'Cá nhân hóa chương trình tập luyện', participants:base,
    note:'Đã đăng nhập. Coach chỉ tạo cho học viên thuộc mình; generation thuộc coach, còn lịch sử và người được gán giáo án là học viên. Không tự áp dụng khi mới tạo bản nháp.',
    events:[
      msg('user','ui','Nhập mục tiêu, lịch và thiết bị'),msg('ui','api','Yêu cầu tạo chương trình AI'),msg('api','service','Xác thực; chuyển yêu cầu'),
      msg('service','db','Kiểm tra quyền, quota; đọc catalog, lịch sử và phục hồi'),msg('db','service','Dữ liệu trong phạm vi được phép',true),self('service','Chọn catalog; dựng prompt và variationRef'),
      msg('service','db','Tạo AIGeneration: pending'),msg('service','llm','Sinh JSON chương trình'),msg('llm','service','JSON và token usage',true),self('service','Chuẩn hóa; kiểm tra ràng buộc; ánh xạ variationRef'),
      open('alt','[JSON và ràng buộc hợp lệ]'),msg('service','db','Lưu raw / mapped; completed'),msg('service','api','generationId và bản nháp',true),msg('api','ui','Trả bản nháp để xem trước',true),
      branch('[LLM lỗi hoặc kết quả không hợp lệ]'),msg('service','db','Đánh dấu generation failed'),msg('service','api','Lỗi tạo chương trình',true),msg('api','ui','Hiển thị lỗi; chưa tạo giáo án',true),close(),
      open('opt','[Có bản nháp hợp lệ; người dùng xác nhận]'),msg('user','ui','Chấp nhận chương trình'),msg('ui','api','Yêu cầu accept(generationId)'),msg('api','service','Xác nhận cho đúng người được gán'),msg('service','db','Đọc generation; kiểm tra owner, type, status và subject'),
      open('alt','[Generation và catalog còn hợp lệ]'),msg('service','db','Transaction: claimGeneration; kiểm tra lại bài tập; tạo Program, Assignment, Workout, Exercise, Set; accepted'),msg('db','service','Commit; programId',true),msg('service','api','Giáo án đã tạo và gán',true),msg('api','ui','Hiển thị chương trình sử dụng',true),
      branch('[Đã accept, sai quyền hoặc catalog thay đổi]'),msg('service','api','Từ chối / rollback; không lưu một phần',true),msg('api','ui','Thông báo lỗi xác nhận',true),close(),close(),
    ] },
  { code:'AI-UC04', title:'Cá nhân hóa kế hoạch dinh dưỡng', participants:base.map(p=>p[0]==='user'?['user','Trainee']:p),
    note:'Backend tính dinh dưỡng và khẩu phần. Accept chỉ thay các bữa planned đúng ngày; giữ nguyên bữa consumed. Việc đổi một bữa hoặc chỉnh lượng vẫn chỉ thay bản nháp trước accept.',
    events:[
      msg('user','ui','Chọn ngày, mục tiêu và sở thích'),msg('ui','api','Yêu cầu tạo meal plan'),msg('api','service','Xác thực và validate input'),msg('service','db','Kiểm tra quota; đọc catalog, món gần đây và bữa đã ăn'),msg('db','service','Thực phẩm và intake hiện tại',true),self('service','Tính mục tiêu còn lại; lọc món theo điều kiện ăn uống'),
      open('alt','[Còn mục tiêu và có catalog phù hợp]'),msg('service','db','Tạo AIGeneration: pending'),
      open('loop','[Tối đa 2 lượt; chỉ sửa lại nếu validation lần đầu trả 422]'),msg('service','llm','Sinh thực đơn từ catalog và mục tiêu còn lại'),msg('llm','service','JSON thực đơn',true),self('service','Kiểm tra ngày, bữa, foodRef; cân chỉnh khẩu phần và tính totals'),
      open('opt','[Kết quả lần đầu chưa hợp lệ]'),self('service','Bổ sung lỗi validation vào prompt để sửa ở lượt sau'),close(),close(),
      open('alt','[Có kết quả hợp lệ]'),msg('service','db','Lưu draft completed; loại draft cũ chưa accept'),msg('service','api','Draft, totals và shopping list',true),msg('api','ui','Hiển thị thực đơn dự thảo',true),
      branch('[Model lỗi hoặc vẫn không hợp lệ]'),msg('service','db','Đánh dấu generation failed'),msg('service','api','Lỗi sinh thực đơn',true),msg('api','ui','Báo lỗi; không tạo bữa ăn',true),close(),
      branch('[Mục tiêu / catalog không đáp ứng]'),msg('service','api','Trả lỗi 422 trước khi gọi LLM',true),msg('api','ui','Đề nghị điều chỉnh yêu cầu',true),close(),
      open('opt','[Có bản nháp hợp lệ; trainee xác nhận]'),msg('user','ui','Xác nhận, có thể kèm khẩu phần đã chỉnh'),msg('ui','api','Accept(generationId, date, overrides)'),msg('api','service','Chấp nhận kế hoạch ăn'),msg('service','db','Đọc và kiểm tra generation của trainee'),
      open('alt','[Dữ liệu vẫn hợp lệ]'),msg('service','db','Serializable transaction: claim; đọc lại foods; tính lại dinh dưỡng; thay bữa planned; lưu planned'),msg('db','service','Commit; dates và số món',true),msg('service','api','accepted = true',true),msg('api','ui','Hiển thị kế hoạch ăn đã lưu',true),
      branch('[Catalog đổi hoặc xảy ra xung đột không xử lý được]'),msg('service','api','Rollback; trả lỗi xác nhận',true),msg('api','ui','Thông báo chưa lưu kế hoạch',true),close(),close(),
    ] },
  { code:'AI-UC06',title:'Agent phân tích và điều chỉnh sau phê duyệt',
    participants:[['user','Trainee / Coach'],['ui','Agent Workspace'],['api','Agent API'],['worker','Agent Worker'],['tools','Tools / Approval Service'],['db','PostgreSQL / Prisma'],['llm','LLM Provider']],
    note:'Cần worker hoạt động. Chỉ sửa giáo án do tác nhân sở hữu, gán riêng và không có session đang mở; không sửa set hoàn tất. SSE chỉ gửi metadata; preview lấy bằng GET run. Hết hạn / sai hash / phiên bản đổi: 409 và rollback.',
    events:[
      msg('user','ui','Yêu cầu phân tích và điều chỉnh'),msg('ui','api','POST runs(message, requestKey)'),msg('api','db','Kiểm tra quyền; lưu message, run queued và checkpoint'),msg('api','ui','202: runId, conversationId',true),msg('ui','api','Mở SSE; theo dõi trạng thái run'),
      msg('worker','db','Claim queued run; running; đọc checkpoint và memories'),msg('db','worker','Run và ngữ cảnh được phép',true),
      open('loop','[Tool calling trong giới hạn bước, token và thời gian]'),msg('worker','llm','generateWithTools(messages, allowedTools)'),msg('llm','worker','Yêu cầu đọc dữ liệu / giáo án',true),msg('worker','tools','Thực thi read tools theo actor / subject'),msg('tools','db','Đọc lịch sử và giáo án được phép'),msg('db','tools','Dữ liệu theo phạm vi quyền',true),msg('tools','worker','Bằng chứng và tín hiệu từ fitness engines',true),msg('worker','llm','Bổ sung kết quả tools vào ngữ cảnh'),close(),
      msg('llm','worker','Tool call: propose_program_changes',true),msg('worker','tools','Tạo đề xuất thay reps / weight / RIR / số set'),msg('tools','db','Kiểm tra editable; lưu Approval pending, before/after và payloadHash'),msg('tools','worker','Đề xuất đã lưu; CHƯA sửa giáo án',true),msg('worker','db','Lưu checkpoint; waiting_approval; dừng lượt worker'),
      msg('api','db','Đọc events thuộc run'),msg('api','ui','SSE: waiting_approval (metadata)',true),msg('ui','api','GET run để lấy approvals'),msg('api','db','Đọc run và bản đề xuất'),msg('api','ui','Trả preview và payloadHash',true),msg('ui','user','Hiển thị thay đổi để quyết định',true),
      msg('user','ui','Duyệt hoặc từ chối'),msg('ui','api','POST decide(approve, payloadHash)'),msg('api','tools','Xử lý quyết định của chủ run'),
      open('alt','[Phê duyệt; hash, quyền và phiên bản vẫn hợp lệ]'),msg('tools','db','Serializable transaction: kiểm tra lại; áp dụng thay đổi; lưu approved; queued nếu hết pending'),msg('db','tools','Commit thay đổi giáo án',true),
      branch('[Từ chối đề xuất hợp lệ]'),msg('tools','db','Lưu rejected; không sửa giáo án; queued nếu hết pending'),msg('db','tools','Đã ghi nhận từ chối',true),
      branch('[Đề xuất hết hạn hoặc có xung đột]'),msg('tools','api','409; rollback; không áp dụng',true),msg('api','ui','Báo đề xuất cũ; cần rà soát lại',true),close(),
      open('opt','[Quyết định thành công; không còn approval chờ duyệt]'),msg('tools','api','Trả trạng thái quyết định',true),msg('api','ui','Đã xử lý quyết định',true),msg('worker','db','Nhận queued run; nạp checkpoint và quyết định'),msg('worker','llm','Tiếp tục với quyết định do server cung cấp'),msg('llm','worker','Tổng kết kết quả; không tự ghi giáo án',true),msg('worker','db','Lưu completed, assistant message và event'),msg('ui','api','Theo dõi SSE / GET run, conversation'),msg('api','db','Đọc kết quả hoàn tất'),msg('api','ui','Trả kết quả và trạng thái completed',true),msg('ui','user','Hiển thị kết quả cuối',true),close(),
    ] },
  { code:'AI-UC07',title:'Phân tích dữ liệu thực tế hỗ trợ coach',participants:base.map(p=>p[0]==='user'?['user','Coach']:p[0]==='service'?['service','Coach Insight Service']:p),
    note:'Chỉ phân tích học viên thuộc coach. Backend tính số liệu và tín hiệu trước; LLM viết báo cáo, không tự sửa giáo án hay thực đơn. Báo cáo lưu kèm fingerprint để nhận biết dữ liệu đã thay đổi.',
    events:[
      msg('user','ui','Chọn học viên và kỳ 7 / 14 / 28 ngày'),
      open('opt','[Coach mở báo cáo đã lưu]'),msg('ui','api','GET ai-insight'),msg('api','service','Đọc báo cáo của học viên thuộc coach'),msg('service','db','Đọc generation và tính fingerprint hiện tại'),msg('db','service','Báo cáo gần nhất nếu có',true),msg('service','api','Báo cáo và cờ stale',true),msg('api','ui','Hiển thị báo cáo; không gọi LLM',true),close(),
      msg('user','ui','Yêu cầu phân tích mới / phân tích lại'),msg('ui','api','POST ai-insight(days, locale)'),msg('api','service','Xác thực và kiểm tra học viên thuộc coach'),msg('service','db','Lấy tập luyện, dinh dưỡng, cân nặng, recovery và wearable'),msg('db','service','Dữ liệu hai kỳ phân tích',true),self('service','Tính số liệu, so sánh hai kỳ và xác định tín hiệu'),
      open('alt','[Có dữ liệu phân tích]'),msg('service','db','Kiểm tra quota; lưu generation pending và fingerprint'),msg('service','llm','Gửi findings đã tính; yêu cầu diễn giải và gợi ý'),msg('llm','service','Báo cáo JSON',true),self('service','Validate báo cáo; có thể yêu cầu sửa một lần'),
      open('alt','[Báo cáo hợp lệ]'),msg('service','db','Lưu findings, output, token usage; completed'),msg('db','service','Báo cáo đã lưu',true),msg('service','api','summary, sections và suggestions',true),msg('api','ui','Hiển thị báo cáo hỗ trợ quyết định',true),msg('ui','user','Coach xem và tự quyết định hành động',true),
      branch('[LLM hoặc validation thất bại]'),msg('service','db','Ghi nhận thất bại; xử lý quota provider riêng'),msg('service','api','Trả lỗi phân tích',true),msg('api','ui','Thông báo chưa tạo được báo cáo',true),close(),
      branch('[Không có dữ liệu]'),msg('service','api','422: NO_TRAINEE_DATA; không gọi LLM',true),msg('api','ui','Thông báo cần dữ liệu đầu vào',true),close(),
    ] },
];

function wrap(text, limit=34) {
  return text.split('<br>').flatMap(part=>{ const lines=[]; let line=''; for(const word of part.split(' ')) {if((line+' '+word).trim().length>limit&&line){lines.push(line);line='';}line=(line+' '+word).trim();}if(line)lines.push(line);return lines;});
}
function build(spec,index) {
  const positions = new Map(spec.participants.map(([id],i)=>[id,140+i*360]));
  const width = 280+(spec.participants.length-1)*360;
  let y=280, counter=0; const messages=[], frames=[], stack=[];
  for(const event of spec.events) {
    if(event.type==='message') {const lines=wrap(`${counter+1}. ${event.label}`).length;y+=Math.max(0,lines-3)*22;messages.push({...event,y,number:++counter});y+=event.a===event.b?130:86;}
    else if(event.type==='open') {const frame={kind:event.kind,label:event.label,top:y-28,bottom:0,branches:[],depth:stack.length};frames.push(frame);stack.push(frame);y+=105;}
    else if(event.type==='branch') {if(!stack.length)throw Error('Unbalanced branch');stack.at(-1).branches.push({y:y-22,label:event.label});y+=105;}
    else {if(!stack.length)throw Error('Unbalanced close');stack.pop().bottom=y-30;y+=40;}
  }
  if(stack.length)throw Error('Unclosed frame');
  const height=y+230, lifeTop=220, lifeBottom=y+15;
  const cells=['<mxCell id="0"/>','<mxCell id="1" parent="0"/>'];
  const svg=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white"/><g font-family="Times New Roman,serif" font-size="19" fill="#172334">`];
  function vertex(id,label,x,y,w,h,style){cells.push(`<mxCell id="${id}" value="${esc(label)}" style="html=1;fontFamily=Times New Roman;fontColor=#172334;fontSize=19;${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);}
  vertex('title',`${spec.code} — ${spec.title}`,30,25,width-60,60,'text;fillColor=none;strokeColor=none;align=center;fontSize=28;fontStyle=1;');
  svg.push(`<text x="${width/2}" y="65" text-anchor="middle" font-size="28" font-weight="bold">${esc(spec.code+' — '+spec.title)}</text>`);
  frames.forEach((frame,i)=>{
    const x=340+frame.depth*18, w=width-x-45-frame.depth*18;
    vertex(`frame-${i}`,'',x,frame.top,w,frame.bottom-frame.top,'rounded=0;fillColor=none;strokeColor=#94a3b8;strokeWidth=1;');
    vertex(`frame-kind-${i}`,frame.kind,x,frame.top,80,30,'rounded=0;fillColor=#eef2f7;strokeColor=#94a3b8;fontStyle=1;');
    vertex(`frame-guard-${i}`,frame.label,x+90,frame.top+1,w-100,44,'text;fillColor=none;strokeColor=none;align=left;verticalAlign=top;whiteSpace=wrap;fontStyle=2;fontSize=18;');
    svg.push(`<rect x="${x}" y="${frame.top}" width="${w}" height="${frame.bottom-frame.top}" fill="none" stroke="#94a3b8"/><rect x="${x}" y="${frame.top}" width="80" height="30" fill="#eef2f7" stroke="#94a3b8"/><text x="${x+40}" y="${frame.top+21}" text-anchor="middle" font-weight="bold">${frame.kind}</text><text x="${x+95}" y="${frame.top+23}" font-size="18" font-style="italic">${esc(frame.label)}</text>`);
    frame.branches.forEach((b,j)=>{
      cells.push(`<mxCell id="frame-separator-${i}-${j}" edge="1" parent="1" style="endArrow=none;startArrow=none;dashed=1;strokeColor=#94a3b8;"><mxGeometry relative="1" as="geometry"><mxPoint x="${x}" y="${b.y}" as="sourcePoint"/><mxPoint x="${x+w}" y="${b.y}" as="targetPoint"/></mxGeometry></mxCell>`);
      vertex(`guard-${i}-${j}`,b.label,x+12,b.y+3,w-24,44,'text;fillColor=none;strokeColor=none;align=left;verticalAlign=top;whiteSpace=wrap;fontSize=18;fontStyle=2;');
      svg.push(`<path d="M${x},${b.y} H${x+w}" stroke="#94a3b8" stroke-dasharray="5 4"/><text x="${x+15}" y="${b.y+25}" font-size="18" font-style="italic">${esc(b.label)}</text>`);
    });
  });
  spec.participants.forEach(([id,label],i)=>{
    const x=positions.get(id), lines=wrap(label,24);
    if(id==='user') {
      vertex(`head-${id}`,label,x-35,102,70,82,'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;align=center;labelWidth=220;whiteSpace=wrap;fillColor=#ffffff;strokeColor=#334155;');
      svg.push(`<g stroke="#334155" fill="none"><circle cx="${x}" cy="116" r="12"/><path d="M${x},128 V157 M${x-30},142 H${x+30} M${x},157 l-27,28 M${x},157 l27,28"/></g><text x="${x}" y="208" text-anchor="middle">${esc(label)}</text>`);
    } else {
      const color=id==='llm'?'#fff0dc':id==='db'?'#e7f4ed':'#edf0fb';
      vertex(`head-${id}`,lines.join('<br>'),x-120,130,240,66,`rounded=0;whiteSpace=wrap;fillColor=${color};strokeColor=#64748b;`);
      svg.push(`<rect x="${x-120}" y="130" width="240" height="66" fill="${color}" stroke="#64748b"/>`);lines.forEach((line,j)=>svg.push(`<text x="${x}" y="${163-(lines.length-1)*12+j*24+6}" text-anchor="middle">${esc(line)}</text>`));
    }
    vertex(`life-${id}`,'',x,lifeTop,1,lifeBottom-lifeTop,'shape=line;direction=south;dashed=1;strokeColor=#94a3b8;fillColor=none;');
    svg.push(`<path d="M${x},${lifeTop} V${lifeBottom}" stroke="#94a3b8" stroke-dasharray="6 5"/>`);
  });
  for(const m of messages) {
    const sx=positions.get(m.a),tx=positions.get(m.b);
    if(sx===undefined||tx===undefined)throw Error('Unknown participant');
    const isSelf=m.a===m.b, endY=m.y+(isSelf?42:0);
    const label=wrap(`${m.number}. ${m.label}`).join('<br>');
    const sy=(m.y-lifeTop)/(lifeBottom-lifeTop),ty=(endY-lifeTop)/(lifeBottom-lifeTop);
    const points=isSelf?[{x:sx+130,y:m.y},{x:sx+130,y:endY}]:[];
    cells.push(`<mxCell id="message-${m.number}" value="${esc(label)}" style="html=1;fontFamily=Times New Roman;fontSize=18;fontColor=#172334;endArrow=${m.reply?'open':'block'};endFill=${m.reply?0:1};startArrow=none;dashed=${m.reply?1:0};strokeColor=#475569;strokeWidth=1.2;rounded=0;labelBackgroundColor=#ffffff;verticalAlign=bottom;exitX=0.5;exitY=${sy};exitPerimeter=0;entryX=0.5;entryY=${ty};entryPerimeter=0;" edge="1" source="life-${m.a}" target="life-${m.b}" parent="1"><mxGeometry relative="1" as="geometry">${points.length?`<Array as="points">${points.map(p=>`<mxPoint x="${p.x}" y="${p.y}"/>`).join('')}</Array>`:''}</mxGeometry></mxCell>`);
    const d=isSelf?`M${sx},${m.y} H${sx+130} V${endY} H${sx}`:`M${sx},${m.y} H${tx}`;
    svg.push(`<path d="${d}" fill="none" stroke="#475569" stroke-width="1.2"${m.reply?' stroke-dasharray="5 4"':''}/>`);
    const dir=isSelf?-1:Math.sign(tx-sx), arrowX=tx-dir*10;
    svg.push(`<path d="M${arrowX},${endY-5} L${tx},${endY} L${arrowX},${endY+5}" fill="${m.reply?'none':'#475569'}" stroke="#475569"/>`);
    const labelX=isSelf?sx+170:(sx+tx)/2, lines=wrap(`${m.number}. ${m.label}`);
    lines.forEach((line,j)=>svg.push(`<text x="${labelX}" y="${m.y-10-(lines.length-1-j)*22}" text-anchor="middle" font-size="18">${esc(line)}</text>`));
  }
  vertex('notes',spec.note,65,y+45,width-130,150,'text;whiteSpace=wrap;align=left;verticalAlign=top;fontSize=20;fillColor=none;strokeColor=none;');
  wrap(spec.note,Math.floor((width-130)/10)).forEach((line,i)=>svg.push(`<text x="65" y="${y+70+i*27}" font-size="20">${esc(line)}</text>`));
  svg.push('</g></svg>');
  return {id:`${spec.code.toLowerCase()}-sequence`,xml:`<diagram id="${spec.code.toLowerCase()}-sequence" name="${String(index+7).padStart(2,'0')} - Sequence ${spec.code}"><mxGraphModel adaptiveColors="auto" grid="1" gridSize="10" page="1" pageScale="1" pageWidth="${width}" pageHeight="${height}" background="#ffffff"><root>${cells.join('\n')}</root></mxGraphModel></diagram>`,svg:svg.join('\n')};
}
async function main(){
  let original=fs.readFileSync(file,'utf8');if(!original.trim().endsWith('</mxfile>'))throw Error('Invalid diagram file');
  const pages=specs.map(build);
  for(const p of pages)if(original.includes(`id="${p.id}"`)){if(!process.argv.includes('--replace-sequences'))throw Error(`${p.id} already exists`);original=original.replace(new RegExp(`<diagram\\b[^>]*\\bid="${p.id}"[^>]*>[\\s\\S]*?<\\/diagram>`),'');}
  let additions=pages.map(p=>p.xml).join('\n');
  additions=additions.replace(/="([^"]*)"/g,(_,v)=>'="'+v.replace(/</g,'&lt;').replace(/&(?!(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/g,'&amp;')+'"');
  additions=additions.replace(/<mxCell id="([^"]+)" parent="\1"\s*\/>/g,'<mxCell id="$1" parent="0"/>');
  fs.writeFileSync(file,original.replace(/<\/mxfile>\s*$/,additions+'\n</mxfile>'));
  const i=process.argv.indexOf('--preview-dir');if(i!==-1){if(!process.argv[i+1])throw Error('Missing preview directory');const dir=path.resolve(process.argv[i+1]);fs.mkdirSync(dir,{recursive:true});for(const p of pages)await require('sharp')(Buffer.from(p.svg)).png().toFile(path.join(dir,p.id+'.png'));}
  console.log('Added 4 sequence pages. Existing pages preserved.');
}
// Keep the original entry point on the current A4 layout.
require('./a4-sequence-pages.cjs');
