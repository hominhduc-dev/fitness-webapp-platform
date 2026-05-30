/* global React, Icon, Tag, Label, Card, Chip, useIsMobile */
const { useState: useStateHS } = React;

/* ============================================================
   History — month calendar + recent sessions
   ============================================================ */

// Mock data — workouts on these days of March
const workouts = {
  3:  { kind: 'push',  duration: '48m', volume: 7820, prs: 0 },
  5:  { kind: 'pull',  duration: '52m', volume: 8430, prs: 1 },
  7:  { kind: 'legs',  duration: '61m', volume: 12200, prs: 0 },
  10: { kind: 'push',  duration: '49m', volume: 8100, prs: 0 },
  12: { kind: 'pull',  duration: '54m', volume: 9210, prs: 0 },
  14: { kind: 'legs',  duration: '58m', volume: 13050, prs: 2 },
  17: { kind: 'push',  duration: '47m', volume: 8540, prs: 0 },
  19: { kind: 'push',  duration: '32m', volume: 5200, prs: 0, today: true },
};

function HistoryScreen() {
  const [hover, setHover] = useStateHS(null);
  const [filter, setFilter] = useStateHS('all');
  const mobile = useIsMobile();

  const days = [];
  // March 2026 starts on a Sunday (mock). We pad with empty cells.
  for (let i = 0; i < 0; i++) days.push(null);
  for (let d = 1; d <= 31; d++) days.push(d);

  const kindColor = (k) => ({
    push:  'var(--accent)',
    pull:  'var(--ok)',
    legs:  'var(--warn)',
  }[k] || 'var(--ink-400)');

  const recent = Object.entries(workouts)
    .filter(([, w]) => filter === 'all' || w.kind === filter)
    .sort(([a], [b]) => parseInt(b) - parseInt(a))
    .slice(0, 8);

  return (
    <div style={{ padding: mobile ? '20px 16px' : '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: mobile ? 'flex-start' : 'baseline', justifyContent: 'space-between', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 16 : 0, marginBottom: mobile ? 20 : 28 }}>
        <div>
          <Label style={{ marginBottom: 8 }}>March 2026</Label>
          <h1 style={{ fontSize: mobile ? 28 : 36, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>14 workouts</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['all', 'push', 'pull', 'legs'].map(k => (
            <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
              {k === 'all' ? 'All' : k[0].toUpperCase() + k.slice(1)}
            </Chip>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 360px', gap: mobile ? 16 : 24 }}>
        {/* Calendar */}
        <Card style={{ padding: 20 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 6,
            marginBottom: 8,
          }}>
            {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => (
              <div key={d} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-400)', textAlign: 'center', letterSpacing: '0.08em', padding: '6px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 6,
          }}>
            {days.map((d, i) => {
              if (d === null) return <div key={i} />;
              const w = workouts[d];
              const isToday = w?.today;
              const hasFilter = filter === 'all' || w?.kind === filter;
              const dim = w && !hasFilter;
              return (
                <button
                  key={i}
                  onMouseEnter={() => setHover(d)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    aspectRatio: '1',
                    border: isToday ? '1.5px solid var(--accent)' : '1px solid var(--ink-100)',
                    borderRadius: 6,
                    background: hover === d && w ? 'var(--ink-50)' : 'var(--ink-0)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 8,
                    cursor: w ? 'pointer' : 'default',
                    fontFamily: 'var(--font-mono)',
                    color: isToday ? 'var(--accent)' : 'var(--ink-800)',
                    fontSize: 13,
                    opacity: dim ? 0.4 : 1,
                    transition: 'all 120ms',
                  }}
                >
                  <span style={{ alignSelf: 'flex-start', fontWeight: isToday ? 600 : 400 }}>{d}</span>
                  {w && (
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: kindColor(w.kind),
                      alignSelf: 'flex-end',
                    }} />
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--ink-100)' }}>
            {[['push', 'Push'], ['pull', 'Pull'], ['legs', 'Legs']].map(([k, label]) => (
              <div key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-600)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: kindColor(k) }} />
                {label}
              </div>
            ))}
          </div>
        </Card>

        {/* Recent */}
        <div>
          <Label style={{ marginBottom: 12 }}>Recent</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recent.map(([day, w]) => (
              <div key={day} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 14px',
                background: 'var(--ink-0)',
                border: '1px solid var(--ink-100)',
                borderRadius: 8,
                cursor: 'pointer',
              }}>
                <div style={{
                  width: 36,
                  textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mar</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: 'var(--ink-900)', lineHeight: 1 }}>{day}</div>
                </div>
                <div style={{ width: 4, height: 32, borderRadius: 2, background: kindColor(w.kind) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {w.kind[0].toUpperCase() + w.kind.slice(1)} day
                    {w.prs > 0 && <Tag tone="pr">{w.prs} PR</Tag>}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>
                    {w.duration} · {(w.volume / 1000).toFixed(1)}k kg
                  </div>
                </div>
                <Icon name="chevron-right" size={16} color="var(--ink-400)" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HistoryScreen });
