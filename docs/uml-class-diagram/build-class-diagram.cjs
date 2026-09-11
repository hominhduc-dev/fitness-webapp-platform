const fs = require('fs')
const path = require('path')

const out = __dirname
const vizPath = path.resolve(__dirname, '../../.pr-worktrees/erd-tools/node_modules/@viz-js/viz')
const { instance } = require(vizPath)

const classes = [
  { id: 'NextAppRouter', group: 'presentation', title: 'NextAppRouter', attrs: ['route: AppRouter', 'session: ServerSession'], methods: ['renderShell()', 'proxyBackendRequest()', 'enforceAuthRedirect()'] },
  { id: 'BackendRoutes', group: 'presentation', title: 'BackendRoutes', attrs: ['request: ExpressRequest', 'response: ExpressResponse'], methods: ['registerRoutes()', 'sendData()', 'sendError()', 'sendApiError()'] },
  { id: 'AuthService', group: 'application', title: 'AuthService', attrs: ['supabase: SupabaseClient', 'prisma: PrismaClient', 'profileCache: Map'], methods: ['registerUser()', 'loginUser()', 'refreshAuthSession()', 'requireCurrentProfile()', 'updateCurrentProfile()', 'uploadCurrentProfileAvatar()', 'logoutCurrentSession()'] },
  { id: 'AIService', group: 'application', title: 'AIService', attrs: ['prisma: PrismaClient', 'provider: AIProvider', 'rateLimiter: RateLimiter'], methods: ['generateWorkoutProgram()', 'acceptAIProgram()', 'generateMealPlan()', 'acceptAIMealPlan()', 'buildChatContext()', 'chatWithAI()'] },
  { id: 'NutritionService', group: 'application', title: 'NutritionService', attrs: ['prisma: PrismaClient', 'timezone: string'], methods: ['listNutritionDayForUser()', 'listFoodsForUser()', 'createFoodForUser()', 'addMealItemForUser()', 'recalculateMeal()', 'deleteMealItemForUser()'] },
  { id: 'FitnessDataService', group: 'application', title: 'FitnessDataService', attrs: ['prisma: PrismaClient', 'profile: SerializedProfile'], methods: ['getDashboard()', 'listWorkouts()', 'logWorkout()', 'getProgress()', 'listNotifications()'] },
  { id: 'AdminService', group: 'application', title: 'AdminService', attrs: ['prisma: PrismaClient', 'supabase: SupabaseClient'], methods: ['getAdminDashboard()', 'listAdminUsers()', 'updateAdminUser()', 'reviewExerciseImportRequest()', 'applyExerciseSync()', 'logAdminAudit()'] },
  { id: 'AIProvider', group: 'infrastructure', title: '«interface» AIProvider', attrs: ['model: string'], methods: ['generateStructuredJSON<T>()', 'generateText()'] },
  { id: 'OpenAIProvider', group: 'infrastructure', title: 'OpenAIProvider', attrs: ['client: OpenAI', 'jsonMode: boolean'], methods: ['generateStructuredJSON<T>()', 'generateText()'] },
  { id: 'AnthropicProvider', group: 'infrastructure', title: 'AnthropicProvider', attrs: ['client: Anthropic', 'model: string'], methods: ['generateStructuredJSON<T>()', 'generateText()'] },
  { id: 'PrismaClient', group: 'infrastructure', title: 'PrismaClient', attrs: ['user: UserDelegate', 'program: ProgramDelegate', 'meal: MealDelegate', 'aiGeneration: AIGenerationDelegate'], methods: ['$transaction()', '$connect()', '$disconnect()'] },
  { id: 'SupabaseClient', group: 'infrastructure', title: 'SupabaseClient', attrs: ['auth: AuthClient', 'storage: StorageClient'], methods: ['signInWithPassword()', 'signUp()', 'getUser()', 'refreshSession()', 'upload()'] },
  { id: 'User', group: 'domain', title: 'User', attrs: ['id: UUID', 'email: string', 'role: UserRole', 'coachId?: UUID', 'dailyCalorieGoal: number'], methods: ['ownsResource()', 'isCoach()', 'isAdmin()'] },
  { id: 'Program', group: 'domain', title: 'Program', attrs: ['id: UUID', 'name: string', 'difficulty: ProgramDifficulty', 'createdById: UUID'], methods: ['addWorkout()', 'assignToTrainee()', 'archive()'] },
  { id: 'Workout', group: 'domain', title: 'Workout', attrs: ['id: UUID', 'programId?: UUID', 'scheduledDate?: Date', 'weekIndex?: number'], methods: ['addExercise()', 'reschedule()', 'duplicate()'] },
  { id: 'Meal', group: 'domain', title: 'Meal', attrs: ['id: UUID', 'userId: UUID', 'date: Date', 'type: MealType', 'totalCalories: number'], methods: ['addFoodItem()', 'recalculateTotals()', 'removeFoodItem()'] },
  { id: 'Food', group: 'domain', title: 'Food', attrs: ['id: UUID', 'name: string', 'caloriesPer100g: number', 'proteinPer100g: number'], methods: ['calculateNutrition()', 'isOwnedBy()'] },
  { id: 'AIGeneration', group: 'domain', title: 'AIGeneration', attrs: ['id: UUID', 'userId: UUID', 'type: AIGenerationType', 'status: AIGenerationStatus', 'input: Json', 'output?: Json'], methods: ['markCompleted()', 'markFailed()', 'isAcceptable()'] },
]

