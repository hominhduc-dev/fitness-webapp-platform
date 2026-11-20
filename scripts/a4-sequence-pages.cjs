const fs = require('node:fs');
const path = require('node:path');
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const m=(a,b,label,reply=false)=>({type:'message',a,b,label,reply});
const f=(kind,label)=>({type:'open',kind,label});
const otherwise=label=>({type:'branch',label});
const end=()=>({type:'close'});
const common=[['u','Người dùng'],['ui','Web client'],['api','Express API'],['db','PostgreSQL'],['ai','LLM Provider']];
const specs=[
  {code:'AI-UC02',title:'Cá nhân hóa chương trình tập luyện',participants:common,step:29,
    notes:['Trainee tạo cho bản thân; coach tạo cho học viên thuộc mình. Bản nháp chưa tạo giáo án sử dụng.', 'Accept kiểm tra lại quyền, trạng thái và catalog; lỗi thì rollback.', 'Endpoint minh họa trainee; coach dùng /coach/trainees/{id}/ai-program và nhánh /accept.'],
    events:[m('u','ui','Nhập mục tiêu, lịch và thiết bị'),m('ui','api','POST /ai/generate-program'),m('api','db','Đọc hồ sơ, lịch sử và catalog'),m('db','api','Dữ liệu trong phạm vi quyền',true),m('api','ai','Sinh chương trình từ catalog'),m('ai','api','JSON chương trình',true),
      f('alt','[Kết quả AI hợp lệ]'),m('api','db','Validate; lưu bản nháp'),m('api','ui','generationId + bản nháp',true),otherwise('[AI lỗi hoặc kết quả không hợp lệ]'),m('api','ui','Trả lỗi; chưa tạo giáo án',true),end(),
      f('opt','[Có bản nháp hợp lệ và người dùng chấp nhận]'),m('u','ui','Xác nhận chương trình'),m('ui','api','POST /ai/accept-program'),m('api','db','Transaction: kiểm tra; tạo giáo án'),m('db','api','Commit; giáo án đã gán',true),m('api','ui','Chương trình đã lưu',true),m('ui','u','Hiển thị kết quả',true),end()]},
  {code:'AI-UC04',title:'Cá nhân hóa kế hoạch dinh dưỡng',participants:common.map(p=>p[0]==='u'?['u','Trainee']:p),step:28,
    notes:['Backend tính mục tiêu và khẩu phần; AI có thể sửa một lần. Thiếu mục tiêu/catalog: trả 422 trước gọi AI.', 'Accept chỉ lưu kế hoạch planned và thay planned cũ đúng ngày; giữ nguyên bữa consumed. Lỗi: rollback.'],
    events:[m('u','ui','Chọn ngày và điều kiện ăn'),m('ui','api','POST /ai/generate-meal-plan'),m('api','db','Đọc mục tiêu, catalog và intake'),m('db','api','Thực phẩm và các bữa đã ăn',true),m('api','ai','Sinh thực đơn theo mục tiêu'),m('ai','api','JSON thực đơn',true),
      f('alt','[Thực đơn hợp lệ sau kiểm tra và cân chỉnh khẩu phần]'),m('api','db','Lưu bản nháp completed'),m('api','ui','Thực đơn + totals + shopping list',true),otherwise('[AI lỗi hoặc thực đơn không hợp lệ]'),m('api','ui','Báo lỗi; không tạo bữa ăn',true),end(),
      f('opt','[Trainee xác nhận bản nháp hợp lệ, có thể chỉnh khẩu phần]'),m('u','ui','Chấp nhận kế hoạch ăn'),m('ui','api','POST /ai/accept-meal-plan'),m('api','db','Transaction: kiểm tra; lưu planned'),m('db','api','Commit; giữ nguyên consumed',true),m('api','ui','Kế hoạch ăn đã lưu',true),m('ui','u','Hiển thị thực đơn',true),end()]},
  {code:'AI-UC06',title:'Agent phân tích, đề xuất và áp dụng điều chỉnh',step:23,
    participants:[['u','Trainee / Coach'],['ui','Web client'],['api','Agent API'],['worker','Agent Worker'],['db','PostgreSQL'],['ai','LLM Provider']],
    notes:['Worker gọi tools đọc dữ liệu theo quyền; SSE chỉ gửi trạng thái, preview lấy qua GET run. Cần bật worker.', 'Thay đổi được ghi trong request phê duyệt, sau kiểm tra quyền/hash/phiên bản. Lỗi: 409 và rollback.', 'Run được queued khi hết approval pending; worker tiếp tục tổng kết. Từ chối không sửa giáo án.'],
    events:[m('u','ui','Yêu cầu điều chỉnh giáo án'),m('ui','api','POST /agent/runs'),m('api','db','Lưu message và run queued'),m('api','ui','202 + runId',true),m('worker','db','Nhận run; nạp ngữ cảnh'),m('worker','ai','Phân tích bằng vòng tool calling'),m('ai','worker','Đề xuất sau khi đọc dữ liệu',true),m('worker','db','Lưu approval; waiting_approval'),m('ui','api','GET run sau SSE trạng thái'),m('api','ui','Preview + payloadHash',true),m('u','ui','Duyệt hoặc từ chối'),m('ui','api','POST decide(approve, hash)'),
      f('alt','[Phê duyệt; quyền, hash và phiên bản vẫn hợp lệ]'),m('api','db','Transaction: áp dụng; approved'),otherwise('[Từ chối đề xuất hợp lệ]'),m('api','db','Lưu rejected; không sửa giáo án'),end(),
      m('api','ui','Trả quyết định phê duyệt',true),m('worker','ai','Tiếp tục run từ checkpoint'),m('ai','worker','Giải thích kết quả',true),m('worker','db','Lưu completed và phản hồi'),m('ui','api','GET run / conversation'),m('api','ui','Kết quả cuối',true)]},
  {code:'AI-UC07',title:'Phân tích dữ liệu thực tế hỗ trợ coach ra quyết định',participants:common.map(p=>p[0]==='u'?['u','Coach']:p),step:34,
    notes:['Chỉ phân tích học viên thuộc coach. Backend tính số liệu và tín hiệu; LLM diễn giải, không tự sửa giáo án.', 'GET báo cáo cũ không gọi LLM; POST tạo phân tích mới. AI lỗi: ghi failed và trả lỗi, không tạo báo cáo mới.'],
    events:[m('u','ui','Chọn học viên và kỳ phân tích'),m('ui','api','POST /coach/trainees/{id}/ai-insight'),m('api','db','Kiểm tra quyền; đọc dữ liệu'),m('db','api','Dữ liệu tập, ăn và phục hồi',true),m('api','api','So sánh hai kỳ; tính findings'),
      f('alt','[Có dữ liệu phù hợp và còn quota]'),m('api','db','Lưu generation pending'),m('api','ai','Gửi findings; yêu cầu diễn giải'),m('ai','api','Báo cáo và gợi ý',true),m('api','db','Validate; lưu completed'),m('db','api','Báo cáo đã lưu',true),m('api','ui','Summary, sections, suggestions',true),m('ui','u','Coach xem và quyết định',true),otherwise('[Không có dữ liệu]'),m('api','ui','422: NO_TRAINEE_DATA',true),end()]},
];
const W=1169,H=827;
function build(spec,index){
  const xs=spec.participants.length===5?[100,340,580,820,1060]:[95,290,485,680,875,1070];
  const positions=new Map(spec.participants.map(([id],i)=>[id,xs[i]]));
  let y=170,count=0;const messages=[],frames=[],stack=[];
  for(const event of spec.events){
    if(event.type==='message'){messages.push({...event,y,number:++count});y+=spec.step;}
    else if(event.type==='open'){const frame={top:y-7,kind:event.kind,label:event.label,bottom:0,branches:[]};frames.push(frame);stack.push(frame);y+=28;}
    else if(event.type==='branch'){stack.at(-1).branches.push({y:y-9,label:event.label});y+=28;}
    else {stack.pop().bottom=y-10;y+=10;}
  }
  if(stack.length||y>738)throw Error(`${spec.code} does not fit A4: ${y}`);
  const cells=['<mxCell id="0"/>','<mxCell id="1" parent="0"/>'];
  const svg=[`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="white"/><g font-family="Times New Roman,serif" font-size="13" fill="#142238">`];
  function vertex(id,label,x,y,w,h,style=''){
    cells.push(`<mxCell id="${id}" value="${esc(label)}" style="html=1;fontFamily=Times New Roman;fontSize=13;fontColor=#142238;${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
  }
  function text(id,label,x,y,w,h,size=13,align='left',bold=false,italic=false){
    vertex(id,label,x,y,w,h,`text;fillColor=none;strokeColor=none;whiteSpace=wrap;align=${align};verticalAlign=middle;fontSize=${size};fontStyle=${(bold?1:0)+(italic?2:0)};spacing=0;`);
    svg.push(`<text x="${align==='center'?x+w/2:x}" y="${y+h/2+size*.34}" font-size="${size}" text-anchor="${align==='center'?'middle':'start'}"${bold?' font-weight="bold"':''}${italic?' font-style="italic"':''}>${esc(label)}</text>`);
  }
  function line(id,points,{dashed=false,arrow=false,reply=false}={}){
    const first=points[0],last=points.at(-1);
    const way=points.slice(1,-1);
    cells.push(`<mxCell id="${id}" edge="1" parent="1" style="html=1;endArrow=${arrow?(reply?'open':'block'):'none'};endFill=${reply?0:1};startArrow=none;strokeWidth=0.9;strokeColor=${arrow?'#334155':'#94a3b8'};dashed=${dashed?1:0};rounded=0;"><mxGeometry relative="1" as="geometry"><mxPoint x="${first.x}" y="${first.y}" as="sourcePoint"/><mxPoint x="${last.x}" y="${last.y}" as="targetPoint"/>${way.length?`<Array as="points">${way.map(p=>`<mxPoint x="${p.x}" y="${p.y}"/>`).join('')}</Array>`:''}</mxGeometry></mxCell>`);
    svg.push(`<path d="${points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ')}" fill="none" stroke="${arrow?'#334155':'#94a3b8'}" stroke-width="0.9"${dashed?' stroke-dasharray="3 3"':''}/>`);
    if(arrow){const prev=points.at(-2),dir=Math.sign(last.x-prev.x)||1;svg.push(`<path d="M${last.x-dir*7},${last.y-3} L${last.x},${last.y} L${last.x-dir*7},${last.y+3}" stroke="#334155" fill="${reply?'none':'#334155'}" stroke-width="0.9"/>`);}
  }
  text('title',`${spec.code} — ${spec.title}`,35,25,1100,28,16,'left',true);
  text('intro','Đã đăng nhập. Đường dẫn HTTP có tiền tố /api; API gộp controller + service.',35,60,1100,22,13);
  const lifeEnd=Math.min(728,y+5);
  spec.participants.forEach(([id,label],i)=>line(`lifeline-${id}`,[{x:xs[i],y:135},{x:xs[i],y:lifeEnd}],{dashed:true}));
  frames.forEach((frame,i)=>{
    vertex(`frame-${i}`,'',34,frame.top,1100,frame.bottom-frame.top,'rounded=0;fillColor=none;strokeColor=#94a3b8;strokeWidth=1;');
    svg.push(`<rect x="34" y="${frame.top}" width="1100" height="${frame.bottom-frame.top}" fill="none" stroke="#94a3b8"/>`);
    vertex(`tab-${i}`,frame.kind,34,frame.top,49,21,'rounded=0;fillColor=#f1f5f9;strokeColor=#94a3b8;fontStyle=1;align=center;');
    svg.push(`<rect x="34" y="${frame.top}" width="49" height="21" fill="#f1f5f9" stroke="#94a3b8"/><text x="58.5" y="${frame.top+15}" text-anchor="middle" font-weight="bold">${frame.kind}</text>`);
    text(`frame-label-${i}`,frame.label,95,frame.top+1,1028,20,12.5,'left',false,true);
    frame.branches.forEach((branch,j)=>{line(`separator-${i}-${j}`,[{x:34,y:branch.y},{x:1134,y:branch.y}],{dashed:true});text(`branch-${i}-${j}`,branch.label,95,branch.y+3,1028,20,12.5,'left',false,true);});
  });
  spec.participants.forEach(([id,label],i)=>{
    const width=spec.participants.length===5?150:146;
    const color=id==='u'?'#eef4ff':id==='db'?'#fff7ed':id==='ai'?'#fff2e9':id==='api'?'#edfff7':'#f8fafc';
    vertex(`participant-${id}`,label,xs[i]-width/2,105,width,37,`rounded=0;fillColor=${color};strokeColor=#94a3b8;align=center;fontStyle=1;`);
    svg.push(`<rect x="${xs[i]-width/2}" y="105" width="${width}" height="37" fill="${color}" stroke="#94a3b8"/><text x="${xs[i]}" y="128" text-anchor="middle" font-weight="bold">${esc(label)}</text>`);
  });
  for(const message of messages){
    const a=positions.get(message.a),b=positions.get(message.b),isSelf=a===b;
    const points=isSelf?[{x:a,y:message.y},{x:a+42,y:message.y},{x:a+42,y:message.y+11},{x:a,y:message.y+11}]:[{x:a,y:message.y},{x:b,y:message.y}];
    line(`message-${message.number}`,points,{arrow:true,reply:message.reply,dashed:message.reply});
    const label=`${message.number}. ${message.label}`;
    const available=isSelf?220:Math.abs(b-a)-8;
    const font=spec.participants.length===6?12:12.5;
    const x=isSelf?a+8:(a+b)/2-available/2;
    text(`message-label-${message.number}`,label,x,message.y-21,available,18,font,isSelf?'left':'center');
  }
  const footY=H-24-spec.notes.length*18;
  spec.notes.forEach((note,i)=>text(`note-${i}`,note,35,footY+i*18,1100,17,12));
  svg.push('</g></svg>');
  return {id:`${spec.code.toLowerCase()}-sequence`,xml:`<diagram id="${spec.code.toLowerCase()}-sequence" name="${index+7} - Sequence ${spec.code}"><mxGraphModel adaptiveColors="auto" grid="0" page="1" pageScale="1" pageWidth="1169" pageHeight="827" background="#ffffff"><root>${cells.join('\n')}</root></mxGraphModel></diagram>`,svg:svg.join('\n')};
}
async function main(){
  const file=path.resolve(__dirname,'../docs/fitness-platform-diagram.drawio');
  const original=fs.readFileSync(file,'utf8');
  const pages=specs.map(build);let updated=original;
  for(const page of pages){const pattern=new RegExp(`<diagram\\b[^>]*\\bid="${page.id}"[^>]*>[\\s\\S]*?<\\/diagram>`);if(!pattern.test(updated))throw Error(`Missing ${page.id}`);updated=updated.replace(pattern,page.xml);}
  updated=updated.replace(/="([^"]*)"/g,(_,v)=>'="'+v.replace(/</g,'&lt;').replace(/&(?!(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/g,'&amp;')+'"');
  const getOther=value=>(value.match(/<diagram\b[^>]*>[\s\S]*?<\/diagram>/g)||[]).filter(page=>!/^<diagram\b[^>]*\bid="ai-uc(?:02|04|06|07)-sequence"/.test(page));
  if(JSON.stringify(getOther(original))!==JSON.stringify(getOther(updated)))throw Error('Existing use case pages changed');
  fs.writeFileSync(file,updated);
  const i=process.argv.indexOf('--preview-dir');if(i!==-1){if(!process.argv[i+1])throw Error('Missing preview directory');const dir=path.resolve(process.argv[i+1]);fs.mkdirSync(dir,{recursive:true});for(const page of pages)await require('sharp')(Buffer.from(page.svg)).png().toFile(path.join(dir,page.id+'.png'));}
  console.log('Replaced 4 sequence pages: A4 landscape 1169 x 827. Six use case pages unchanged.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
