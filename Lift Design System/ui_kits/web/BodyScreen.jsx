/* global React, Icon, Tag, Label, Card, Button, Chip, useIsMobile */
const { useState: useStateBS } = React;

/* ============================================================
   Body — weight + measurements
   ============================================================ */

const weightSeries = [
  { d: 'Jan 1',  v: 84.2 },
  { d: 'Jan 8',  v: 83.9 },
  { d: 'Jan 15', v: 83.7 },
  { d: 'Jan 22', v: 83.4 },
  { d: 'Jan 29', v: 83.0 },
  { d: 'Feb 5',  v: 82.8 },
  { d: 'Feb 12', v: 82.5 },
  { d: 'Feb 19', v: 82.2 },
  { d: 'Feb 26', v: 82.0 },
  { d: 'Mar 5',  v: 81.8 },
  { d: 'Mar 12', v: 81.5 },
  { d: 'Mar 19', v: 81.2 },
];

const measurements = [
  { name: 'Chest',     value: 104.5, unit: 'cm', delta: '+0.5' },
  { name: 'Waist',     value: 81.0,  unit: 'cm', delta: '-1.5', good: true },
  { name: 'Arms',      value: 38.0,  unit: 'cm', delta: '+0.2' },
  { name: 'Thighs',    value: 60.5,  unit: 'cm', delta: '+0.5' },
  { name: 'Body fat',  value: 14.5,  unit: '%',  delta: '-0.8', good: true },
];

function LineChart({ data, width = 720, height = 200, accessor = (d) => d.v, label = '' }) {
  const padding = { l: 40, r: 16, t: 16, b: 30 };
  const values = data.map(accessor);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerW = width - padding.l - padding.r;
  const innerH = height - padding.t - padding.b;
  const stepX = innerW / (data.length - 1);

  const points = data.map((d, i) => {
    const x = padding.l + i * stepX;
    const y = padding.t + (1 - (accessor(d) - min) / range) * innerH;
    return [x, y];
  });

  const path = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const last = points[points.length - 1];

  // y-axis gridlines (3)
  const gridY = [0, 0.5, 1].map(t => ({
    y: padding.t + t * innerH,
    v: (max - t * range).toFixed(1),
  }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: 'block' }}>
      {gridY.map((g, i) => (
        <g key={i}>
          <line x1={padding.l} x2={width - padding.r} y1={g.y} y2={g.y} stroke="var(--ink-100)" strokeWidth="1" />
          <text x={padding.l - 8} y={g.y + 4} fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-400)" textAnchor="end">{g.v}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="4" fill="var(--accent)" stroke="var(--ink-0)" strokeWidth="2" />
      {data.map((d, i) => i % 2 === 0 && (
        <text key={i}
          x={padding.l + i * stepX}
          y={height - 8}
          fontFamily="var(--font-mono)"
          fontSize="10"
          fill="var(--ink-400)"
          textAnchor="middle"
          textTransform="uppercase"
        >{d.d}</text>
      ))}
    </svg>
  );
}

function BodyScreen() {
  const [range, setRange] = useStateBS('3m');
  const mobile = useIsMobile();
  const latest = weightSeries[weightSeries.length - 1].v;
  const start = weightSeries[0].v;
  const change = latest - start;
  return (
    <div style={{ padding: mobile ? '20px 16px' : '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: mobile ? 'flex-start' : 'baseline', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 14 : 0, justifyContent: 'space-between', marginBottom: mobile ? 20 : 28 }}>
        <div>
          <Label style={{ marginBottom: 8 }}>Body</Label>
          <h1 style={{ fontSize: mobile ? 26 : 36, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Down 3.0 kg since January.</h1>
        </div>
        <Button variant="dark" icon="plus">Log weight</Button>
      </div>

      {/* Big chart */}
      <Card style={{ padding: mobile ? 16 : 24, marginBottom: mobile ? 18 : 24 }}>
        <div style={{ display: 'flex', alignItems: mobile ? 'flex-start' : 'baseline', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 12 : 0, justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <Label>Body weight</Label>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: mobile ? 32 : 40,
                fontWeight: 600,
                letterSpacing: '-0.03em',
                color: 'var(--ink-900)',
                lineHeight: 1,
                fontFeatureSettings: '"tnum" 1',
              }}>{latest}</div>
              <div style={{ fontSize: 14, color: 'var(--ink-400)' }}>kg</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ok)', marginLeft: 6 }}>↓ {Math.abs(change).toFixed(1)} kg · 12 w</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['1m', '3m', '6m', '1y'].map(r => (
              <Chip key={r} active={range === r} onClick={() => setRange(r)}>{r}</Chip>
            ))}
          </div>
        </div>
        <LineChart data={weightSeries} />
      </Card>

      {/* Measurements */}
      <Label style={{ marginBottom: 12 }}>Measurements · last updated Mar 17</Label>
      <div style={{
        border: '1px solid var(--ink-100)',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--ink-0)',
      }}>
        {measurements.map((m, i) => (
          <div key={m.name} style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr auto auto' : '1fr 120px 120px 32px',
            gap: mobile ? 14 : 0,
            padding: mobile ? '14px 16px' : '14px 20px',
            borderBottom: i < measurements.length - 1 ? '1px solid var(--ink-100)' : 'none',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 14, color: 'var(--ink-800)' }}>{m.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: 'var(--ink-900)', fontFeatureSettings: '"tnum" 1', textAlign: mobile ? 'right' : 'left' }}>{m.value} <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>{m.unit}</span></span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: m.good ? 'var(--ok)' : 'var(--ink-400)', textAlign: 'right' }}>
              {m.delta.startsWith('-') ? '↓' : '↑'} {m.delta.replace('-', '').replace('+', '')} {m.unit}
            </span>
            {!mobile && <Icon name="chevron-right" size={14} color="var(--ink-400)" />}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { BodyScreen });
