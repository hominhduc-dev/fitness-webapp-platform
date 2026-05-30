/* global React, Icon, Label, Chip, Tag, Button, RoutineBuilder, useIsMobile */
const { useState: useStateRS } = React;

/* ============================================================
   Routines — saved workout templates
   ============================================================ */

const seedRoutines = [
  {
    id: 'r1',
    name: 'Push day A',
    tag: 'push',
    source: 'coach',
    coach: 'Coach Eli K.',
    lastUsed: '2 days ago',
    exercises: [
      { name: 'Bench press',              muscle: 'chest',     equipment: 'barbell',  targetSets: 4, targetReps: 6,  targetKg: 80 },
      { name: 'Overhead press',           muscle: 'shoulders', equipment: 'barbell',  targetSets: 3, targetReps: 8,  targetKg: 50 },
      { name: 'Incline dumbbell press',   muscle: 'chest',     equipment: 'dumbbell', targetSets: 3, targetReps: 10, targetKg: 28 },
      { name: 'Lateral raise',            muscle: 'shoulders', equipment: 'dumbbell', targetSets: 3, targetReps: 12, targetKg: 12 },
      { name: 'Cable triceps pushdown',   muscle: 'arms',      equipment: 'cable',    targetSets: 3, targetReps: 12, targetKg: 25 },
    ],
  },
  {
    id: 'r2',
    name: 'Pull day A',
    tag: 'pull',
    source: 'coach',
    coach: 'Coach Eli K.',
    lastUsed: '4 days ago',
    exercises: [
      { name: 'Deadlift',         muscle: 'back', equipment: 'barbell',    targetSets: 3, targetReps: 5,  targetKg: 140 },
      { name: 'Pull-up',          muscle: 'back', equipment: 'bodyweight', targetSets: 4, targetReps: 8,  targetKg: 0 },
      { name: 'Barbell row',      muscle: 'back', equipment: 'barbell',    targetSets: 3, targetReps: 8,  targetKg: 80 },
      { name: 'Lat pulldown',     muscle: 'back', equipment: 'cable',      targetSets: 3, targetReps: 10, targetKg: 60 },
      { name: 'Barbell curl',     muscle: 'arms', equipment: 'barbell',    targetSets: 3, targetReps: 10, targetKg: 35 },
    ],
  },
  {
    id: 'r3',
    name: 'Leg day',
    tag: 'legs',
    source: 'coach',
    coach: 'Coach Eli K.',
    lastUsed: 'last week',
    exercises: [
      { name: 'Barbell squat',     muscle: 'legs', equipment: 'barbell', targetSets: 4, targetReps: 6,  targetKg: 120 },
      { name: 'Romanian deadlift', muscle: 'legs', equipment: 'barbell', targetSets: 3, targetReps: 8,  targetKg: 100 },
      { name: 'Leg press',         muscle: 'legs', equipment: 'machine', targetSets: 3, targetReps: 12, targetKg: 200 },
      { name: 'Calf raise',        muscle: 'legs', equipment: 'machine', targetSets: 4, targetReps: 15, targetKg: 90 },
    ],
  },
  {
    id: 'r4',
    name: 'Upper body — quick',
    tag: 'upper',
    source: 'self',
    lastUsed: 'never',
    exercises: [
      { name: 'Bench press',  muscle: 'chest', equipment: 'barbell',    targetSets: 3, targetReps: 8, targetKg: 75 },
      { name: 'Pull-up',      muscle: 'back',  equipment: 'bodyweight', targetSets: 3, targetReps: 8, targetKg: 0 },
      { name: 'Lateral raise', muscle: 'shoulders', equipment: 'dumbbell', targetSets: 3, targetReps: 12, targetKg: 10 },
    ],
  },
];

function tagDotR(t) {
  return ({
    push: 'var(--accent)',
    pull: 'var(--ok)',
    legs: 'var(--warn)',
    upper: '#7c5dff',
    lower: '#1a8a8a',
    full: 'var(--ink-600)',
  })[t] || 'var(--ink-400)';
}

