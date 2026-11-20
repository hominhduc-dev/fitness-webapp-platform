const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const selected = ['AI-UC02', 'AI-UC04', 'AI-UC06', 'AI-UC07'];
const detailIds = new Set(selected.map(code => code.toLowerCase() + '-detail'));
const diagramFile = path.join(root, 'docs/fitness-platform-diagram.drawio');
let diagram = fs.readFileSync(diagramFile, 'utf8');
diagram = diagram.replace(/<diagram\b[^>]*>[\s\S]*?<\/diagram>/g, page => {
  const id = page.match(/^<diagram\b[^>]*\bid="([^"]+)"/)?.[1];
  if (id?.endsWith('-detail') && !detailIds.has(id)) return '';
  return page;
});
fs.writeFileSync(diagramFile, diagram);

const overviewFile = path.join(root, 'scripts/fitness-overview-page.cjs');
let overview = fs.readFileSync(overviewFile, 'utf8');
overview = overview.replace(/const cases = \[[\s\S]*?\n\];/, `const cases = [
  ['ai02', 'AI-UC02', 'Cá nhân hóa chương trình<br>tập luyện bằng AI', 790, 220, 'shared'],
  ['ai06', 'AI-UC06', 'Phân tích và điều chỉnh<br>giáo án với AI Agent', 790, 400, 'shared'],
  ['ai04', 'AI-UC04', 'Cá nhân hóa kế hoạch<br>dinh dưỡng bằng AI', 440, 700, 'trainee'],
  ['ai07', 'AI-UC07', 'Phân tích dữ liệu học viên<br>hỗ trợ coach ra quyết định', 1130, 700, 'coach'],
];`);
overview = overview.replace(/const actors = .*?;/, `const actors = [['trainee', 'Học viên<br>(Trainee)', 65, 350], ['coach', 'Huấn luyện viên<br>(Coach)', 1460, 350]];`);
overview = overview.replace(/const edges = \[[\s\S]*?\n\];/, `const edges = [
  ...['ai02', 'ai06', 'ai04'].map(id => ['trainee', id]),
  ...['ai02', 'ai06', 'ai07'].map(id => ['coach', id]),
];`);
overview = overview.replaceAll('1830', '1000').replaceAll('1720', '890');
fs.writeFileSync(overviewFile, overview);

const generatorFile = path.join(root, 'scripts/generate-ai-use-case.cjs');
let generator = fs.readFileSync(generatorFile, 'utf8');
generator = generator.replace(/const useCases = \[[\s\S]*?\n\];/, `const useCases = [
  ['uc02', 'AI-UC02', 'Cá nhân hóa chương trình<br>tập luyện bằng AI', 790, 220, '#edf0fb'],
  ['uc06', 'AI-UC06', 'Phân tích và điều chỉnh<br>giáo án với AI Agent', 790, 400, '#edf0fb'],
  ['uc04', 'AI-UC04', 'Cá nhân hóa kế hoạch<br>dinh dưỡng bằng AI', 440, 700, '#e7f4ed'],
  ['uc07', 'AI-UC07', 'Phân tích dữ liệu học viên<br>hỗ trợ coach ra quyết định', 1130, 700, '#fff0dc'],
];`);
generator = generator.replace(/const associations = \[[\s\S]*?\n\];/, `const associations = [
  ['trainee', 'uc02'], ['trainee', 'uc04'], ['trainee', 'uc06'],
  ['coach', 'uc02'], ['coach', 'uc06'], ['coach', 'uc07'],
];`);
generator = generator.replaceAll('1330', '890').replaceAll('1440', '1000').replaceAll('1460, 425', '1460, 350').replaceAll('65, 425', '65, 350');
fs.writeFileSync(generatorFile, generator);

const detailFile = path.join(root, 'scripts/add-ai-detail-pages.cjs');
let details = fs.readFileSync(detailFile, 'utf8');
details = details.replace('const pages = specifications.map(build);', `const pages = specifications.filter(spec => ${JSON.stringify(selected)}.includes(spec.code)).map(build);`);
details = details.replace("console.log('Appended 9 detailed pages; existing pages preserved byte-for-byte.');", "console.log('Updated 4 selected detailed pages; other pages preserved.');");
fs.writeFileSync(detailFile, details);
console.log('Selected AI-UC02, AI-UC04, AI-UC06, AI-UC07; removed other detailed pages.');
