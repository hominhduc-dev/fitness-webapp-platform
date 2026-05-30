/* global React, Icon, Label, Input, Tag, Button, useIsMobile */
const { useState: useStateRB, useEffect: useEffectRB, useMemo: useMemoRB } = React;

/* ============================================================
   RoutineBuilder — modal for creating / editing a workout routine
   ============================================================ */

const exerciseLibrary = [
  { name: 'Bench press',              muscle: 'chest',     equipment: 'barbell' },
  { name: 'Incline dumbbell press',   muscle: 'chest',     equipment: 'dumbbell' },
  { name: 'Cable triceps pushdown',   muscle: 'arms',      equipment: 'cable' },
  { name: 'Overhead press',           muscle: 'shoulders', equipment: 'barbell' },
  { name: 'Lateral raise',            muscle: 'shoulders', equipment: 'dumbbell' },
  { name: 'Deadlift',                 muscle: 'back',      equipment: 'barbell' },
  { name: 'Barbell row',              muscle: 'back',      equipment: 'barbell' },
  { name: 'Pull-up',                  muscle: 'back',      equipment: 'bodyweight' },
  { name: 'Lat pulldown',             muscle: 'back',      equipment: 'cable' },
  { name: 'Barbell squat',            muscle: 'legs',      equipment: 'barbell' },
  { name: 'Romanian deadlift',        muscle: 'legs',      equipment: 'barbell' },
  { name: 'Leg press',                muscle: 'legs',      equipment: 'machine' },
  { name: 'Barbell curl',             muscle: 'arms',      equipment: 'barbell' },
  { name: 'Hammer curl',              muscle: 'arms',      equipment: 'dumbbell' },
  { name: 'Calf raise',               muscle: 'legs',      equipment: 'machine' },
  { name: 'Plank',                    muscle: 'core',      equipment: 'bodyweight' },
];

const ROUTINE_TAGS = ['push', 'pull', 'legs', 'upper', 'lower', 'full'];

function tagDot(t) {
  return ({
    push: 'var(--accent)',
    pull: 'var(--ok)',
    legs: 'var(--warn)',
    upper: '#7c5dff',
    lower: '#1a8a8a',
    full: 'var(--ink-600)',
  })[t] || 'var(--ink-400)';
}

