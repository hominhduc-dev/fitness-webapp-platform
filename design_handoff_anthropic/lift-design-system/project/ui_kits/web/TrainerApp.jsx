/* global React, Button, Icon, Input, Chip, Tag, Label, Card, Avatar, useIsMobile */
const { useState: useStateTR, useMemo: useMemoTR } = React;

/* ============================================================
   Trainer dashboard — client roster + per-client detail
   ============================================================ */

const clients = [
  { id: 1, name: 'Maya Reyes',     program: 'Strength block · w3', last: '2h ago',  status: 'on-track', streak: 12,
    note: 'Hit a deadlift PR yesterday.',
    weekly: [4, 5, 4, 5, 6, 5, 5],
    recent: [
      { date: 'May 27', kind: 'Pull', volume: 9420, prs: 1, complete: 1.0 },
      { date: 'May 25', kind: 'Push', volume: 8120, prs: 0, complete: 1.0 },
      { date: 'May 23', kind: 'Legs', volume: 14200, prs: 0, complete: 0.93 },
      { date: 'May 20', kind: 'Pull', volume: 9100, prs: 0, complete: 1.0 },
    ],
    keyLifts: [
      { name: 'Deadlift',     value: '142.5', delta: '+2.5', new: true },
      { name: 'Bench press',  value: '78.0',  delta: '+0.0' },
      { name: 'Squat',        value: '115.0', delta: '+5.0' },
    ],
  },
  { id: 2, name: 'Theo Sato',      program: 'Hypertrophy · w2', last: '1d ago',   status: 'behind',     streak: 4,
    note: 'Skipped Tuesday. Down 2 sets vs plan.',
    weekly: [3, 4, 4, 3, 0, 4, 3],
    recent: [
      { date: 'May 26', kind: 'Push', volume: 6120, prs: 0, complete: 0.80 },
      { date: 'May 24', kind: 'Pull', volume: 7400, prs: 0, complete: 1.0 },
      { date: 'May 22', kind: 'Legs', volume: 9200, prs: 0, complete: 0.85 },
    ],
    keyLifts: [
      { name: 'Bench press',  value: '92.5',  delta: '+0.0' },
      { name: 'Squat',        value: '130.0', delta: '+0.0' },
      { name: 'Overhead',     value: '55.0',  delta: '−2.5' },
    ],
  },
  { id: 3, name: 'Hana Kim',       program: 'Cut + maintain · w5', last: '4d ago', status: 'rest',     streak: 0,
    note: 'On scheduled rest week.',
    weekly: [0, 0, 0, 0, 0, 1, 0],
    recent: [
      { date: 'May 23', kind: 'Light', volume: 3200, prs: 0, complete: 1.0 },
      { date: 'May 18', kind: 'Push',  volume: 6900, prs: 0, complete: 1.0 },
    ],
    keyLifts: [
      { name: 'Bench press',  value: '50.0',  delta: '+0.0' },
      { name: 'Squat',        value: '80.0',  delta: '+0.0' },
      { name: 'Pull-up',      value: 'BW × 8', delta: '+1' },
    ],
  },
  { id: 4, name: 'Devon Lee',      program: 'Beginner LP · w8', last: '5h ago',   status: 'on-track', streak: 22 },
  { id: 5, name: 'Priya Anand',    program: '5/3/1 · w1',       last: 'yesterday', status: 'on-track', streak: 8 },
  { id: 6, name: 'Sam Okafor',     program: 'Strength · w4',     last: '3d ago',    status: 'behind',   streak: 2 },
  { id: 7, name: 'Lila Brooks',    program: 'Hypertrophy · w6',  last: '6h ago',    status: 'on-track', streak: 19 },
  { id: 8, name: 'Noah West',      program: 'Recomp · w2',       last: '2d ago',    status: 'behind',   streak: 1 },
];

