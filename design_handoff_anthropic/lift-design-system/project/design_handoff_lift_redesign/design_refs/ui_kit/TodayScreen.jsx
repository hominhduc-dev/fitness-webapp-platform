/* global React, Button, Icon, NumInput, Tag, Label, Card, useIsMobile */
const { useState: useStateTD, useEffect: useEffectTD } = React;

/* ============================================================
   Today — active workout log. The hero screen.
   ============================================================ */

const initialExercises = [
  {
    id: 1,
    name: 'Bench press',
    note: '3 working sets · last 82.5 × 8',
    sets: [
      { id: 'a', kind: 'warm', kg: 60,   reps: 10, done: true,  prev: '— · —' },
      { id: 'b', kind: 'work', kg: 80,   reps: 8,  done: true,  prev: '80.0 × 8' },
      { id: 'c', kind: 'work', kg: 82.5, reps: 8,  done: false, prev: '82.5 × 8' },
      { id: 'd', kind: 'work', kg: 85,   reps: null, done: false, prev: '85.0 × 6' },
    ],
  },
  {
    id: 2,
    name: 'Incline dumbbell press',
    note: '3 working sets · last 30 × 10',
    sets: [
      { id: 'e', kind: 'work', kg: 28, reps: 10, done: false, prev: '28.0 × 10' },
      { id: 'f', kind: 'work', kg: 30, reps: null, done: false, prev: '30.0 × 10' },
      { id: 'g', kind: 'work', kg: 30, reps: null, done: false, prev: '30.0 × 8' },
    ],
  },
  {
    id: 3,
    name: 'Cable triceps pushdown',
    note: '4 working sets · last 25 × 12',
    sets: [
      { id: 'h', kind: 'work', kg: 25, reps: null, done: false, prev: '25.0 × 12' },
      { id: 'i', kind: 'work', kg: 27.5, reps: null, done: false, prev: '27.5 × 10' },
      { id: 'j', kind: 'work', kg: 30, reps: null, done: false, prev: '30.0 × 8' },
    ],
  },
];

function SetRow({ set, num, onToggle, onChange, mobile }) {
  const completed = set.done;
  const cols = mobile
    ? '36px 50px 1fr 1fr 32px'
    : '56px 70px 1fr 92px 92px 32px';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: cols,
      gap: mobile ? 8 : 12,
      alignItems: 'center',
      padding: mobile ? '10px 12px' : '10px 16px',
      borderBottom: '1px solid var(--ink-100)',
      background: completed ? 'var(--ink-50)' : 'transparent',
      fontFamily: 'var(--font-mono)',
      fontSize: 14,
      transition: 'background 180ms cubic-bezier(.2,.7,.2,1)',
    }}>
      <span style={{ fontWeight: 600, fontSize: 15, color: completed ? 'var(--ink-400)' : 'var(--ink-800)' }}>{num}</span>
      <span style={{
        fontSize: 10,
        color: set.kind === 'warm' ? 'var(--ink-400)' : (completed ? 'var(--ink-400)' : 'var(--ink-600)'),
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>{set.kind === 'warm' ? 'warm' : 'work'}</span>
      {!mobile && (
        <span style={{
          color: 'var(--ink-400)',
          fontSize: 13,
        }}>{set.prev}</span>
      )}
      <NumInput
        value={set.kg}
        onChange={e => onChange({ kg: parseFloat(e.target.value) || 0 })}
        style={{
          fontFamily: 'var(--font-mono)',
          textAlign: 'center',
          width: '100%',
          maxWidth: mobile ? '100%' : 76,
          color: completed ? 'var(--ink-400)' : 'var(--ink-800)',
          background: completed ? 'transparent' : '#fcfcfa',
          border: completed ? '1px solid transparent' : '1px solid var(--ink-150)',
          fontFeatureSettings: '"tnum" 1',
        }}
      />
      <NumInput
        value={set.reps ?? ''}
        onChange={e => onChange({ reps: e.target.value === '' ? null : parseInt(e.target.value) })}
        placeholder="—"
        style={{
          fontFamily: 'var(--font-mono)',
          textAlign: 'center',
          width: '100%',
          maxWidth: mobile ? '100%' : 76,
          color: completed ? 'var(--ink-400)' : 'var(--ink-800)',
          background: completed ? 'transparent' : '#fcfcfa',
          border: completed ? '1px solid transparent' : '1px solid var(--ink-150)',
          fontFeatureSettings: '"tnum" 1',
        }}
      />
      <button
        onClick={onToggle}
        aria-label={completed ? 'Mark incomplete' : 'Complete set'}
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          border: completed ? 'none' : '1.5px solid var(--ink-200)',
          background: completed ? 'var(--ok)' : 'transparent',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 180ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        {completed && <Icon name="check" size={14} color="#fff" />}
      </button>
    </div>
  );
}

