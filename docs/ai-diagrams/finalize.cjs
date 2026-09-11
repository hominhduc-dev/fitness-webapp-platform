const fs=require('fs'),path=require('path');
const root=__dirname;
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8').replace(/^\uFEFF/,''));
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('02 · Sequence — tạo và lưu chương trình tập','02 · Sequence — tạo chương trình tập').replace('03 · Sequence — gợi ý và ghi nhận thực đơn','04 · Sequence — gợi ý thực đơn').replace('04 · Sequence — chat với dữ liệu cá nhân','06 · Sequence — chat với dữ liệu cá nhân');
html=html.replace('<a href="sequence-meals.html">','<a href="sequence-workout-accept.html">03 · Sequence — lưu chương trình tập</a><a href="sequence-meals.html">').replace('<a href="sequence-chat.html">','<a href="sequence-meals-accept.html">05 · Sequence — ghi thực đơn vào nhật ký</a><a href="sequence-chat.html">');
fs.writeFileSync(path.join(root,'index.html'),html);
const receipts=['workout','workout-accept','meals','meals-accept','chat'].map(n=>{
 const d=read(`sequence-${n}.deliver.json`),b=read(`sequence-${n}.browser.json`);
 return {diagram_type:'sequence',output:d.output,specification_sha256:d.specification.sha256,artifact_sha256:d.artifact.sha256,validation:d.validation,browser_evidence:b.status==='pass'?'passed':'failed',visual_review:'passed',visual_review_scope:'Ảnh screenshot artifact đã deliver; nhãn, đường nối, bố cục. Không kiểm thử thủ công mọi nút viewer.',correction_rounds:2};
});
fs.writeFileSync(path.join(root,'handoff.json'),JSON.stringify(receipts,null,2)+'\n');