const statusMeta = {
  'on-track': { tone: 'ok',      label: 'On track' },
  'behind':   { tone: 'warn',    label: 'Behind' },
  'rest':     { tone: 'neutral', label: 'Rest week' },
};

function statusDot(s) {
  return ({
    'on-track': 'var(--ok)',
    'behind':   'var(--warn)',
    'rest':     'var(--ink-400)',
  })[s];
}

/* -------- Trainer sidebar -------------------------------------------- */
function TrainerSidebar({ active, onNavigate }) {
  const items = [
    { id: 'clients',  icon: 'users',        label: 'Clients',  count: 12 },
    { id: 'programs', icon: 'list-checks',  label: 'Programs', count: 6 },
    { id: 'sched',    icon: 'calendar',     label: 'Schedule' },
    { id: 'msgs',     icon: 'message-square', label: 'Messages', dot: true },
    { id: 'stats',    icon: 'bar-chart-3',  label: 'Stats' },
  ];
  return (
    <aside style={{
      width: 240,
      flexShrink: 0,
      borderRight: '1px solid var(--ink-100)',
      background: 'var(--ink-0)',
      padding: '20px 14px',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 8px' }}>
        <div style={{ width: 28, height: 28, color: 'var(--ink-900)' }}>
          <img src="../../assets/lift-mark.svg" style={{ width: '100%', height: '100%' }} alt="" />
        </div>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: '-0.04em',
          color: 'var(--ink-900)',
        }}>lift</div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          background: 'var(--ink-900)',
          color: 'var(--ink-0)',
          padding: '2px 6px',
          borderRadius: 3,
          marginLeft: 'auto',
        }}>coach</span>
      </div>

      <a href="landing.html" style={{ display: 'block', fontSize: 11, color: 'var(--ink-400)', padding: '0 10px 22px', textDecoration: 'none' }}>← Back to athlete view</a>

      <button
        style={{
          margin: '0 0 24px',
          padding: '10px 14px',
          background: 'var(--ink-900)',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
        }}
      >
        <Icon name="plus" size={16} color="#fff" />
        Add client
      </button>

      <Label style={{ padding: '0 10px 8px' }}>Coach</Label>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(it => (
          <TrainerNavItem key={it.id} item={it} isActive={active === it.id} onClick={() => onNavigate(it.id)} />
        ))}
      </nav>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--ink-100)', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar initials="EK" />
        <div style={{ lineHeight: 1.2, fontSize: 13 }}>
          <div style={{ color: 'var(--ink-800)', fontWeight: 500 }}>Coach Eli K.</div>
          <div style={{ color: 'var(--ink-400)', fontSize: 12 }}>12 active clients</div>
        </div>
      </div>
    </aside>
  );
}

function TrainerNavItem({ item, isActive, onClick }) {
  const [hover, setHover] = useStateTR(false);
  const bg = isActive ? 'var(--ink-100)' : (hover ? 'var(--ink-50)' : 'transparent');
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 10px',
        background: bg,
        color: isActive ? 'var(--ink-900)' : 'var(--ink-600)',
        border: 'none',
        borderRadius: 6,
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        fontWeight: isActive ? 500 : 400,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 120ms',
        position: 'relative',
      }}
    >
      <Icon name={item.icon} size={16} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.count !== undefined && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-400)',
          background: 'var(--ink-50)',
          padding: '1px 6px',
          borderRadius: 999,
          fontFeatureSettings: '"tnum" 1',
        }}>{item.count}</span>
      )}
      {item.dot && (
        <span style={{
          width: 6, height: 6, borderRadius: 999, background: 'var(--accent)',
        }} />
      )}
    </button>
  );
}