function ExerciseBlock({ ex, onUpdate, onComplete, mobile }) {
  return (
    <div style={{
      background: 'var(--ink-0)',
      border: '1px solid var(--ink-100)',
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: mobile ? '14px 14px' : '16px 20px',
        borderBottom: '1px solid var(--ink-100)',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: mobile ? 16 : 18, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink-900)' }}>{ex.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.note}</div>
        </div>
        <button style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--ink-400)',
          cursor: 'pointer',
          padding: 6,
        }}><Icon name="more-horizontal" size={18} /></button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? '36px 50px 1fr 1fr 32px' : '56px 70px 1fr 92px 92px 32px',
        gap: mobile ? 8 : 12,
        padding: mobile ? '8px 12px' : '10px 16px 8px',
        borderBottom: '1px solid var(--ink-100)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--ink-400)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        <span>Set</span><span>Type</span>{!mobile && <span>Previous</span>}<span>kg</span><span>Reps</span><span></span>
      </div>

      {ex.sets.map((s, i) => (
        <SetRow
          key={s.id}
          set={s}
          num={i + 1}
          mobile={mobile}
          onToggle={() => { onUpdate(s.id, { done: !s.done }); if (!s.done) onComplete(ex, s); }}
          onChange={(patch) => onUpdate(s.id, patch)}
        />
      ))}

      <button
        onClick={() => {
          const last = ex.sets[ex.sets.length - 1];
          const newSet = { id: Math.random().toString(36).slice(2), kind: 'work', kg: last?.kg || 0, reps: null, done: false, prev: '— · —' };
          onUpdate('__add__', newSet);
        }}
        style={{
          width: '100%',
          padding: '10px 16px',
          background: 'transparent',
          border: 'none',
          color: 'var(--accent)',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          textAlign: 'left',
        }}
      >
        <Icon name="plus" size={14} color="var(--accent)" />
        Add set
      </button>
    </div>
  );
}

function TodayScreen({ onSetCompleted }) {
  const [exercises, setExercises] = useStateTD(initialExercises);
  const mobile = useIsMobile();

  const updateSet = (exId, setId, patch) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exId) return ex;
      if (setId === '__add__') return { ...ex, sets: [...ex.sets, patch] };
      return { ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, ...patch } : s) };
    }));
  };

  const startedAt = '08:42';
  const total = exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const done = exercises.reduce((acc, e) => acc + e.sets.filter(s => s.done).length, 0);
  const volume = exercises.reduce((acc, e) => acc + e.sets.filter(s => s.done).reduce((a, s) => a + (s.kg * (s.reps || 0)), 0), 0);

  return (
    <div style={{ padding: mobile ? '20px 16px 120px' : '32px 40px 120px', maxWidth: 880, margin: '0 auto' }}>
      <div style={{ marginBottom: mobile ? 20 : 28 }}>
        <Label style={{ marginBottom: 8 }}>Wednesday · March 19</Label>
        <h1 style={{ fontSize: mobile ? 28 : 40, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink-900)', margin: 0 }}>
          Today — Push day.
        </h1>
      </div>

      {/* Session stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 0,
        border: '1px solid var(--ink-100)',
        borderRadius: 10,
        marginBottom: mobile ? 20 : 28,
        background: 'var(--ink-0)',
        overflow: 'hidden',
      }}>
        {[
          { label: 'Started', value: startedAt, sub: '32 min ago' },
          { label: 'Sets', value: `${done} / ${total}`, sub: 'completed' },
          { label: 'Volume', value: `${(volume / 1000).toFixed(1)}k`, sub: 'kg lifted' },
          { label: 'Exercises', value: exercises.length, sub: 'planned' },
        ].map((s, i) => {
          const lastCol = mobile ? (i % 2 === 1) : (i === 3);
          const lastRow = mobile ? (i >= 2) : true;
          return (
            <div key={i} style={{
              padding: mobile ? '14px 16px' : '16px 20px',
              borderRight: lastCol ? 'none' : '1px solid var(--ink-100)',
              borderBottom: !lastRow ? '1px solid var(--ink-100)' : 'none',
            }}>
              <Label style={{ marginBottom: 6 }}>{s.label}</Label>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: 'var(--ink-900)', fontFeatureSettings: '"tnum" 1', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Exercises */}
      {exercises.map(ex => (
        <ExerciseBlock
          key={ex.id}
          ex={ex}
          mobile={mobile}
          onUpdate={(setId, patch) => updateSet(ex.id, setId, patch)}
          onComplete={(exercise, set) => onSetCompleted({ exercise: exercise.name, set })}
        />
      ))}

      {/* Add / finish */}
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 8 : 12, marginTop: 24 }}>
        <Button variant="secondary" icon="plus" style={mobile ? { justifyContent: 'center' } : undefined}>Add exercise</Button>
        {!mobile && <div style={{ flex: 1 }} />}
        {!mobile && <Button variant="ghost">Cancel</Button>}
        <Button variant="dark" style={mobile ? { justifyContent: 'center' } : undefined}>Finish workout</Button>
      </div>
    </div>
  );
}

Object.assign(window, { TodayScreen });
