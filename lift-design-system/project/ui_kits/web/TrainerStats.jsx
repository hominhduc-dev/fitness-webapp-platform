/* global React, Icon, Label, Tag, Button, Chip, Avatar, useIsMobile */
const { useState: useStateST, useMemo: useMemoST } = React;

/* ============================================================
   TrainerStats — practice-wide analytics for the coach
   Adherence · retention · volume · biggest movers · program health
   ============================================================ */

const statsRange = {
  '4w': {
    label: '4 weeks',
    kpis: { activeClients: 12, adherence: 0.86, retention: 0.92, sessions: 184, volume: 1.42, prs: 23 },
    adherenceTrend: [['W1', 0.78], ['W2', 0.82], ['W3', 0.80], ['W4', 0.86]],
    sessionsByWeek: [['W1', 41], ['W2', 46], ['W3', 44], ['W4', 53]],
  },
  '12w': {
    label: '12 weeks',
    kpis: { activeClients: 12, adherence: 0.83, retention: 0.88, sessions: 548, volume: 4.18, prs: 71 },
    adherenceTrend: [['M1', 0.79], ['M2', 0.84], ['M3', 0.83]],
    sessionsByWeek: [['W1', 39], ['W2', 42], ['W3', 40], ['W4', 47], ['W5', 44], ['W6', 49], ['W7', 46], ['W8', 51], ['W9', 45], ['W10', 48], ['W11', 50], ['W12', 53]],
  },
};

/* adherence per program (sets done vs planned, aggregated) */
const programHealth = [
  { name: 'Strength block',  clients: 4, adherence: 0.91, trend: 'up' },
  { name: 'Hypertrophy',     clients: 3, adherence: 0.74, trend: 'down' },
  { name: 'Beginner LP',     clients: 2, adherence: 0.95, trend: 'up' },
  { name: '5/3/1',           clients: 2, adherence: 0.88, trend: 'flat' },
  { name: 'Cut + maintain',  clients: 1, adherence: 0.69, trend: 'down' },
];

/* biggest movers — estimated 1RM gain over the range */
const biggestMovers = [
  { name: 'Maya Reyes',   lift: 'Deadlift',    gain: '+12.5', pct: '+9.6%', dir: 'up' },
  { name: 'Lila Brooks',  lift: 'Squat',       gain: '+10.0', pct: '+8.1%', dir: 'up' },
  { name: 'Devon Lee',    lift: 'Bench press', gain: '+7.5',  pct: '+11.2%', dir: 'up' },
  { name: 'Priya Anand',  lift: 'Overhead',    gain: '+5.0',  pct: '+9.8%', dir: 'up' },
];

/* clients needing attention */
const needsAttention = [
  { name: 'Hana Kim',   reason: 'No session in 4 days', tone: 'warn' },
  { name: 'Sam Okafor', reason: 'Adherence 62% this week', tone: 'warn' },
  { name: 'Noah West',  reason: '2 missed sessions vs plan', tone: 'danger' },
];

const initials = (n) => n.split(' ').map(s => s[0]).join('').slice(0, 2);
const pct = (v) => Math.round(v * 100) + '%';

function KpiCard({ label, value, sub, accent, tone }) {
  const color = accent ? 'var(--accent)' : tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : 'var(--ink-900)';
  return (
    <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, padding: 18 }}>
      <Label>{label}</Label>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 600, marginTop: 8, color, letterSpacing: '-0.02em', fontFeatureSettings: '"tnum" 1' }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

