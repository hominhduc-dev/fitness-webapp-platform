const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, '../docs/fitness-platform-diagram.drawio');
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const specifications = [
  {
    code: 'AI-UC01', title: 'Tư vấn fitness cá nhân hóa', roles: ['trainee', 'coach'],
    includes: ['Tiếp nhận câu hỏi và<br>ngữ cảnh hội thoại', 'Xử lý yêu cầu tư vấn<br>tập luyện, dinh dưỡng', 'Trình bày câu trả lời<br>và giải thích'],
    extras: [
      { label: 'Tra cứu dữ liệu cá nhân', condition: 'Trainee; câu hỏi cần dữ liệu thực tế', roles: ['trainee'] },
      { label: 'Tạo bản nháp chương trình AI', condition: 'Trainee yêu cầu; tham chiếu AI-UC02', roles: ['trainee'] },
      { label: 'Tạo bản nháp thực đơn AI', condition: 'Trainee yêu cầu; tham chiếu AI-UC04', roles: ['trainee'] },
    ],
    note: 'Chat thường của coach không có bộ công cụ đọc dữ liệu học viên. Bản nháp tạo qua chat vẫn cần xác nhận riêng trước khi áp dụng.',
  },
  {
    code: 'AI-UC02', title: 'Cá nhân hóa chương trình tập luyện', roles: ['trainee', 'coach'],
    includes: ['Xác định mục tiêu và<br>điều kiện tập luyện', 'Tạo chương trình phù hợp<br>từ thư viện bài tập', 'Kiểm tra và trình bày<br>bản nháp chương trình'],
    extras: [{ label: 'Xác nhận và lưu chương trình', condition: 'Người dùng chấp nhận bản nháp', roles: ['trainee', 'coach'] }],
    note: 'Trainee tạo cho bản thân; coach tạo cho học viên thuộc mình. Tạo bản nháp chưa đồng nghĩa đã tạo và gán giáo án sử dụng.',
  },
  {
    code: 'AI-UC03', title: 'Tạo buổi tập bằng AI', roles: ['trainee'],
    includes: ['Xác định mục tiêu, thời gian,<br>thiết bị và mức năng lượng', 'Kết hợp lịch sử tập luyện<br>và ngữ cảnh phục hồi', 'Tạo và trình bày<br>buổi tập đề xuất'],
    extras: [{ label: 'Xác nhận và lưu buổi tập', condition: 'Trainee chấp nhận bản nháp', roles: ['trainee'] }],
    note: 'AI đề xuất bài tập và thông số cho một buổi. Kết quả được kiểm tra trước khi hiển thị; chỉ lưu buổi tập sử dụng sau khi xác nhận.',
  },
  {
    code: 'AI-UC04', title: 'Cá nhân hóa kế hoạch dinh dưỡng', roles: ['trainee'],
    includes: ['Xác định mục tiêu dinh dưỡng<br>và điều kiện ăn uống', 'Chọn món từ catalog<br>và cân đối khẩu phần', 'Trình bày thực đơn dự thảo<br>và danh sách mua sắm'],
    extras: [
      { label: 'Tạo lại một bữa ăn', condition: 'Muốn thay bữa trong bản nháp', roles: ['trainee'] },
      { label: 'Chỉnh khẩu phần dự thảo', condition: 'Trainee muốn thay đổi lượng ăn', roles: ['trainee'] },
      { label: 'Xác nhận và lưu kế hoạch ăn', condition: 'Chấp nhận thực đơn', roles: ['trainee'] },
      { label: 'Bỏ bản nháp thực đơn', condition: 'Không muốn sử dụng bản nháp', roles: ['trainee'] },
    ],
    note: 'Backend tính dinh dưỡng và kiểm tra mục tiêu. Xác nhận lưu bữa ăn ở trạng thái planned; không tự ghi thành nhật ký đã ăn.',
  },
  {
    code: 'AI-UC05', title: 'Phân tích dinh dưỡng và gợi ý cải thiện', roles: ['trainee'],
    includes: ['Tổng hợp nhật ký ăn uống<br>theo ngày và tuần', 'Đánh giá thiếu hoặc dư chất<br>so với mục tiêu', 'Diễn giải kết quả và<br>gợi ý thực phẩm phù hợp'],
    extras: [{ label: 'Xem phân tích đã lưu', independent: true, roles: ['trainee'] }],
    note: 'Backend tính số liệu và các phát hiện; LLM diễn giải. Xem báo cáo đã lưu không bắt buộc gọi AI. Khi dữ liệu đổi, trainee có thể yêu cầu phân tích mới.',
  },
  {
    code: 'AI-UC06', title: 'Phân tích và điều chỉnh giáo án với AI Agent', roles: ['trainee', 'coach'],
    includes: ['Đọc dữ liệu và giáo án<br>trong phạm vi được phép', 'Phân tích bằng chứng<br>và đề xuất điều chỉnh', 'Trình bày bản xem trước<br>các thay đổi giáo án'],
    extras: [
      { label: 'Phê duyệt và áp dụng điều chỉnh', condition: 'Đồng ý; giáo án vẫn hợp lệ', roles: ['trainee', 'coach'] },
      { label: 'Từ chối đề xuất điều chỉnh', condition: 'Không đồng ý với đề xuất', roles: ['trainee', 'coach'] },
      { label: 'Yêu cầu hoàn tác điều chỉnh', condition: 'Đã áp dụng; chưa có sửa đổi mới', roles: ['trainee', 'coach'] },
    ],
    extraInclude: { source: 2, label: 'Xem trước và quyết định<br>bản hoàn tác' },
    note: 'Chỉ sửa giáo án do tác nhân sở hữu, gán riêng cho một học viên; không sửa set hoàn tất hoặc giáo án có phiên tập đang mở. Hoàn tác cũng cần phê duyệt.',
  },
  {
    code: 'AI-UC07', title: 'Phân tích dữ liệu học viên hỗ trợ coach ra quyết định', roles: ['coach'],
    includes: ['Tổng hợp dữ liệu học viên<br>trong kỳ phân tích', 'So sánh kỳ hiện tại<br>với kỳ trước', 'Tạo và lưu báo cáo AI<br>kèm gợi ý cải thiện'],
    extras: [{ label: 'Xem báo cáo học viên đã lưu', independent: true, roles: ['coach'] }],
    note: 'Chỉ phân tích học viên thuộc coach. Báo cáo sử dụng số liệu backend tính sẵn, không tự sửa giáo án hoặc thực đơn. Phân tích lại là một lượt thực hiện mới.',
  },
  {
    code: 'AI-UC08', title: 'Rà soát học viên và lập báo cáo bằng AI Agent', roles: ['coach'],
    includes: ['Xác định danh sách<br>học viên thuộc coach', 'Đối chiếu tiến bộ và phục hồi<br>theo từng trang dữ liệu', 'Tổng hợp báo cáo, phạm vi<br>và mức ưu tiên theo dõi'],
    extras: [
      { label: 'Bật hoặc tắt lịch báo cáo tuần', independent: true, roles: ['coach'] },
      { label: 'Soạn ghi chú theo dõi học viên', condition: 'Coach yêu cầu ghi chú sau rà soát', roles: ['coach'] },
      { label: 'Phê duyệt và lưu ghi chú', condition: 'Coach chấp nhận bản nháp ghi chú', targetExtra: 1, roles: ['coach'] },
    ],
    note: 'Rà soát theo yêu cầu hoặc theo lịch đã bật; cần worker hoạt động. Báo cáo tuần mặc định chỉ báo cáo, không tự chỉnh giáo án hoặc lưu ghi chú.',
  },
  {
    code: 'AI-UC09', title: 'Số hóa giáo án từ hình ảnh', roles: ['coach'],
    includes: ['Trích xuất giáo án<br>từ ảnh bằng vision', 'Đối chiếu tên bài tập<br>với thư viện hiện có', 'Trình bày bản nháp<br>để coach rà soát'],
    extras: [
      { label: 'Chọn lại bài tập chưa khớp', condition: 'Có bài không nhận diện được', roles: ['coach'] },
      { label: 'Sửa thông số nhận dạng', condition: 'Nội dung trích xuất cần hiệu chỉnh', roles: ['coach'] },
      { label: 'Xác nhận tạo giáo án', condition: 'Coach chấp nhận bản nháp', roles: ['coach'] },
    ],
    note: 'Khớp chính xác bằng code; chỉ nhờ text model chọn ứng viên khi cần. Vision tạo bản nháp, coach kiểm tra và xác nhận mới tạo giáo án.',
  },
];

