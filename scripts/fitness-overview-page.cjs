const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const colors = { base: '#f3f4f6', shared: '#edf0fb', trainee: '#e7f4ed', coach: '#fff0dc' };
const cases = [
  [
    "register",
    "UC01",
    "Đăng ký tài khoản",
    790,
    170,
    "base"
  ],
  [
    "login",
    "UC02",
    "Đăng nhập",
    790,
    310,
    "base"
  ],
  [
    "ai01",
    "AI-UC01",
    "Tư vấn fitness cá nhân hóa",
    790,
    480,
    "shared"
  ],
  [
    "ai02",
    "AI-UC02",
    "Tạo chương trình tập luyện<br>bằng AI",
    790,
    620,
    "shared"
  ],
  [
    "ai06",
    "AI-UC06",
    "Phân tích và điều chỉnh<br>giáo án với AI Agent",
    790,
    760,
    "shared"
  ],
  [
    "logs",
    "UC03",
    "Thực hiện và ghi nhật ký<br>tập luyện (Workout log)",
    440,
    960,
    "base"
  ],
  [
    "meals",
    "UC04",
    "Ghi nhật ký ăn uống<br>(Meal log)",
    440,
    1140,
    "base"
  ],
  [
    "ai03",
    "AI-UC03",
    "Tạo buổi tập bằng AI",
    440,
    1320,
    "trainee"
  ],
  [
    "ai04",
    "AI-UC04",
    "Lập thực đơn cá nhân hóa<br>bằng AI",
    440,
    1500,
    "trainee"
  ],
  [
    "ai05",
    "AI-UC05",
    "Phân tích dinh dưỡng<br>và gợi ý cải thiện",
    440,
    1680,
    "trainee"
  ],
  [
    "ai07",
    "AI-UC07",
    "Phân tích tiến độ học viên<br>bằng AI",
    1130,
    960,
    "coach"
  ],
  [
    "ai08",
    "AI-UC08",
    "Rà soát học viên và lập<br>báo cáo bằng AI Agent",
    1130,
    1140,
    "coach"
  ],
  [
    "ai09",
    "AI-UC09",
    "Số hóa giáo án từ hình ảnh",
    1130,
    1320,
    "coach"
  ]
];
const actors = [["visitor","Khách truy cập",65,185],["trainee","Học viên<br>(Trainee)",65,800],["coach","Huấn luyện viên<br>(Coach)",1460,800]];
const edges = [
  [
    "visitor",
    "register"
  ],
  [
    "visitor",
    "login"
  ],
  [
    "trainee",
    "ai01"
  ],
  [
    "trainee",
    "ai02"
  ],
  [
    "trainee",
    "ai06"
  ],
  [
    "trainee",
    "logs"
  ],
  [
    "trainee",
    "meals"
  ],
  [
    "trainee",
    "ai03"
  ],
  [
    "trainee",
    "ai04"
  ],
  [
    "trainee",
    "ai05"
  ],
  [
    "coach",
    "ai01"
  ],
  [
    "coach",
    "ai02"
  ],
  [
    "coach",
    "ai06"
  ],
  [
    "coach",
    "ai07"
  ],
  [
    "coach",
    "ai08"
  ],
  [
    "coach",
    "ai09"
  ]
];
module.exports = function buildOverview() {
  const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
  const svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1770" height="1830" viewBox="0 0 1770 1830"><rect width="1770" height="1830" fill="white"/><g font-family="Times New Roman,serif" font-size="23" fill="#172334">'];
  function vertex(id, value, x, y, w, h, style, parent = '1') {
    cells.push(`<mxCell id="${id}" value="${esc(value)}" style="html=1;fontFamily=Times New Roman;fontSize=23;fontColor=#172334;${style}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
  }
  const title = 'YEAHBUDDY FITNESS — USE CASE TỔNG QUAN';
  vertex('boundary', title, 210, 55, 1160, 1720, 'rounded=0;container=1;collapsible=0;fillColor=#ffffff;strokeColor=#64748b;strokeWidth=1.2;verticalAlign=top;spacingTop=22;fontSize=28;fontStyle=1;');
  svg.push(`<rect x="210" y="55" width="1160" height="1720" fill="white" stroke="#64748b"/><text x="790" y="105" text-anchor="middle" font-size="28" font-weight="bold">${title}</text>`);
  for (const [id, code, label, cx, cy, kind] of cases) vertex(id, `${code}<br>${label}`, cx - 395, cy - 107, 370, 104, `ellipse;whiteSpace=wrap;fillColor=${colors[kind]};strokeColor=#64748b;strokeWidth=1.2;`, 'boundary');
  for (const [id, label, x, y] of actors) {
    const left = ['trainee', 'visitor'].includes(id);
    vertex(id, label, x, y, 70, 110, 'shape=umlActor;whiteSpace=wrap;fillColor=#ffffff;strokeColor=#334155;strokeWidth=1.4;' + (left ? 'verticalLabelPosition=bottom;verticalAlign=top;align=center;labelWidth=170;' : 'labelPosition=right;verticalLabelPosition=middle;verticalAlign=middle;align=left;spacingLeft=16;labelWidth=210;'));
  }
  edges.forEach(([source, target], i) => {
    const left = ['trainee', 'visitor'].includes(source);
    cells.push(`<mxCell id="association-${i + 1}" style="html=1;endArrow=none;startArrow=none;rounded=0;strokeColor=#64748b;strokeWidth=1.1;exitX=${left ? 1 : 0};exitY=0.5;exitPerimeter=0;entryX=${left ? 0 : 1};entryY=0.5;entryPerimeter=0;" edge="1" source="${source}" target="${target}" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>`);
    const a = actors.find(v => v[0] === source), uc = cases.find(v => v[0] === target);
    if (!a || !uc) throw new Error('Invalid overview association');
    svg.push(`<path d="M${a[2] + (left ? 70 : 0)},${a[3] + 55} L${uc[3] + (left ? -185 : 185)},${uc[4]}" fill="none" stroke="#64748b" stroke-width="1.1"/>`);
  });
  for (const [, code, label, cx, cy, kind] of cases) {
    svg.push(`<ellipse cx="${cx}" cy="${cy}" rx="185" ry="52" fill="${colors[kind]}" stroke="#64748b" stroke-width="1.2"/>`);
    const lines = [code, ...label.split('<br>')];
    lines.forEach((line, i) => svg.push(`<text x="${cx}" y="${cy - (lines.length - 1) * 13 + i * 26 + 7}" text-anchor="middle">${esc(line)}</text>`));
  }
  for (const [id, label, x, y] of actors) {
    const cx = x + 35, left = ['trainee', 'visitor'].includes(id);
    svg.push(`<g stroke="#334155" stroke-width="1.4"><circle cx="${cx}" cy="${y + 14}" r="13" fill="white"/><path d="M${cx},${y + 27} V${y + 73} M${x},${y + 47} H${x + 70} M${cx},${y + 73} L${x + 7},${y + 110} M${cx},${y + 73} L${x + 63},${y + 110}" fill="none"/></g>`);
    label.split('<br>').forEach((line, i) => svg.push(`<text x="${left ? cx : x + 86}" y="${y + (left ? 138 : 48) + i * 27}" text-anchor="${left ? 'middle' : 'start'}">${esc(line)}</text>`));
  }
  svg.push('</g></svg>');
  return { xml: `<diagram id="system-overview" name="01 - Tổng quan hệ thống"><mxGraphModel adaptiveColors="auto" grid="1" page="1" pageWidth="1770" pageHeight="1830" background="#ffffff"><root>${cells.join('\n')}</root></mxGraphModel></diagram>`, svg: svg.join('\n') };
};
