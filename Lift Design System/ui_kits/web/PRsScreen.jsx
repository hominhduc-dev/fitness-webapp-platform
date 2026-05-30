/* global React, Icon, Tag, Label, Card, Chip, useIsMobile */

/* ============================================================
   PRs — personal records with 1RM-estimate sparklines
   ============================================================ */

const records = [
  { exercise: 'Bench press',       best: '102.5', reps: 5, unit: 'kg', date: 'Mar 14', delta: '+5.0', new: true,
    series: [78,80,82,82,85,85,88,90,92,95,98,100,102.5] },
  { exercise: 'Barbell squat',     best: '140',   reps: 5, unit: 'kg', date: 'Mar 7',  delta: '+2.5',
    series: [115,118,120,122,125,128,130,132,135,135,138,140,140] },
  { exercise: 'Deadlift',          best: '180',   reps: 3, unit: 'kg', date: 'Feb 28', delta: '+5.0',
    series: [150,155,158,160,162,165,168,170,172,175,177,180,180] },
  { exercise: 'Overhead press',    best: '62.5',  reps: 5, unit: 'kg', date: 'Mar 5',  delta: '+2.5', new: true,
    series: [50,52,53,55,55,57,58,58,60,60,60,62.5,62.5] },
  { exercise: 'Barbell row',       best: '92.5',  reps: 6, unit: 'kg', date: 'Mar 12', delta: '+2.5',
    series: [75,78,80,80,82,85,85,87,88,90,90,92.5,92.5] },
  { exercise: 'Pull-up',           best: '12',    reps: 1, unit: 'reps', date: 'Mar 10', delta: '+2',
    series: [5,6,6,7,8,8,9,9,10,10,11,12,12] },
];

function Sparkline({ data, color = 'var(--accent)', width = 220, height = 60 }) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return [x, y];
  });
  const d = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}

function PRsScreen() {
  const mobile = useIsMobile();
  return (
    <div style={{ padding: mobile ? '20px 16px' : '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: mobile ? 'flex-start' : 'baseline', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 14 : 0, justifyContent: 'space-between', marginBottom: mobile ? 20 : 28 }}>
        <div>
          <Label style={{ marginBottom: 8 }}>Personal records</Label>
          <h1 style={{ fontSize: mobile ? 28 : 36, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>3 new this month.</h1>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Chip active>Big lifts</Chip>
          <Chip>All</Chip>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2, 1fr)', gap: mobile ? 12 : 16 }}>
        {records.map(r => (
          <div key={r.exercise} style={{
            background: 'var(--ink-0)',
            border: '1px solid var(--ink-100)',
            borderRadius: 10,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-800)' }}>{r.exercise}</div>
              {r.new && <Tag tone="pr">New</Tag>}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 44,
                fontWeight: 600,
                letterSpacing: '-0.03em',
                color: 'var(--ink-900)',
                lineHeight: 1,
                fontFeatureSettings: '"tnum" 1',
              }}>{r.best}</div>
              <div style={{ fontSize: 14, color: 'var(--ink-400)' }}>{r.unit} × {r.reps} {r.unit === 'reps' ? '' : 'reps'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <span style={{ color: 'var(--ok)' }}>↑ {r.delta} {r.unit}</span>
              <span style={{ color: 'var(--ink-400)' }}>· set {r.date}</span>
            </div>
            <div style={{ marginTop: 4 }}>
              <Sparkline data={r.series} />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--ink-400)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: -4,
            }}>
              <span>13 w ago</span><span>Now</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { PRsScreen });
