/* global React, Icon, Chip, Input, Tag, Label, Button, useIsMobile */
const { useState: useStateLS } = React;

/* ============================================================
   Library — searchable exercise library
   ============================================================ */

const exercises = [
  { name: 'Bench press',              muscle: 'chest',     equipment: 'barbell', best: '102.5 × 5', last: '82.5 × 8' },
  { name: 'Incline dumbbell press',   muscle: 'chest',     equipment: 'dumbbell', best: '34 × 8',   last: '30 × 10' },
  { name: 'Cable triceps pushdown',   muscle: 'arms',      equipment: 'cable',   best: '40 × 12',   last: '30 × 8' },
  { name: 'Overhead press',           muscle: 'shoulders', equipment: 'barbell', best: '62.5 × 5',  last: '55 × 6' },
  { name: 'Lateral raise',            muscle: 'shoulders', equipment: 'dumbbell', best: '14 × 12',  last: '12 × 12' },
  { name: 'Deadlift',                 muscle: 'back',      equipment: 'barbell', best: '180 × 3',   last: '160 × 5' },
  { name: 'Barbell row',              muscle: 'back',      equipment: 'barbell', best: '92.5 × 6',  last: '85 × 8' },
  { name: 'Pull-up',                  muscle: 'back',      equipment: 'bodyweight', best: 'BW × 12', last: 'BW × 10' },
  { name: 'Lat pulldown',             muscle: 'back',      equipment: 'cable',   best: '70 × 8',    last: '65 × 10' },
  { name: 'Barbell squat',            muscle: 'legs',      equipment: 'barbell', best: '140 × 5',   last: '125 × 6' },
  { name: 'Romanian deadlift',        muscle: 'legs',      equipment: 'barbell', best: '120 × 6',   last: '105 × 8' },
  { name: 'Leg press',                muscle: 'legs',      equipment: 'machine', best: '220 × 10',  last: '200 × 12' },
  { name: 'Barbell curl',             muscle: 'arms',      equipment: 'barbell', best: '45 × 6',    last: '37.5 × 8' },
  { name: 'Hammer curl',              muscle: 'arms',      equipment: 'dumbbell', best: '20 × 8',   last: '17.5 × 10' },
  { name: 'Calf raise',               muscle: 'legs',      equipment: 'machine', best: '100 × 15',  last: '90 × 15' },
  { name: 'Plank',                    muscle: 'core',      equipment: 'bodyweight', best: '2:30',   last: '2:00' },
];

const filters = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core'];

function LibraryScreen() {
  const [q, setQ] = useStateLS('');
  const [filter, setFilter] = useStateLS('all');
  const mobile = useIsMobile();

  const visible = exercises.filter(e => {
    if (filter !== 'all' && e.muscle !== filter) return false;
    if (q && !e.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ padding: mobile ? '20px 16px' : '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: mobile ? 20 : 28 }}>
        <Label style={{ marginBottom: 8 }}>Exercises</Label>
        <h1 style={{ fontSize: mobile ? 28 : 36, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>{exercises.length} in your library</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: mobile ? '100%' : 360 }}>
          <Icon name="search" size={16} color="var(--ink-400)" style={{ position: 'absolute', left: 12, top: 11, pointerEvents: 'none' }} />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search exercises…"
            style={{ paddingLeft: 36, width: '100%' }}
          />
        </div>
        {!mobile && <Button variant="dark" icon="plus" size="md" onClick={() => {}}>New exercise</Button>}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, overflowX: mobile ? 'auto' : 'visible' }}>
        {filters.map(f => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
          </Chip>
        ))}
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--ink-100)', borderRadius: 10, overflow: 'hidden', background: 'var(--ink-0)' }}>
        {!mobile && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.8fr 1fr 1fr 1fr 1fr 32px',
            gap: 12,
            padding: '10px 20px',
            borderBottom: '1px solid var(--ink-100)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-400)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            <span>Exercise</span><span>Muscle</span><span>Equipment</span><span>Best</span><span>Last</span><span></span>
          </div>
        )}
        {visible.map((e, i) => (
          <div
            key={e.name}
            style={mobile ? {
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              borderBottom: i < visible.length - 1 ? '1px solid var(--ink-100)' : 'none',
              cursor: 'pointer',
            } : {
              display: 'grid',
              gridTemplateColumns: '1.8fr 1fr 1fr 1fr 1fr 32px',
              gap: 12,
              padding: '12px 20px',
              borderBottom: i < visible.length - 1 ? '1px solid var(--ink-100)' : 'none',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'background 120ms',
            }}
            onMouseEnter={ev => { if (!mobile) ev.currentTarget.style.background = 'var(--ink-50)'; }}
            onMouseLeave={ev => { if (!mobile) ev.currentTarget.style.background = 'transparent'; }}
          >
            {mobile ? (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{e.muscle} · {e.equipment}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-800)', fontFeatureSettings: '"tnum" 1' }}>{e.best}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', fontFeatureSettings: '"tnum" 1', marginTop: 2 }}>last {e.last}</div>
                </div>
                <Icon name="chevron-right" size={14} color="var(--ink-400)" />
              </>
            ) : (
              <>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)' }}>{e.name}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-600)', textTransform: 'capitalize' }}>{e.muscle}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-600)', textTransform: 'capitalize' }}>{e.equipment}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-800)', fontFeatureSettings: '"tnum" 1' }}>{e.best}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-400)', fontFeatureSettings: '"tnum" 1' }}>{e.last}</span>
                <Icon name="chevron-right" size={14} color="var(--ink-400)" />
              </>
            )}
          </div>
        ))}
        {visible.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-400)', fontSize: 14 }}>
            No exercises match. Try a different filter.
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { LibraryScreen });