function LineChart({ points, mobile }) {
  const w = 100, h = 100;
  const vals = points.map(p => p[1]);
  const min = Math.min(...vals) - 0.05, max = Math.max(...vals) + 0.03;
  const span = Math.max(max - min, 0.01);
  const coords = points.map((p, i) => [
    points.length === 1 ? 0 : (i / (points.length - 1)) * w,
    h - ((p[1] - min) / span) * h,
  ]);
  const path = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ',' + c[1].toFixed(1)).join(' ');
  const area = path + ` L${w},${h} L0,${h} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 120, display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="adhFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#adhFill)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c[0]} cy={c[1]} r="2.5" fill="var(--ink-0)" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {points.map((p, i) => (
          <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p[0]}</span>
        ))}
      </div>
    </div>
  );
}

function BarMini({ points, mobile }) {
  const max = Math.max(...points.map(p => p[1]), 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: points.length > 8 ? 4 : 8, height: 120 }}>
        {points.map((p, i) => {
          const last = i === points.length - 1;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', height: Math.max((p[1] / max) * 100, 6) + '%', borderRadius: 3, background: last ? 'var(--accent)' : 'var(--ink-200, #c9c9c2)' }} />
              {(points.length <= 8 || i % 2 === 0) && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p[0]}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartCard({ title, value, sub, children }) {
  return (
    <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <Label>{title}</Label>
          {value ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: 'var(--ink-900)', marginTop: 6, fontFeatureSettings: '"tnum" 1' }}>{value}</div> : null}
        </div>
        {sub ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{sub}</span> : null}
      </div>
      {children}
    </div>
  );
}

function trendIcon(t) {
  return t === 'up' ? { name: 'trending-up', color: 'var(--ok)' }
    : t === 'down' ? { name: 'trending-down', color: 'var(--danger)' }
    : { name: 'minus', color: 'var(--ink-400)' };
}

function TrainerStats() {
  const mobile = useIsMobile();
  const [range, setRange] = useStateST('4w');
  const data = statsRange[range];
  const k = data.kpis;

  return (
    <div style={{ padding: mobile ? '20px 16px 40px' : '32px 36px', height: mobile ? 'auto' : '100vh', overflowY: 'auto' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: mobile ? 'flex-start' : 'flex-end', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 14 : 0, justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Label style={{ marginBottom: 8 }}>Stats</Label>
          <h1 style={{ fontSize: mobile ? 28 : 36, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink-900)' }}>Practice overview.</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-400)', marginTop: 6 }}>
            {k.activeClients} active clients · {pct(k.adherence)} adherence · {k.prs} PRs in {data.label}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.keys(statsRange).map(r => (
            <Chip key={r} active={range === r} onClick={() => setRange(r)}>{statsRange[r].label}</Chip>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 12, marginBottom: 22 }}>
        <KpiCard label="Adherence" value={pct(k.adherence)} sub="sets done vs planned" accent />
        <KpiCard label="Retention" value={pct(k.retention)} sub="clients still training" tone="ok" />
        <KpiCard label="Sessions logged" value={k.sessions} sub={`across ${k.activeClients} clients`} />
        <KpiCard label="Total volume" value={k.volume + 'M'} sub="kg lifted" />
        <KpiCard label="New PRs" value={k.prs} sub="estimated 1RMs" tone="ok" />
        <KpiCard label="Needs attention" value={needsAttention.length} sub="clients flagged" tone="warn" />
      </div>

      {/* charts */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 26 }}>
        <ChartCard title="Adherence trend" value={pct(k.adherence)} sub={'vs ' + pct(data.adherenceTrend[0][1]) + ' start'}>
          <LineChart points={data.adherenceTrend} mobile={mobile} />
        </ChartCard>
        <ChartCard title="Sessions per week" value={k.sessions} sub="all clients">
          <BarMini points={data.sessionsByWeek} mobile={mobile} />
        </ChartCard>
      </div>

      {/* two-column: program health + biggest movers */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1.1fr 1fr', gap: 14, marginBottom: 26 }}>
        {/* program health */}
        <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Label>Program adherence</Label>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>{programHealth.length} active</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {programHealth.map(p => {
              const ti = trendIcon(p.trend);
              const tone = p.adherence >= 0.85 ? 'var(--ok)' : p.adherence >= 0.75 ? 'var(--warn)' : 'var(--danger)';
              return (
                <div key={p.name}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)' }}>{p.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>{p.clients} {p.clients === 1 ? 'client' : 'clients'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name={ti.name} size={13} color={ti.color} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: tone, fontFeatureSettings: '"tnum" 1' }}>{pct(p.adherence)}</span>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'var(--ink-100)', overflow: 'hidden' }}>
                    <div style={{ width: pct(p.adherence), height: '100%', borderRadius: 999, background: tone }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* biggest movers */}
        <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Label>Biggest movers</Label>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>est. 1RM gain</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {biggestMovers.map((m, i) => (
              <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--ink-50)' : 'none' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)', width: 16 }}>{i + 1}</span>
                <Avatar initials={initials(m.name)} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)' }}>{m.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>{m.lift}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--ink-900)', fontFeatureSettings: '"tnum" 1' }}>{m.gain}<span style={{ fontSize: 11, color: 'var(--ink-400)', fontWeight: 400 }}> kg</span></div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ok)' }}>{m.pct}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* needs attention */}
      <Label style={{ marginBottom: 12 }}>Needs attention</Label>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
        {needsAttention.map(c => (
          <div key={c.name} style={{
            background: 'var(--ink-0)', border: '1px solid var(--ink-100)',
            borderLeft: '3px solid ' + (c.tone === 'danger' ? 'var(--danger)' : 'var(--warn)'),
            borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Avatar initials={initials(c.name)} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)' }}>{c.name}</div>
              <div style={{ fontSize: 12, color: c.tone === 'danger' ? 'var(--danger)' : 'var(--warn)', marginTop: 2 }}>{c.reason}</div>
            </div>
            <Icon name="chevron-right" size={15} color="var(--ink-400)" />
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { TrainerStats });