/* -------- ExercisePicker — sub-modal -------------------------------- */
function ExercisePicker({ onPick, onClose, existing }) {
  const [q, setQ] = useStateRB('');
  const [muscle, setMuscle] = useStateRB('all');
  const muscles = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
  const existingSet = new Set(existing.map(e => e.name));

  const visible = exerciseLibrary.filter(e => {
    if (muscle !== 'all' && e.muscle !== muscle) return false;
    if (q && !e.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(13,13,11,0.35)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 120, padding: 24,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--ink-0)',
        border: '1px solid var(--ink-100)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 480,
        maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px -12px rgba(13,13,11,0.25)',
      }}>
        <div style={{ padding: '20px 22px 12px', borderBottom: '1px solid var(--ink-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--ink-900)' }}>Add exercise</h3>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)' }}>
              <Icon name="x" size={18} />
            </button>
          </div>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Icon name="search" size={14} color="var(--ink-400)" style={{ position: 'absolute', left: 12, top: 11, pointerEvents: 'none' }} />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" style={{ paddingLeft: 34, width: '100%' }} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {muscles.map(m => (
              <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
                {m === 'all' ? 'All' : m[0].toUpperCase() + m.slice(1)}
              </Chip>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visible.map((ex, i) => {
            const added = existingSet.has(ex.name);
            return (
              <button
                key={ex.name}
                disabled={added}
                onClick={() => onPick(ex)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '12px 22px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: i < visible.length - 1 ? '1px solid var(--ink-100)' : 'none',
                  cursor: added ? 'default' : 'pointer',
                  textAlign: 'left',
                  opacity: added ? 0.5 : 1,
                  transition: 'background 120ms',
                }}
                onMouseEnter={e => { if (!added) e.currentTarget.style.background = 'var(--ink-50)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)' }}>{ex.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
                    {ex.muscle} · {ex.equipment}
                  </div>
                </div>
                {added
                  ? <span className="label" style={{ color: 'var(--ok)' }}>added</span>
                  : <Icon name="plus" size={16} color="var(--ink-400)" />}
              </button>
            );
          })}
        </div>

        <div style={{ borderTop: '1px solid var(--ink-100)', padding: '12px 22px', textAlign: 'center' }}>
          <button style={{
            border: 'none', background: 'transparent',
            color: 'var(--accent)', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', padding: '6px 10px',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="plus" size={14} color="var(--accent)" />
            Create custom exercise
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------- RoutineBuilder ----------------------------------------------- */
function RoutineBuilder({ initial, onClose, onSave }) {
  const [name, setName] = useStateRB(initial?.name || '');
  const [tag, setTag] = useStateRB(initial?.tag || 'push');
  const [exercises, setExercises] = useStateRB(initial?.exercises || []);
  const [showPicker, setShowPicker] = useStateRB(false);
  const mobile = useIsMobile();

  useEffectRB(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !showPicker) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, showPicker]);

  const totalSets = exercises.reduce((a, e) => a + (e.targetSets || 0), 0);

  const updateExercise = (idx, patch) => {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));
  };
  const removeExercise = (idx) => {
    setExercises(prev => prev.filter((_, i) => i !== idx));
  };
  const addExercise = (ex) => {
    setExercises(prev => [...prev, { ...ex, targetSets: 3, targetReps: 8, targetKg: 0 }]);
    setShowPicker(false);
  };
  const moveExercise = (idx, dir) => {
    setExercises(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const canSave = name.trim().length > 0 && exercises.length > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(13,13,11,0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: mobile ? 'stretch' : 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: mobile ? 0 : 24,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--ink-0)',
        borderRadius: mobile ? 0 : 14,
        width: '100%',
        maxWidth: mobile ? '100%' : 640,
        maxHeight: mobile ? '100%' : '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px -12px rgba(13,13,11,0.25)',
      }}>
        {/* Header */}
        <div style={{ padding: mobile ? '16px 16px 14px' : '24px 28px 18px', borderBottom: '1px solid var(--ink-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <Label style={{ marginBottom: 6 }}>{initial ? 'Edit routine' : 'New routine'}</Label>
              <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink-900)' }}>
                {name || 'Untitled routine'}
              </h2>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>
                {exercises.length} exercise{exercises.length === 1 ? '' : 's'} · {totalSets} set{totalSets === 1 ? '' : 's'}
              </div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)', padding: 4 }}>
              <Icon name="x" size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: 10, alignItems: mobile ? 'stretch' : 'center' }}>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Push day A"
              style={{ flex: 1, fontSize: 15 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {ROUTINE_TAGS.map(t => (
                <Chip key={t} active={tag === t} onClick={() => setTag(t)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: tagDot(t) }} />
                    {t[0].toUpperCase() + t.slice(1)}
                  </span>
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* Exercise list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? '8px 16px 16px' : '16px 28px 24px' }}>
          {exercises.length === 0 && (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              border: '1px dashed var(--ink-150)',
              borderRadius: 10,
              color: 'var(--ink-400)',
            }}>
              <Icon name="dumbbell" size={20} color="var(--ink-400)" />
              <div style={{ fontSize: 14, marginTop: 10 }}>No exercises yet. Add your first one.</div>
            </div>
          )}

          {exercises.map((ex, i) => (
            <div key={i} style={{
              background: 'var(--ink-0)',
              border: '1px solid var(--ink-100)',
              borderRadius: 10,
              padding: mobile ? 14 : '14px 18px',
              marginBottom: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12, fontWeight: 600,
                  color: 'var(--ink-400)',
                  minWidth: 18, textAlign: 'right',
                }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)' }}>{ex.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
                    {ex.muscle} · {ex.equipment}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => moveExercise(i, -1)} disabled={i === 0} style={{
                    border: 'none', background: 'transparent', cursor: i === 0 ? 'default' : 'pointer',
                    padding: 4, opacity: i === 0 ? 0.3 : 1, color: 'var(--ink-400)',
                  }}><Icon name="chevron-up" size={14} /></button>
                  <button onClick={() => moveExercise(i, 1)} disabled={i === exercises.length - 1} style={{
                    border: 'none', background: 'transparent', cursor: i === exercises.length - 1 ? 'default' : 'pointer',
                    padding: 4, opacity: i === exercises.length - 1 ? 0.3 : 1, color: 'var(--ink-400)',
                  }}><Icon name="chevron-down" size={14} /></button>
                  <button onClick={() => removeExercise(i)} style={{
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    padding: 4, color: 'var(--ink-400)',
                  }}><Icon name="trash-2" size={14} /></button>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
              }}>
                <FieldNum label="Sets" value={ex.targetSets} onChange={v => updateExercise(i, { targetSets: v })} />
                <FieldNum label="Reps" value={ex.targetReps} onChange={v => updateExercise(i, { targetReps: v })} />
                <FieldNum label="kg" value={ex.targetKg} onChange={v => updateExercise(i, { targetKg: v })} allowDecimals />
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowPicker(true)}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'transparent',
              border: '1px dashed var(--ink-150)',
              borderRadius: 10,
              color: 'var(--accent)',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 6,
              transition: 'background 120ms',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Icon name="plus" size={14} color="var(--accent)" />
            Add exercise
          </button>
        </div>

        {/* Footer */}
        <div style={{
          padding: mobile ? '12px 16px' : '16px 28px',
          borderTop: '1px solid var(--ink-100)',
          background: 'var(--ink-0)',
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
        }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="dark"
            onClick={() => canSave && onSave({ id: initial?.id, name: name.trim(), tag, exercises })}
            style={{ opacity: canSave ? 1 : 0.4, cursor: canSave ? 'pointer' : 'not-allowed' }}
          >
            {initial ? 'Save changes' : 'Save routine'}
          </Button>
        </div>
      </div>

      {showPicker && (
        <ExercisePicker
          existing={exercises}
          onPick={addExercise}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

function FieldNum({ label, value, onChange, allowDecimals }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <input
        type="number"
        value={value ?? ''}
        step={allowDecimals ? '0.5' : '1'}
        min="0"
        onChange={e => onChange(e.target.value === '' ? 0 : (allowDecimals ? parseFloat(e.target.value) : parseInt(e.target.value)))}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          padding: '6px 10px',
          border: '1px solid var(--ink-150)',
          borderRadius: 4,
          background: 'var(--ink-0)',
          color: 'var(--ink-800)',
          outline: 'none',
          textAlign: 'center',
          width: '100%',
          fontFeatureSettings: '"tnum" 1',
        }}
      />
    </div>
  );
}

Object.assign(window, { RoutineBuilder });