/* -------- Client list ------------------------------------------------- */
function ClientList({ selected, onSelect, mobile }) {
  const [q, setQ] = useStateTR('');
  const [filter, setFilter] = useStateTR('all');

  const visible = clients.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{
      borderRight: mobile ? 'none' : '1px solid var(--ink-100)',
      background: 'var(--ink-0)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: mobile ? 'auto' : '100vh',
    }}>
      <div style={{
        padding: mobile ? '14px 16px' : '20px 24px 12px',
        borderBottom: '1px solid var(--ink-100)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <h1 style={{ fontSize: mobile ? 22 : 24, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Clients</h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{clients.length} total</span>
        </div>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Icon name="search" size={14} color="var(--ink-400)" style={{ position: 'absolute', left: 12, top: 11, pointerEvents: 'none' }} />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search clients…"
            style={{ paddingLeft: 34, width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {[
            ['all',      'All'],
            ['on-track', 'On track'],
            ['behind',   'Behind'],
            ['rest',     'Rest'],
          ].map(([k, label]) => (
            <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{label}</Chip>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {visible.map(c => (
          <ClientRow
            key={c.id}
            client={c}
            selected={selected === c.id}
            onClick={() => onSelect(c.id)}
            mobile={mobile}
          />
        ))}
        {visible.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-400)', fontSize: 14 }}>
            No clients match.
          </div>
        )}
      </div>
    </div>
  );
}

function ClientRow({ client, selected, onClick, mobile }) {
  const [hover, setHover] = useStateTR(false);
  const meta = statusMeta[client.status];
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '14px 24px',
        background: selected ? 'var(--ink-50)' : (hover ? 'var(--ink-50)' : 'transparent'),
        border: 'none',
        borderLeft: selected ? '3px solid var(--accent)' : '3px solid transparent',
        borderBottom: '1px solid var(--ink-100)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        transition: 'background 120ms',
      }}
    >
      <Avatar initials={client.name.split(' ').map(s => s[0]).join('')} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.name}</span>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: statusDot(client.status), flexShrink: 0 }} />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', marginTop: 3, letterSpacing: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {client.program} · {client.last}
        </div>
      </div>
      {!mobile && <Icon name="chevron-right" size={14} color="var(--ink-400)" />}
    </button>
  );
}