function build(spec, index) {
  const height = Math.max(1160, 670 + spec.extras.length * 230);
  const title = `${spec.code} — ${spec.title}`;
  const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="1700" height="${height}"><rect width="1700" height="${height}" fill="white"/><g font-family="Times New Roman,serif" font-size="22" fill="#172334">`, `<rect x="245" y="45" width="1330" height="${height - 100}" fill="white" stroke="#64748b"/><text x="910" y="95" font-size="25" text-anchor="middle" font-weight="bold">${esc(title)}</text>`];
  function vertex(id, label, x, y, w, h, style, parent = '1') {
    cells.push(`<mxCell id="${id}" value="${esc(label)}" style="html=1;fontFamily=Times New Roman;fontSize=22;fontColor=#172334;${style}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
  }
  vertex('system', title, 245, 45, 1330, height - 100, 'rounded=0;container=1;collapsible=0;verticalAlign=top;spacingTop=20;fontSize=25;fontStyle=1;fillColor=#ffffff;strokeColor=#64748b;');
  const nodes = new Map();
  function wrapLabel(value) {
    return value.split('<br>').flatMap(part => {
      const lines = []; let line = '';
      for (const word of part.split(' ')) {
        if ((line + ' ' + word).trim().length > 33 && line) { lines.push(line); line = ''; }
        line = (line + ' ' + word).trim();
      }
      if (line) lines.push(line);
      return lines;
    }).join('<br>');
  }
  function oval(id, label, cx, cy, color, condition) {
    label = wrapLabel(label);
    const html = condition ? `${label}<br><font style="font-size:17px">[${condition}]</font>` : label;
    vertex(id, html, cx - 200 - 245, cy - 60 - 45, 400, 120, `ellipse;whiteSpace=wrap;fillColor=${color};strokeColor=#64748b;`, 'system');
    nodes.set(id, { cx, cy, label, color, condition });
  }
  oval('main', `${spec.code}<br>${spec.title}`, 620, 260, '#edf0fb');
  spec.includes.forEach((label, i) => oval(`include-${i}`, label, 1230, 200 + i * 195, '#fff0dc'));
  spec.extras.forEach((extra, i) => oval(`extra-${i}`, extra.label, 620, 550 + i * 230, extra.independent ? '#f3f4f6' : '#e7f4ed', extra.condition));
  if (spec.extraInclude) oval('undo-approval', spec.extraInclude.label, 1230, 1010, '#fff0dc');
  const actors = new Map();
  spec.roles.forEach((role, i) => {
    const y = spec.roles.length === 1 ? 225 : 175 + i * 215;
    const label = role === 'trainee' ? 'Học viên<br>(Trainee)' : 'Huấn luyện viên<br>(Coach)';
    vertex(role, label, 85, y, 70, 110, 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;align=center;labelWidth=180;whiteSpace=wrap;fillColor=#ffffff;strokeColor=#334155;');
    actors.set(role, { x: 155, y: y + 55, label, top: y });
  });
  let edgeCount = 0;
  const renderedEdges = [];
  function edge(source, target, type, options = {}) {
    const isActor = actors.has(source);
    const a = isActor ? actors.get(source) : nodes.get(source), b = nodes.get(target);
    const label = type === 'association' ? '' : `«${type}»`;
    const sx = isActor ? a.x : a.cx + (type === 'include' ? 200 : -200);
    const sy = isActor ? a.y : a.cy;
    const tx = b.cx - 200, ty = b.cy;
    const points = options.route ? [{ x: options.route, y: sy }, { x: options.route, y: ty }] : [];
    const style = `html=1;fontFamily=Times New Roman;fontSize=18;fontColor=#475569;strokeColor=#64748b;strokeWidth=1.1;endArrow=${label ? 'open' : 'none'};endFill=0;startArrow=none;dashed=${label ? 1 : 0};rounded=0;exitX=${isActor || type === 'include' ? 1 : 0};exitY=0.5;exitPerimeter=0;entryX=0;entryY=0.5;entryPerimeter=0;labelBackgroundColor=#ffffff;`;
    const geometry = `<mxGeometry relative="1" as="geometry">${points.length ? `<Array as="points">${points.map(p => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('')}</Array>` : ''}</mxGeometry>`;
    cells.push(`<mxCell id="edge-${++edgeCount}" value="${esc(label)}" style="${style}" edge="1" source="${source}" target="${target}" parent="1">${geometry}</mxCell>`);
    renderedEdges.push({ sx, sy, tx, ty, points, label });
  }
  for (const role of spec.roles) edge(role, 'main', 'association');
  spec.includes.forEach((_, i) => edge('main', `include-${i}`, 'include'));
  spec.extras.forEach((extra, i) => {
    for (const role of extra.roles ?? []) edge(role, `extra-${i}`, 'association');
    if (!extra.independent) edge(`extra-${i}`, extra.targetExtra === undefined ? 'main' : `extra-${extra.targetExtra}`, 'extend', { route: 290 + i * 30 });
  });
  if (spec.extraInclude) edge(`extra-${spec.extraInclude.source}`, 'undo-approval', 'include');
  vertex('scope', spec.note, 65, height - 220, 1200, 110, 'text;whiteSpace=wrap;strokeColor=none;fillColor=none;fontSize=20;align=left;verticalAlign=middle;', 'system');
  for (const e of renderedEdges) {
    const points = [{ x: e.sx, y: e.sy }, ...e.points, { x: e.tx, y: e.ty }];
    svg.push(`<path d="${points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')}" fill="none" stroke="#64748b" stroke-width="1.1"${e.label ? ' stroke-dasharray="5 4"' : ''}/>`);
    if (e.label) {
      const previous = points[points.length - 2];
      const dx = e.tx - previous.x, dy = e.ty - previous.y, len = Math.hypot(dx, dy);
      svg.push(`<path d="M${e.tx - 11 * dx / len + 5 * dy / len},${e.ty - 11 * dy / len - 5 * dx / len} L${e.tx},${e.ty} L${e.tx - 11 * dx / len - 5 * dy / len},${e.ty - 11 * dy / len + 5 * dx / len}" fill="none" stroke="#64748b"/>`);
      const lx = e.points.length ? (e.sx + e.points[0].x) / 2 : (e.sx + e.tx) / 2;
      const ly = e.points.length ? e.sy - 8 : (e.sy + e.ty) / 2 - 8;
      svg.push(`<rect x="${lx - 42}" y="${ly - 16}" width="84" height="22" fill="white"/><text x="${lx}" y="${ly}" font-size="18" text-anchor="middle">${esc(e.label)}</text>`);
    }
  }
  for (const node of nodes.values()) {
    svg.push(`<ellipse cx="${node.cx}" cy="${node.cy}" rx="200" ry="60" fill="${node.color}" stroke="#64748b"/>`);
    const lines = node.label.split('<br>');
    const start = node.cy - (lines.length - 1) * 13 - (node.condition ? 12 : 0);
    lines.forEach((line, i) => svg.push(`<text x="${node.cx}" y="${start + i * 26 + 7}" text-anchor="middle">${esc(line)}</text>`));
    if (node.condition) svg.push(`<text x="${node.cx}" y="${node.cy + 37}" font-size="17" text-anchor="middle">[${esc(node.condition)}]</text>`);
  }
  for (const a of actors.values()) {
    const cx = 120, y = a.top;
    svg.push(`<g fill="none" stroke="#334155"><circle cx="${cx}" cy="${y + 14}" r="13" fill="white"/><path d="M120,${y + 27} V${y + 73} M85,${y + 47} H155 M120,${y + 73} L92,${y + 110} M120,${y + 73} L148,${y + 110}"/></g>`);
    a.label.split('<br>').forEach((line, i) => svg.push(`<text x="120" y="${y + 138 + i * 26}" text-anchor="middle">${esc(line)}</text>`));
  }
  const words = spec.note.split(' '), lines = []; let line = '';
  for (const word of words) { if ((line + word).length > 104) { lines.push(line); line = ''; } line += `${word} `; } if (line) lines.push(line);
  lines.forEach((line, i) => svg.push(`<text x="310" y="${height - 190 + i * 28}" font-size="20">${esc(line)}</text>`));
  svg.push('</g></svg>');
  return { id: `${spec.code.toLowerCase()}-detail`, xml: `<diagram id="${spec.code.toLowerCase()}-detail" name="${String(index + 3).padStart(2, '0')} - ${spec.code}"><mxGraphModel adaptiveColors="auto" grid="1" gridSize="10" page="1" pageScale="1" pageWidth="1700" pageHeight="${height}" background="#ffffff"><root>${cells.join('\n')}</root></mxGraphModel></diagram>`, svg: svg.join('\n') };
}
async function main() {
  let original = fs.readFileSync(file, 'utf8');
  if (!original.trim().endsWith('</mxfile>')) throw new Error('Expected a valid mxfile');
  const pages = specifications.filter(spec => ["AI-UC02","AI-UC04","AI-UC06","AI-UC07"].includes(spec.code)).map(build);
  for (const page of pages) if (original.includes(`id="${page.id}"`)) {
    if (!process.argv.includes('--replace-details')) throw new Error(`${page.id} already exists; preserve existing pages`);
    original = original.replace(new RegExp(`<diagram\\b[^>]*\\bid="${page.id}"[^>]*>[\\s\\S]*?<\\/diagram>`), '');
  }
  let additions = pages.map(p => p.xml).join('\n');
  additions = additions.replace(/="([^"]*)"/g, (_, value) => '="' + value.replace(/</g, '&lt;').replace(/&(?!(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;') + '"');
  additions = additions.replace(/<mxCell id="([^"]+)" parent="\1"\s*\/>/g, '<mxCell id="$1" parent="0"/>');
  fs.writeFileSync(file, original.replace(/<\/mxfile>\s*$/, `${additions}\n</mxfile>`));
  const previewIndex = process.argv.indexOf('--preview-dir');
  if (previewIndex !== -1) {
    if (!process.argv[previewIndex + 1]) throw new Error('Missing preview directory');
    const dir = path.resolve(process.argv[previewIndex + 1]); fs.mkdirSync(dir, { recursive: true });
    for (const page of pages) await require('sharp')(Buffer.from(page.svg)).png().toFile(path.join(dir, `${page.id}.png`));
  }
  console.log('Updated 4 selected detailed pages; other pages preserved.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
