const fs = require('node:fs');
const path = require('node:path');
const scripts = __dirname;
const overviewPath = path.join(scripts, 'fitness-overview-page.cjs');
let text = fs.readFileSync(overviewPath, 'utf8');
const cases = [
  ['register','UC01','Đăng ký tài khoản',790,170,'base'],
  ['login','UC02','Đăng nhập',790,310,'base'],
  ['ai01','AI-UC01','Tư vấn fitness cá nhân hóa',790,480,'shared'],
  ['ai02','AI-UC02','Tạo chương trình tập luyện<br>bằng AI',790,620,'shared'],
  ['ai06','AI-UC06','Phân tích và điều chỉnh<br>giáo án với AI Agent',790,760,'shared'],
  ['logs','UC03','Thực hiện và ghi nhật ký<br>tập luyện (Workout log)',440,960,'base'],
  ['meals','UC04','Ghi nhật ký ăn uống<br>(Meal log)',440,1140,'base'],
  ['ai03','AI-UC03','Tạo buổi tập bằng AI',440,1320,'trainee'],
  ['ai04','AI-UC04','Lập thực đơn cá nhân hóa<br>bằng AI',440,1500,'trainee'],
  ['ai05','AI-UC05','Phân tích dinh dưỡng<br>và gợi ý cải thiện',440,1680,'trainee'],
  ['ai07','AI-UC07','Phân tích tiến độ học viên<br>bằng AI',1130,960,'coach'],
  ['ai08','AI-UC08','Rà soát học viên và lập<br>báo cáo bằng AI Agent',1130,1140,'coach'],
  ['ai09','AI-UC09','Số hóa giáo án từ hình ảnh',1130,1320,'coach'],
];
const actors = [['visitor','Khách truy cập',65,185],['trainee','Học viên<br>(Trainee)',65,800],['coach','Huấn luyện viên<br>(Coach)',1460,800]];
const edges = [['visitor','register'],['visitor','login'], ...['ai01','ai02','ai06','logs','meals','ai03','ai04','ai05'].map(id=>['trainee',id]), ...['ai01','ai02','ai06','ai07','ai08','ai09'].map(id=>['coach',id])];
text = text.replace(/const cases = \[[\s\S]*?\n\];/, `const cases = ${JSON.stringify(cases,null,2)};`);
text = text.replace(/const actors = .*?;/, `const actors = ${JSON.stringify(actors)};`);
text = text.replace(/const edges = \[[\s\S]*?\n\];/, `const edges = ${JSON.stringify(edges,null,2)};`);
text = text.replaceAll('1000','1830').replaceAll('890','1720');
fs.writeFileSync(overviewPath,text);
const generatorPath = path.join(scripts,'generate-ai-use-case.cjs');
let generator = fs.readFileSync(generatorPath,'utf8');
const positions = {ai01:[790,220],ai02:[790,370],ai06:[790,520],ai03:[440,735],ai04:[440,925],ai05:[440,1115],ai07:[1130,735],ai08:[1130,925],ai09:[1130,1115]};
const colors = {shared:'#edf0fb',trainee:'#e7f4ed',coach:'#fff0dc'};
const aiCases = cases.filter(row=>positions[row[0]]).map(([id,code,label,,,kind])=>[id.replace('ai','uc'),code,label,...positions[id],colors[kind]]);
const aiEdges = edges.filter(([actor,target])=>positions[target]).map(([actor,target])=>[actor,target.replace('ai','uc')]);
generator = generator.replace(/const useCases = \[[\s\S]*?\n\];/, `const useCases = ${JSON.stringify(aiCases,null,2)};`);
generator = generator.replace(/const associations = \[[\s\S]*?\n\];/, `const associations = ${JSON.stringify(aiEdges,null,2)};`);
generator = generator.replaceAll('890','1330').replaceAll('1000','1440').replaceAll('65, 350','65, 425').replaceAll('1460, 350','1460, 425');
fs.writeFileSync(generatorPath,generator);
console.log('Restored 13 system overview use cases and 9 AI overview use cases. Detailed pages are preserved by the generator.');