const edges = [
  ['NextAppRouter', 'BackendRoutes', 'HTTP / JSON'], ['BackendRoutes', 'AuthService', 'auth endpoints'], ['BackendRoutes', 'AIService', 'AI endpoints'], ['BackendRoutes', 'NutritionService', 'meal endpoints'], ['BackendRoutes', 'FitnessDataService', 'fitness endpoints'], ['BackendRoutes', 'AdminService', 'admin endpoints'],
  ['AuthService', 'SupabaseClient', 'auth / storage'], ['AuthService', 'PrismaClient', 'profile persistence'], ['AIService', 'AIProvider', 'uses'], ['OpenAIProvider', 'AIProvider', 'implements'], ['AnthropicProvider', 'AIProvider', 'implements'], ['AIService', 'PrismaClient', 'generation persistence'], ['NutritionService', 'PrismaClient', 'food / meal queries'], ['FitnessDataService', 'PrismaClient', 'workout queries'], ['AdminService', 'PrismaClient', 'admin queries'], ['AdminService', 'SupabaseClient', 'admin auth'],
  ['PrismaClient', 'User', 'persists'], ['PrismaClient', 'Program', 'persists'], ['PrismaClient', 'Workout', 'persists'], ['PrismaClient', 'Meal', 'persists'], ['PrismaClient', 'Food', 'persists'], ['PrismaClient', 'AIGeneration', 'persists'], ['User', 'Program', 'creates / assigns'], ['Program', 'Workout', 'contains'], ['User', 'Meal', 'owns'], ['Meal', 'Food', 'contains items'], ['User', 'AIGeneration', 'requests'], ['AIService', 'AIGeneration', 'creates / accepts'],
]

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function label(c) {
  const attrs = c.attrs.map(a => `<TR><TD ALIGN="LEFT" BGCOLOR="#f6f8fc">${esc(/^[+#-]/.test(a) ? a : '- ' + a)}</TD></TR>`).join('')
  const methods = c.methods.map(m => `<TR><TD ALIGN="LEFT">${esc(/^[+#-]/.test(m) ? m : '+ ' + m)}</TD></TR>`).join('')
  return `<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="6"><TR><TD BGCOLOR="#263f68"><FONT COLOR="white"><B>${esc(c.title)}</B></FONT></TD></TR><TR><TD BGCOLOR="#eaf0fb"><B>attributes</B></TD></TR>${attrs}<TR><TD BGCOLOR="#eaf0fb"><B>methods</B></TD></TR>${methods}</TABLE>>`
}

const relationshipLabels = new Map([
  ['contains', 'composition · 1 — 0..*'], ['contains items', 'composition · 1 — 0..*'], ['creates / assigns', 'association · 1 — 0..*'], ['owns', 'association · 1 — 0..*'], ['requests', 'association · 1 — 0..*'],
  ['implements', 'realization'], ['persists', 'dependency'], ['uses', 'dependency'], ['HTTP / JSON', 'association'], ['auth endpoints', 'association'], ['AI endpoints', 'association'], ['meal endpoints', 'association'], ['fitness endpoints', 'association'], ['admin endpoints', 'association'],
])
const relText = l => relationshipLabels.get(l) || l
const relationMultiplicity = l => ['contains', 'contains items', 'creates / assigns', 'owns', 'requests'].includes(l) ? ['1', '0..*'] : ['', '']
const dot = [
  'digraph UML {', 'graph [rankdir=LR, bgcolor="#f8faff", pad="0.35", nodesep="0.55", ranksep="1.0", splines=ortho, fontname="Arial"];',
  'node [shape=plain, fontname="Arial"];', 'edge [color="#7a8fab", penwidth=1.2, arrowsize=0.7, fontname="Arial", fontsize=9, fontcolor="#526680"];',
  'subgraph cluster_presentation { label="Presentation"; color="#c5d6f4"; style="rounded"; fontname="Arial"; fontcolor="#36548c"; ' + classes.filter(c => c.group === 'presentation').map(c => `${c.id} [label=${label(c)}];`).join(' ') + '}',
  'subgraph cluster_application { label="Application services"; color="#c8e4d2"; style="rounded"; fontname="Arial"; fontcolor="#33734a"; ' + classes.filter(c => c.group === 'application').map(c => `${c.id} [label=${label(c)}];`).join(' ') + '}',
  'subgraph cluster_infrastructure { label="Infrastructure"; color="#f0d4aa"; style="rounded"; fontname="Arial"; fontcolor="#95611d"; ' + classes.filter(c => c.group === 'infrastructure').map(c => `${c.id} [label=${label(c)}];`).join(' ') + '}',
  'subgraph cluster_domain { label="Domain objects"; color="#dbc9ee"; style="rounded"; fontname="Arial"; fontcolor="#69458d"; ' + classes.filter(c => c.group === 'domain').map(c => `${c.id} [label=${label(c)}];`).join(' ') + '}',
  ...edges.map(([a, b, l]) => `${a} -> ${b} [label="${esc(relText(l))}"];`), '}']
const dotText = dot.join('\n')
const mermaid = ['classDiagram', ...classes.map(c => [`class ${c.id} {`, ...c.attrs.map(a => `  ${/^[+#-]/.test(a) ? a : '- ' + a}`), ...c.methods.map(m => `  ${/^[+#-]/.test(m) ? m : '+ ' + m}`), '}'].join('\n')), ...edges.map(([a, b, l]) => { const [from, to] = relationMultiplicity(l); return `${a}${from ? ` "${from}"` : ''} -->${to ? ` "${to}"` : ''} ${b} : ${relText(l)}` })].join('\n')
fs.writeFileSync(path.join(out, 'class-diagram.dot'), dotText)
fs.writeFileSync(path.join(out, 'class-diagram.mmd'), mermaid)

instance().then(viz => {
  const svg = viz.renderString(dotText, { format: 'svg', engine: 'dot' })
  fs.writeFileSync(path.join(out, 'class-diagram.svg'), svg)
  const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UML Class Diagram · YeahBuddy</title><style>body{margin:0;font:14px system-ui;color:#182a45;background:#f2f5fa}header{padding:20px 28px;background:#fff;border-bottom:1px solid #d9e1ed}h1{margin:0 0 6px;font-size:26px}p{margin:4px 0;color:#526680}.toolbar{display:flex;gap:8px;padding:12px 28px;background:#f8faff;border-bottom:1px solid #d9e1ed}.toolbar button{padding:8px 12px;border:1px solid #c8d3e4;border-radius:8px;background:white;cursor:pointer}.stage{height:calc(100vh - 150px);overflow:hidden;background:#f8faff;background-image:radial-gradient(#d6dfed 1px,transparent 1px);background-size:20px 20px;position:relative}.stage svg{position:absolute;transform-origin:0 0;max-width:none}.hint{padding:7px 28px;color:#61738b;font-size:12px;background:#fff}.stage.dark{filter:invert(.89) hue-rotate(180deg)}</style><header><h1>UML Class Diagram toàn hệ thống</h1><p>Lớp, thuộc tính và phương thức chính được trích từ backend TypeScript; quan hệ dữ liệu chi tiết xem ERD.</p></header><div class="toolbar"><button id="fit">Vừa khung</button><button id="minus">−</button><button id="plus">+</button><button id="theme">Sáng / tối</button><a href="../erd-system/index.html">Mở ERD</a></div><div class="stage" id="stage">${svg}</div><div class="hint">Cuộn để phóng to · Kéo nền để di chuyển · Mũi tên liền là quan hệ sử dụng/kế thừa hoặc persistence.</div><script>const s=document.querySelector('#stage svg');let z=1,x=0,y=0,d;function t(){s.style.transform='translate('+x+'px,'+y+'px) scale('+z+')'}function fit(){const b=s.viewBox.baseVal;z=Math.min((innerWidth-50)/b.width,(innerHeight-190)/b.height);x=(innerWidth-b.width*z)/2;y=20;t()}function zoom(f){z=Math.max(.1,Math.min(3,z*f));t()}document.querySelector('#fit').onclick=fit;document.querySelector('#minus').onclick=()=>zoom(.8);document.querySelector('#plus').onclick=()=>zoom(1.25);document.querySelector('#theme').onclick=()=>document.querySelector('#stage').classList.toggle('dark');document.querySelector('#stage').onwheel=e=>{e.preventDefault();zoom(e.deltaY<0?1.12:.89)};document.querySelector('#stage').onpointerdown=e=>{d={x:e.clientX,y:e.clientY,ox:x,oy:y};s.setPointerCapture(e.pointerId)};document.querySelector('#stage').onpointermove=e=>{if(d){x=d.ox+e.clientX-d.x;y=d.oy+e.clientY-d.y;t()}};document.querySelector('#stage').onpointerup=()=>d=null;onresize=fit;fit()</script></html>`
  fs.writeFileSync(path.join(out, 'class-diagram.html'), html)
  console.log(JSON.stringify({ classes: classes.length, relationships: edges.length, outputs: ['class-diagram.html', 'class-diagram.svg', 'class-diagram.mmd'] }))
}).catch(err => { console.error(err); process.exitCode = 1 })