/* -------- Client detail ---------------------------------------------- */
function ClientDetail({ client, onBack, mobile, onAssign }) {
  if (!client) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-400)' }}>
        Select a client to see their training.
      </div>
    );
  }
  const meta = statusMeta[client.status];
  return (
    <div style={{ padding: mobile ? '16px 16px 32px' : '28px 36px', overflowY: 'auto' }}>
      {mobile && (
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none',
          color: 'var(--ink-600)', fontSize: 13, padding: 0, marginBottom: 14, cursor: 'pointer',
        }}>
          <Icon name="chevron-left" size={14} /> All clients
        </button>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <Avatar initials={client.name.split(' ').map(s => s[0]).join('')} size={mobile ? 52 : 64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Label style={{ marginBottom: 4 }}>{client.program}</Label>
          <h1 style={{ fontSize: mobile ? 26 : 32, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink-900)' }}>{client.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <Tag tone={meta.tone}>{meta.label}</Tag>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)' }}>· {client.streak}-day streak · last seen {client.last}</span>
          </div>
        </div>
        {!mobile && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon="message-square">Message</Button>
            <Button variant="dark" icon="plus" onClick={onAssign}>Assign workout</Button>
          </div>
        )}
      </div>

      {client.note && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--ink-50)',
          border: '1px solid var(--ink-100)',
          borderRadius: 8,
          marginBottom: 24,
          fontSize: 14,
          color: 'var(--ink-800)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}>
          <Icon name="sticky-note" size={16} color="var(--ink-400)" style={{ marginTop: 2 }} />
          <span>{client.note}</span>
        </div>
      )}

      {/* Weekly bar chart */}
      <div style={{
        background: 'var(--ink-0)',
        border: '1px solid var(--ink-100)',
        borderRadius: 10,
        padding: mobile ? 16 : 20,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <Label>This week · sets per day</Label>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: 'var(--ink-900)', marginTop: 6, fontFeatureSettings: '"tnum" 1' }}>
              {(client.weekly || []).reduce((a, b) => a + b, 0)} <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>sets</span>
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>vs plan: 28</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, height: 110, alignItems: 'end' }}>
          {(client.weekly || []).map((v, i) => {
            const max = Math.max(...(client.weekly || [1]), 6);
            const h = v === 0 ? 4 : (v / max) * 90;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%' }}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{
                    width: '100%',
                    height: h + '%',
                    background: v === 0 ? 'var(--ink-100)' : (i === 6 ? 'var(--accent)' : 'var(--ink-800)'),
                    borderRadius: 3,
                  }} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {['mon','tue','wed','thu','fri','sat','sun'][i]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key lifts */}
      <Label style={{ marginBottom: 12 }}>Key lifts (estimated 1RM)</Label>
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 28,
      }}>
        {(client.keyLifts || []).map(k => (
          <div key={k.name} style={{
            background: 'var(--ink-0)',
            border: '1px solid var(--ink-100)',
            borderRadius: 10,
            padding: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-600)' }}>{k.name}</div>
              {k.new && <Tag tone="pr">New</Tag>}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: '-0.03em',
                color: 'var(--ink-900)',
                fontFeatureSettings: '"tnum" 1',
              }}>{k.value}</div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: k.delta.startsWith('+') && k.delta !== '+0.0' ? 'var(--ok)' :
                       k.delta.startsWith('−') || k.delta.startsWith('-') ? 'var(--danger)' :
                       'var(--ink-400)',
              }}>{k.delta === '+0.0' ? 'flat' : k.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      <Label style={{ marginBottom: 12 }}>Recent sessions</Label>
      <div style={{
        border: '1px solid var(--ink-100)',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--ink-0)',
      }}>
        {(client.recent || []).map((s, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '60px 1fr auto' : '80px 1fr 100px 100px 32px',
            gap: mobile ? 10 : 12,
            padding: '14px 18px',
            borderBottom: i < (client.recent.length - 1) ? '1px solid var(--ink-100)' : 'none',
            alignItems: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.date}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {s.kind} day {s.prs > 0 && <Tag tone="pr">{s.prs} PR</Tag>}
              </div>
              {mobile && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', marginTop: 2 }}>
                  {(s.volume / 1000).toFixed(1)}k kg · {Math.round(s.complete * 100)}%
                </div>
              )}
            </div>
            {!mobile && (
              <>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-800)' }}>{(s.volume / 1000).toFixed(1)}k kg</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: s.complete === 1 ? 'var(--ok)' : 'var(--warn)',
                }}>{Math.round(s.complete * 100)}%</span>
              </>
            )}
            <Icon name="chevron-right" size={14} color="var(--ink-400)" />
          </div>
        ))}
      </div>

      {mobile && (
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Button variant="secondary" icon="message-square" style={{ flex: 1, justifyContent: 'center' }}>Message</Button>
          <Button variant="dark" icon="plus" onClick={onAssign} style={{ flex: 1, justifyContent: 'center' }}>Assign workout</Button>
        </div>
      )}
    </div>
  );
}

/* -------- Mobile sidebar (top + bottom tabs) ------------------------- */
function TrainerMobileBar({ active, onNavigate }) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid var(--ink-100)',
      background: 'rgba(252,252,250,0.92)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 22, height: 22, color: 'var(--ink-900)' }}>
          <img src="../../assets/lift-mark.svg" style={{ width: '100%', height: '100%' }} alt="" />
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.04em', color: 'var(--ink-900)' }}>lift</div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          background: 'var(--ink-900)',
          color: 'var(--ink-0)',
          padding: '2px 5px',
          borderRadius: 3,
          marginLeft: 4,
        }}>coach</span>
      </div>
      <Avatar initials="EK" size={28} />
    </header>
  );
}

