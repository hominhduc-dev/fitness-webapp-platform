// Read-only schema documentation. Run from the repository root.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const sourceRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, '.pr-worktrees/complete-ai-validation');
const schemaPath = path.join(sourceRoot, 'backend/prisma/schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');
const { Prisma } = require(path.join(sourceRoot, 'backend/node_modules/@prisma/client'));
const { instance } = require(path.join(root, '.pr-worktrees/erd-tools/node_modules/@viz-js/viz'));
const out = __dirname;
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const groups = [
  { id: 'identity', name: 'Danh tính', color: '#3859bc', models: ['User'] },
  { id: 'library', name: 'Thư viện & vùng cơ', color: '#087d7e', models: ['Exercise', 'Variation', 'MuscleRegion', 'VariationMuscleTarget'] },
  { id: 'planning', name: 'Chương trình & buổi tập', color: '#6550b7', models: ['Program', 'ProgramAssignment', 'Workout', 'WorkoutExercise', 'ExerciseSet'] },
  { id: 'history', name: 'Lịch sử & bình luận', color: '#9a5b19', models: ['WorkoutLog', 'WorkoutLogComment'] },
  { id: 'nutrition', name: 'Dinh dưỡng', color: '#247549', models: ['Food', 'Meal', 'MealFoodItem'] },
  { id: 'coaching', name: 'Huấn luyện & thể trạng', color: '#ad416b', models: ['CoachRequest', 'CoachCheckIn', 'BodyMetricEntry'] },
  { id: 'operations', name: 'AI & quản trị', color: '#536679', models: ['AIGeneration', 'Notification', 'AdminAuditLog', 'ExerciseImportRequest'] },
];
const modelNames = [...schema.matchAll(/^model (\w+) \{/gm)].map(m => m[1]);
if (JSON.stringify(modelNames) !== JSON.stringify(Prisma.dmmf.datamodel.models.map(m => m.name))) throw Error('Prisma client and schema model lists differ; generate client first');
const models = Prisma.dmmf.datamodel.models.map(m => {
  const block = schema.match(new RegExp('model ' + m.name + ' \\{([\\s\\S]*?)\\n\\}'))[1];
  const fields = m.fields.filter(f => f.kind !== 'object');
  const declarations = block.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('@@') && !l.startsWith('//'));
  for (const f of fields) if (!declarations.some(l => l.startsWith(f.name + ' ') && l.split(/\s+/)[1] === f.type + (f.isList ? '[]' : !f.isRequired ? '?' : ''))) throw Error('Stale generated field: ' + m.name + '.' + f.name);
  return { ...m, fields, relations: m.fields.filter(f => f.kind === 'object' && f.relationFromFields.length), constraints: block.split('\n').map(l => l.trim()).filter(l => l.startsWith('@@')), line: schema.slice(0, schema.indexOf('model ' + m.name + ' {')).split('\n').length, group: groups.find(g => g.models.includes(m.name)).id };
});
if (groups.flatMap(g => g.models).length !== models.length) throw Error('Group coverage mismatch');
const edges = models.flatMap(m => m.relations.map(r => ({ child: m.name, parent: r.type, fields: r.relationFromFields, references: r.relationToFields, optional: !r.isRequired, onDelete: r.relationOnDelete, name: r.name })));
const logical = [
  { child: 'WorkoutLog', parent: 'Program', field: 'programId' },
  { child: 'AIGeneration', parent: 'Program', field: 'programId' },
];
const metadata = { source: 'backend/prisma/schema.prisma', revision: require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim(), schemaSha256: crypto.createHash('sha256').update(schema).digest('hex'), models, enums: Prisma.dmmf.datamodel.enums, edges, logical, groups };
fs.writeFileSync(path.join(out, 'schema-metadata.json'), JSON.stringify(metadata, null, 2));
fs.writeFileSync(path.join(out, 'schema.snapshot.prisma'), schema);
const primary = m => m.fields.filter(f => f.isId || m.primaryKey?.fields.includes(f.name)).map(f => f.name);
const keys = (m, f) => [primary(m).includes(f.name) ? 'PK' : '', m.relations.some(r => r.relationFromFields.includes(f.name)) ? 'FK' : '', f.isUnique ? 'UK' : ''].filter(Boolean).join(', ');
const typeName = f => (f.nativeType?.[0] || f.type) + (f.isList ? '[]' : '') + (!f.isRequired ? '?' : '');
function dotFor(selected, detailed, owned = selected) {
  let dot = 'digraph ERD { graph [rankdir=LR, bgcolor="transparent", nodesep=0.42, ranksep=1.2, pad=0.35, splines=spline, outputorder=edgesfirst]; node [shape=plain, fontname="Arial"]; edge [fontname="Arial", fontsize=10, color="#8190a9", penwidth=1.3, arrowsize=0.7];\n';
  for (const m of models.filter(m => selected.includes(m.name))) {
    const color = groups.find(g => g.id === m.group).color;
    const columns = detailed && owned.includes(m.name) ? m.fields : m.fields.filter(f => keys(m, f) || ['name', 'type', 'status', 'role', 'programId'].includes(f.name));
    const rows = columns.map(f => `<TR><TD ALIGN="LEFT" PORT="${f.name}" BGCOLOR="${keys(m, f) ? '#f0f4fa' : '#ffffff'}"><FONT COLOR="#243653">${esc(keys(m, f) || '·')}</FONT></TD><TD ALIGN="LEFT"><FONT COLOR="#172640">${esc(f.name)}</FONT></TD><TD ALIGN="LEFT" PORT="${f.name}_out"><FONT COLOR="#5e6d84">${esc(typeName(f))}</FONT></TD></TR>`).join('');
    dot += `"${m.name}" [id="entity-${m.name}", label=<<TABLE BGCOLOR="white" BORDER="1" COLOR="#cbd5e1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="6"><TR><TD COLSPAN="3" BGCOLOR="${color}" PORT="head"><FONT COLOR="white" POINT-SIZE="16"><B>${m.name}</B></FONT></TD></TR>${rows}${m.constraints.filter(c => /^@@(unique|id)/.test(c)).map(c => `<TR><TD COLSPAN="3" BGCOLOR="#eaf0fa"><FONT COLOR="#385179" POINT-SIZE="10">${esc(c)}</FONT></TD></TR>`).join('')}<TR><TD COLSPAN="3" BGCOLOR="#f5f7fb"><FONT COLOR="#5e6d84" POINT-SIZE="10">${m.fields.length} cột · ${esc(groups.find(g => g.id === m.group).name)}</FONT></TD></TR></TABLE>>];\n`;
  }
  for (const e of edges.filter(e => selected.includes(e.child) && selected.includes(e.parent))) {
    dot += `"${e.child}":"${e.fields[0]}_out":e -> "${e.parent}":"${e.references[0]}${e.child === e.parent ? '_out' : ''}":${e.child === e.parent ? 'e' : 'w'} [id="fk-${e.child}-${e.name}", dir=both, arrowtail="crowodot", arrowhead="${e.optional ? 'teeodot' : 'teetee'}", tooltip="${e.child}.${e.fields.join(',')} → ${e.parent}.${e.references.join(',')} | ${e.optional ? '0..1' : '1'} cha; 0..N con | onDelete: ${e.onDelete}"];\n`;
  }
  for (const e of logical.filter(e => selected.includes(e.child) && selected.includes(e.parent))) dot += `"${e.child}":"${e.field}_out":e -> "${e.parent}":"id":w [id="logical-${e.child}", style=dashed, color="#c17b18", arrowhead=vee, constraint=false, tooltip="${e.child}.${e.field}: tham chiếu logic, KHÔNG có FK trong Prisma"];\n`;
  return dot + '}';
}
async function main() {
  const viz = await instance();
  const views = [{ id: 'all', name: 'Toàn hệ thống · khóa', selected: modelNames, detailed: false }, { id: 'columns', name: 'Toàn hệ thống · mọi cột', selected: modelNames, detailed: true }];
  for (const g of groups.filter(g => g.id !== 'identity')) {
    const refs = [...edges, ...logical].filter(e => g.models.includes(e.child)).map(e => e.parent);
    views.push({ id: g.id, name: g.name, owned: g.models, selected: [...new Set([...g.models, ...refs])], detailed: true });
  }
  for (const view of views) {
    const dot = dotFor(view.selected, view.detailed, view.owned);
    const result = viz.render(dot, { format: 'svg', engine: 'dot' });
    if (result.status !== 'success' || result.errors?.some(e => e.level === 'error')) throw Error(JSON.stringify(result.errors));
    const svg = result.output.slice(result.output.indexOf('<svg'));
    view.svg = svg;
    fs.writeFileSync(path.join(out, `${view.id}.svg`), svg);
    fs.writeFileSync(path.join(out, `${view.id}.dot`), dot);
  }
  let mermaid = 'erDiagram\n';
  for (const m of models) {
    mermaid += `  ${m.name} {\n`;
    for (const f of m.fields) mermaid += `    ${f.type}${f.isList ? 'Array' : ''} ${f.name} ${keys(m, f)} "${!f.isRequired ? 'nullable; ' : ''}${f.nativeType?.[0] || f.kind}"\n`;
    mermaid += '  }\n';
  }
  for (const e of edges) mermaid += `  ${e.parent} ${e.optional ? '|o' : '||'}..o{ ${e.child} : "${e.fields.join(',')}"\n`;
  fs.writeFileSync(path.join(out, 'full-erd.mmd'), mermaid);
  const template = fs.readFileSync(path.join(out, 'viewer.template.html'), 'utf8');
  const payload = JSON.stringify({ ...metadata, views }).replaceAll('<', '\\u003c');
  fs.writeFileSync(path.join(out, 'index.html'), template.replace('/*PAYLOAD*/', payload));
  fs.writeFileSync(path.join(out, 'coverage.json'), JSON.stringify({ schemaSha256: metadata.schemaSha256, revision: metadata.revision, models: models.length, scalarAndEnumColumns: models.reduce((n, m) => n + m.fields.length, 0), foreignKeys: edges.length, logicalProgramReferences: logical.length, enums: metadata.enums.length, views: views.map(v => ({ id: v.id, entities: v.selected.length })), checks: { allSchemaModelsRepresented: modelNames.every(n => models.some(m => m.name === n)), allRelationEndpointsExist: edges.every(e => modelNames.includes(e.child) && modelNames.includes(e.parent)), uniqueEntityNames: new Set(modelNames).size === models.length }, renderer: '@viz-js/viz@3.30.0', note: 'Coverage checks, not Archify showcase or browser checks.' }, null, 2));
  console.log(JSON.stringify({ models: models.length, columns: models.reduce((n, m) => n + m.fields.length, 0), foreignKeys: edges.length, views: views.length }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });


