const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve(__dirname, '../docs/fitness-platform-diagram.drawio');
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
const font = 'html=1;fontFamily=Times New Roman;fontSize=23;fontColor=#172334;';
function vertex(id, value, x, y, width, height, style, parent = '1') {
  cells.push(`<mxCell id="${id}" value="${escape(value)}" style="${font}${style}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/></mxCell>`);
}
vertex('boundary', 'YEAHBUDDY FITNESS — MODULE AI', 210, 55, 1160, 1330,
  'rounded=0;container=1;collapsible=0;fillColor=#ffffff;strokeColor=#64748b;strokeWidth=1.2;verticalAlign=top;spacingTop=22;fontSize=28;fontStyle=1;');
const useCases = [
  [
    "uc01",
    "AI-UC01",
    "Tư vấn fitness cá nhân hóa",
    790,
    220,
    "#edf0fb"
  ],
  [
    "uc02",
    "AI-UC02",
    "Tạo chương trình tập luyện<br>bằng AI",
    790,
    370,
    "#edf0fb"
  ],
  [
    "uc06",
    "AI-UC06",
    "Phân tích và điều chỉnh<br>giáo án với AI Agent",
    790,
    520,
    "#edf0fb"
  ],
  [
    "uc03",
    "AI-UC03",
    "Tạo buổi tập bằng AI",
    440,
    735,
    "#e7f4ed"
  ],
  [
    "uc04",
    "AI-UC04",
    "Lập thực đơn cá nhân hóa<br>bằng AI",
    440,
    925,
    "#e7f4ed"
  ],
  [
    "uc05",
    "AI-UC05",
    "Phân tích dinh dưỡng<br>và gợi ý cải thiện",
    440,
    1115,
    "#e7f4ed"
  ],
  [
    "uc07",
    "AI-UC07",
    "Phân tích tiến độ học viên<br>bằng AI",
    1130,
    735,
    "#fff0dc"
  ],
  [
    "uc08",
    "AI-UC08",
    "Rà soát học viên và lập<br>báo cáo bằng AI Agent",
    1130,
    925,
    "#fff0dc"
  ],
  [
    "uc09",
    "AI-UC09",
    "Số hóa giáo án từ hình ảnh",
    1130,
    1115,
    "#fff0dc"
  ]
];
for (const [id, code, label, cx, cy, color] of useCases) {
  vertex(id, `${code}<br>${label}`, cx - 185 - 210, cy - 52 - 55, 370, 104,
    `ellipse;whiteSpace=wrap;fillColor=${color};strokeColor=#64748b;strokeWidth=1.2;`, 'boundary');
}
const actors = [
  ['trainee', 'Học viên<br>(Trainee)', 65, 425],
  ['coach', 'Huấn luyện viên<br>(Coach)', 1460, 425],
];
for (const [id, label, x, y] of actors) {
  vertex(id, label, x, y, 70, 110,
    'shape=umlActor;whiteSpace=wrap;fillColor=#ffffff;strokeColor=#334155;strokeWidth=1.4;' +
    (id === 'trainee' ? 'verticalLabelPosition=bottom;verticalAlign=top;align=center;labelWidth=170;' : 'labelPosition=right;verticalLabelPosition=middle;verticalAlign=middle;align=left;spacingLeft=16;labelWidth=210;'));
}
const associations = [
  [
    "trainee",
    "uc01"
  ],
  [
    "trainee",
    "uc02"
  ],
  [
    "trainee",
    "uc06"
  ],
  [
    "trainee",
    "uc03"
  ],
  [
    "trainee",
    "uc04"
  ],
  [
    "trainee",
    "uc05"
  ],
  [
    "coach",
    "uc01"
  ],
  [
    "coach",
    "uc02"
  ],
  [
    "coach",
    "uc06"
  ],
  [
    "coach",
    "uc07"
  ],
  [
    "coach",
    "uc08"
  ],
  [
    "coach",
    "uc09"
  ]
];
associations.forEach(([source, target], index) => {
  const left = source === 'trainee';
  const style = `html=1;endArrow=none;startArrow=none;rounded=0;strokeColor=#64748b;strokeWidth=1.1;exitX=${left ? 1 : 0};exitY=0.5;exitPerimeter=0;entryX=${left ? 0 : 1};entryY=0.5;entryPerimeter=0;`;
  cells.push(`<mxCell id="association-${index + 1}" style="${style}" edge="1" source="${source}" target="${target}" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>`);
});
const overview = require('./fitness-overview-page.cjs')();
let xml = `<mxfile host="Electron">${overview.xml}<diagram id="ai-overview" name="02 - Module AI"><mxGraphModel adaptiveColors="auto" grid="1" gridSize="10" page="1" pageScale="1" pageWidth="1770" pageHeight="1440" background="#ffffff"><root>\n${cells.join('\n')}\n</root></mxGraphModel></diagram></mxfile>`;
if (fs.existsSync(output)) {
  const existingPages = fs.readFileSync(output, 'utf8').match(/<diagram\b[^>]*>[\s\S]*?<\/diagram>/g) ?? [];
  const additionalPages = existingPages.filter(page => !/^<diagram\b[^>]*\bid="(?:system-overview|ai-overview)"/.test(page));
  xml = xml.replace('</mxfile>', additionalPages.join('\n') + '</mxfile>');
}
const match = xml.match(/<mxfile[\s\S]*?<\/mxfile>|<mxGraphModel[\s\S]*?<\/mxGraphModel>/);
if (match && xml.trim() !== match[0]) xml = match[0];
xml = xml.replace(/="([^"]*)"/g, (_, value) => '="' + value.replace(/</g, '&lt;').replace(/&(?!(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;') + '"');
xml = xml.replace(/<mxCell id="([^"]+)" parent="\1"\s*\/>/g, '<mxCell id="$1" parent="0"/>');
fs.mkdirSync(path.dirname(output), { recursive: true });
if (!fs.existsSync(output) || process.argv.includes('--regenerate')) fs.writeFileSync(output, xml, 'utf8');
else if (fs.readFileSync(output, 'utf8') !== xml) throw new Error('Diagram has manual edits; preserve them.');
const svg = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="1770" height="1440" viewBox="0 0 1770 1440">',
  '<rect width="1770" height="1440" fill="white"/>',
  '<g font-family="Times New Roman,serif" font-size="23" fill="#172334">',
  '<rect x="210" y="55" width="1160" height="1330" fill="white" stroke="#64748b" stroke-width="1.2"/>',
  '<text x="790" y="105" text-anchor="middle" font-size="28" font-weight="bold">YEAHBUDDY FITNESS — MODULE AI</text>',
];
for (const [source, target] of associations) {
  const actor = actors.find(([id]) => id === source);
  const uc = useCases.find(([id]) => id === target);
  const left = source === 'trainee';
  svg.push(`<path d="M${actor[2] + (left ? 70 : 0)},${actor[3] + 55} L${uc[3] + (left ? -185 : 185)},${uc[4]}" fill="none" stroke="#64748b" stroke-width="1.1"/>`);
}
for (const [, code, label, cx, cy, color] of useCases) {
  svg.push(`<ellipse cx="${cx}" cy="${cy}" rx="185" ry="52" fill="${color}" stroke="#64748b" stroke-width="1.2"/>`);
  const lines = [code, ...label.split('<br>')];
  lines.forEach((line, index) => svg.push(`<text x="${cx}" y="${cy - (lines.length - 1) * 13 + index * 26 + 7}" text-anchor="middle">${escape(line)}</text>`));
}
for (const [id, label, x, y] of actors) {
  const cx = x + 35;
  svg.push(`<g stroke="#334155" stroke-width="1.4"><circle cx="${cx}" cy="${y + 14}" r="13" fill="white"/><path d="M${cx},${y + 27} V${y + 73} M${x},${y + 47} H${x + 70} M${cx},${y + 73} L${x + 7},${y + 110} M${cx},${y + 73} L${x + 63},${y + 110}" fill="none"/></g>`);
  const left = id === 'trainee';
  label.split('<br>').forEach((line, index) => svg.push(`<text x="${left ? cx : x + 86}" y="${y + (left ? 138 : 48) + index * 27}" text-anchor="${left ? 'middle' : 'start'}">${escape(line)}</text>`));
}
svg.push('</g></svg>');
const previewIndex = process.argv.indexOf('--preview-dir');
if (previewIndex !== -1) {
  if (!process.argv[previewIndex + 1]) throw new Error('Preview directory is required');
  const previewDir = path.resolve(process.argv[previewIndex + 1]);
  fs.mkdirSync(previewDir, { recursive: true });
  Promise.all([
    require('sharp')(Buffer.from(overview.svg)).png().toFile(path.join(previewDir, 'system-overview.png')),
    require('sharp')(Buffer.from(svg.join('\n'))).png().toFile(path.join(previewDir, 'ai-overview.png')),
  ]).then(() => console.log('Temporary QA images rendered.')).catch(error => { console.error(error); process.exitCode = 1; });
}
console.log(output);