/* -------- App entry --------------------------------------------------- */
function TrainerApp() {
  const [selected, setSelected] = useStateTR(1);
  const [mobileView, setMobileView] = useStateTR('list'); // 'list' | 'detail'
  const [nav, setNav] = useStateTR('clients');
  const [assignModal, setAssignModal] = useStateTR(null);  // null | client
  const [toast, setToast] = useStateTR(null);              // confirmation toast
  const mobile = useIsMobile();

  const current = useMemoTR(() => clients.find(c => c.id === selected), [selected]);

  const handleAssign = (payload) => {
    setAssignModal(null);
    setToast({
      message: payload.type === 'routine'
        ? `Assigned ${payload.target.name} to ${payload.client}`
        : `Started ${payload.target.name} for ${payload.client}`,
    });
    setTimeout(() => setToast(null), 3500);
  };

  const renderClientsView = () => mobile ? (
    mobileView === 'list' ? (
      <ClientList
        selected={selected}
        onSelect={(id) => { setSelected(id); setMobileView('detail'); }}
        mobile={true}
      />
    ) : (
      <ClientDetail
        client={current}
        mobile={true}
        onBack={() => setMobileView('list')}
        onAssign={() => setAssignModal(current)}
      />
    )
  ) : (
    <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '360px 1fr', minWidth: 0 }}>
      <ClientList selected={selected} onSelect={setSelected} mobile={false} />
      <div style={{ overflowY: 'auto', maxHeight: '100vh' }}>
        <ClientDetail
          client={current}
          mobile={false}
          onAssign={() => setAssignModal(current)}
        />
      </div>
    </main>
  );

  const renderProgramsView = () => mobile
    ? <ProgramsScreen />
    : <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', maxHeight: '100vh' }}><ProgramsScreen /></main>;

  const renderPlaceholder = (title, subtitle) => (
    <main style={{ flex: 1, minWidth: 0, padding: mobile ? '20px 16px' : '32px 36px' }}>
      <Label style={{ marginBottom: 8 }}>{title}</Label>
      <h1 style={{ fontSize: mobile ? 28 : 36, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
        Coming soon.
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ink-600)', marginTop: 10, maxWidth: 480 }}>{subtitle}</p>
    </main>
  );

  const content =
    nav === 'clients'  ? renderClientsView() :
    nav === 'programs' ? renderProgramsView() :
    nav === 'sched'    ? renderPlaceholder('Schedule', 'Calendar of every client\'s next session.') :
    nav === 'msgs'     ? renderPlaceholder('Messages', 'Chat with clients between sessions.') :
    nav === 'stats'    ? renderPlaceholder('Stats', 'Adherence, retention, biggest mover.') :
    renderClientsView();

  if (mobile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-0)' }}>
        <TrainerMobileBar />
        {content}
        {assignModal && (
          <AssignWorkoutModal
            client={assignModal}
            programs={typeof seedPrograms !== 'undefined' ? seedPrograms : []}
            onClose={() => setAssignModal(null)}
            onAssign={handleAssign}
          />
        )}
        {toast && <ToastBanner message={toast.message} />}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--ink-0)' }}>
      <TrainerSidebar active={nav} onNavigate={setNav} />
      {content}
      {assignModal && (
        <AssignWorkoutModal
          client={assignModal}
          programs={typeof seedPrograms !== 'undefined' ? seedPrograms : []}
          onClose={() => setAssignModal(null)}
          onAssign={handleAssign}
        />
      )}
      {toast && <ToastBanner message={toast.message} />}
    </div>
  );
}

function ToastBanner({ message }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--ink-900)',
      color: 'var(--ink-0)',
      padding: '10px 16px',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 500,
      boxShadow: '0 16px 48px -12px rgba(13,13,11,0.30)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      zIndex: 200,
      animation: 'lift-toast-in 240ms cubic-bezier(.2,.7,.2,1)',
    }}>
      <Icon name="check" size={14} color="var(--ok)" />
      {message}
    </div>
  );
}

Object.assign(window, { TrainerApp });