function RoutineCard({ routine, onStart, onEdit, onDelete }) {
  const [hover, setHover] = useStateRS(false);
  const totalSets = routine.exercises.reduce((a, e) => a + (e.targetSets || 0), 0);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--ink-0)',
        border: '1px solid ' + (hover ? 'var(--ink-150)' : 'var(--ink-100)'),
        borderRadius: 10,
        padding: 20,
        transition: 'border-color 120ms',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: tagDotR(routine.tag) }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {routine.tag}
              </span>
            </span>
            {routine.source === 'coach' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--ink-600)',
                background: 'var(--ink-100)',
                padding: '1px 6px',
                borderRadius: 3,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 500,
              }}>
                <Icon name="user" size={9} /> from coach
              </span>
            )}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink-900)', letterSpacing: '-0.01em' }}>{routine.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>
            {routine.exercises.length} exercises · {totalSets} sets · last {routine.lastUsed}
          </div>
        </div>
        <button onClick={onEdit} style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--ink-400)',
          cursor: 'pointer',
          padding: 4,
        }}><Icon name="more-horizontal" size={16} /></button>
      </div>

      {/* Exercise list (first 4) */}
      <div style={{
        background: 'var(--ink-50)',
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
      }}>
        {routine.exercises.slice(0, 4).map((ex, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: 'var(--ink-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</span>
            <span style={{ color: 'var(--ink-400)', fontFeatureSettings: '"tnum" 1', flexShrink: 0 }}>
              {ex.targetSets} × {ex.targetReps}{ex.targetKg ? ` · ${ex.targetKg}kg` : ''}
            </span>
          </div>
        ))}
        {routine.exercises.length > 4 && (
          <div style={{ color: 'var(--ink-400)', fontSize: 11 }}>+ {routine.exercises.length - 4} more</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <Button variant="dark" size="sm" icon="play" onClick={onStart} style={{ flex: 1, justifyContent: 'center' }}>
          Start
        </Button>
        <Button variant="secondary" size="sm" icon="edit-3" onClick={onEdit}>Edit</Button>
      </div>
    </div>
  );
}

function RoutinesScreen({ onStartRoutine }) {
  const [routines, setRoutines] = useStateRS(seedRoutines);
  const [filter, setFilter] = useStateRS('all');
  const [editing, setEditing] = useStateRS(null);    // null | routine object
  const [mode, setMode] = useStateRS(null);          // null | 'new' | 'edit'
  const mobile = useIsMobile();

  const visible = routines.filter(r => filter === 'all' || r.tag === filter);

  const openNew = () => {
    setEditing(null);
    setMode('new');
  };
  const openEdit = (routine) => {
    setEditing(routine);
    setMode('edit');
  };
  const close = () => { setMode(null); setEditing(null); };

  const handleSave = (data) => {
    if (data.id) {
      setRoutines(prev => prev.map(r => r.id === data.id ? { ...r, ...data, lastUsed: r.lastUsed } : r));
    } else {
      const id = 'r' + Date.now();
      setRoutines(prev => [{ ...data, id, lastUsed: 'never' }, ...prev]);
    }
    close();
  };

  return (
    <div style={{ padding: mobile ? '20px 16px 32px' : '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        alignItems: mobile ? 'flex-start' : 'baseline',
        flexDirection: mobile ? 'column' : 'row',
        gap: mobile ? 14 : 0,
        justifyContent: 'space-between',
        marginBottom: mobile ? 20 : 28,
      }}>
        <div>
          <Label style={{ marginBottom: 8 }}>Routines</Label>
          <h1 style={{ fontSize: mobile ? 28 : 36, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
            {routines.length} saved.
          </h1>
        </div>
        <Button variant="dark" icon="plus" onClick={openNew}>Create routine</Button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, overflowX: mobile ? 'auto' : 'visible' }}>
        {['all', 'push', 'pull', 'legs', 'upper', 'lower', 'full'].map(t => (
          <Chip key={t} active={filter === t} onClick={() => setFilter(t)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t !== 'all' && <span style={{ width: 6, height: 6, borderRadius: 999, background: tagDotR(t) }} />}
              {t === 'all' ? 'All' : t[0].toUpperCase() + t.slice(1)}
            </span>
          </Chip>
        ))}
      </div>

      {visible.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 14,
        }}>
          {visible.map(r => (
            <RoutineCard
              key={r.id}
              routine={r}
              onStart={() => onStartRoutine(r)}
              onEdit={() => openEdit(r)}
            />
          ))}
        </div>
      ) : (
        <div style={{
          padding: 60,
          textAlign: 'center',
          border: '1px dashed var(--ink-150)',
          borderRadius: 10,
          color: 'var(--ink-400)',
        }}>
          <Icon name="dumbbell" size={22} color="var(--ink-400)" />
          <div style={{ fontSize: 14, marginTop: 12 }}>No routines yet. Create one.</div>
        </div>
      )}

      {mode && (
        <RoutineBuilder
          initial={editing}
          onClose={close}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

Object.assign(window, { RoutinesScreen });
