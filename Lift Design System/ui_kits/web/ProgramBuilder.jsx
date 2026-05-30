/* global React, Icon, Label, Input, Chip, Tag, Button, useIsMobile */
const { useState: useStatePB, useEffect: useEffectPB, useMemo: useMemoPB } = React;

/* ============================================================
   ProgramBuilder — modal for creating / editing a multi-week
   training program. Coach picks length (weeks) + days/week, then
   drops a routine into each session slot.
   ============================================================ */

const coachRoutineLibrary = [
  { id: 'cr1', name: 'Push day A',   tag: 'push',  exercises: 5 },
  { id: 'cr2', name: 'Push day B',   tag: 'push',  exercises: 4 },
  { id: 'cr3', name: 'Pull day A',   tag: 'pull',  exercises: 5 },
  { id: 'cr4', name: 'Pull day B',   tag: 'pull',  exercises: 4 },
  { id: 'cr5', name: 'Leg day A',    tag: 'legs',  exercises: 4 },
  { id: 'cr6', name: 'Leg day B',    tag: 'legs',  exercises: 5 },
  { id: 'cr7', name: 'Upper — heavy', tag: 'upper', exercises: 6 },
  { id: 'cr8', name: 'Upper — volume', tag: 'upper', exercises: 7 },
  { id: 'cr9', name: 'Lower — heavy', tag: 'lower', exercises: 5 },
  { id: 'cr10', name: 'Full body',   tag: 'full',  exercises: 6 },
  { id: 'cr11', name: 'Accessory',   tag: 'upper', exercises: 4 },
  { id: 'cr12', name: 'Conditioning', tag: 'full', exercises: 3 },
];

function tagDotPB(t) {
  return ({
    push: 'var(--accent)',
    pull: 'var(--ok)',
    legs: 'var(--warn)',
    upper: '#7c5dff',
    lower: '#1a8a8a',
    full: 'var(--ink-600)',
  })[t] || 'var(--ink-400)';
}

/* -------- RoutinePicker — sub-popover for slot selection ----------- */
function RoutinePicker({ onPick, onClose, onCreateNew, library }) {
  const [q, setQ] = useStatePB('');
  const visible = (library || coachRoutineLibrary).filter(r =>
    !q || r.name.toLowerCase().includes(q.toLowerCase())
  );

  useEffectPB(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(13,13,11,0.35)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 24,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--ink-0)',
        border: '1px solid var(--ink-100)',
        borderRadius: 12,
        width: '100%', maxWidth: 380, maxHeight: '70vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px -12px rgba(13,13,11,0.25)',
      }}>
        <div style={{ padding: '16px 18px 10px', borderBottom: '1px solid var(--ink-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Pick a routine</h3>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)' }}>
              <Icon name="x" size={16} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={13} color="var(--ink-400)" style={{ position: 'absolute', left: 11, top: 10, pointerEvents: 'none' }} />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" style={{ paddingLeft: 32, width: '100%', fontSize: 13 }} autoFocus />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visible.map((r, i) => (
            <button
              key={r.id}
              onClick={() => onPick(r)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 18px',
                background: 'transparent', border: 'none',
                borderBottom: i < visible.length - 1 ? '1px solid var(--ink-100)' : 'none',
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 120ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: tagDotPB(r.tag), flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-900)' }}>{r.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
                  {r.tag} · {r.exercises} exercises
                </div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--ink-100)', padding: '10px 18px', textAlign: 'center' }}>
          <button onClick={onCreateNew} style={{
            border: 'none', background: 'transparent',
            color: 'var(--accent)', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Icon name="plus" size={12} color="var(--accent)" />
            Create new routine
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------- ProgramBuilder ------------------------------------------- */
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function makeEmptySchedule(weeks, daysPerWeek = 4) {
  // Default day pattern based on daysPerWeek
  const patterns = {
    3: [true, false, true, false, true, false, false],
    4: [true, true, false, true, false, true, false],
    5: [true, true, false, true, true, false, true],
    6: [true, true, true, false, true, true, true],
    7: [true, true, true, true, true, true, true],
  };
  const isWorkout = patterns[daysPerWeek] || patterns[4];
  return Array.from({ length: weeks }, () =>
    isWorkout.map(work => work ? { routine: null } : null)
  );
}

function ProgramBuilder({ initial, onClose, onSave }) {
  const [name, setName] = useStatePB(initial?.name || '');
  const [description, setDescription] = useStatePB(initial?.description || '');
  const [weeks, setWeeks] = useStatePB(initial?.weeks || 8);
  const [daysPerWeek, setDaysPerWeek] = useStatePB(initial?.daysPerWeek || 4);
  const [schedule, setSchedule] = useStatePB(
    initial?.schedule || makeEmptySchedule(initial?.weeks || 8, initial?.daysPerWeek || 4)
  );
  const [pickerSlot, setPickerSlot] = useStatePB(null); // { week, day }
  const [activeWeek, setActiveWeek] = useStatePB(0);
  const [library, setLibrary] = useStatePB(coachRoutineLibrary);
  const [creatingRoutine, setCreatingRoutine] = useStatePB(false);
  const mobile = useIsMobile();

  useEffectPB(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !pickerSlot) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, pickerSlot]);

  // When weeks or days/week changes, regenerate empty schedule (preserve existing slots if possible)
  const updateLength = (newWeeks, newDays) => {
    const newSched = makeEmptySchedule(newWeeks, newDays);
    // Try to preserve existing slot routines
    for (let w = 0; w < Math.min(weeks, newWeeks); w++) {
      for (let d = 0; d < 7; d++) {
        if (schedule[w]?.[d]?.routine && newSched[w]?.[d]) {
          newSched[w][d] = schedule[w][d];
        }
      }
    }
    setSchedule(newSched);
    setWeeks(newWeeks);
    setDaysPerWeek(newDays);
    if (activeWeek >= newWeeks) setActiveWeek(newWeeks - 1);
  };

  const assignSlot = (routine) => {
    const { week, day } = pickerSlot;
    setSchedule(prev => {
      const next = prev.map(w => w.slice());
      if (next[week][day]) {
        next[week][day] = { routine };
      } else {
        next[week][day] = { routine };
      }
      return next;
    });
    setPickerSlot(null);
  };

  // Build a routine from the RoutineBuilder, add to library, and drop it into the slot
  const handleCreateRoutine = (data) => {
    const newRoutine = {
      id: 'cr' + Date.now(),
      name: data.name,
      tag: data.tag,
      exercises: Array.isArray(data.exercises) ? data.exercises.length : (data.exercises || 0),
    };
    setLibrary(prev => [newRoutine, ...prev]);
    if (pickerSlot) {
      const { week, day } = pickerSlot;
      setSchedule(prev => {
        const next = prev.map(w => w.slice());
        if (next[week] && next[week][day] !== undefined) next[week][day] = { routine: newRoutine };
        return next;
      });
    }
    setCreatingRoutine(false);
    setPickerSlot(null);
  };
  const clearSlot = (week, day) => {    setSchedule(prev => {
      const next = prev.map(w => w.slice());
      if (next[week][day]) next[week][day] = { routine: null };
      return next;
    });
  };

  const toggleSlot = (week, day) => {
    setSchedule(prev => {
      const next = prev.map(w => w.slice());
      if (next[week][day]) {
        next[week][day] = null;
      } else {
        next[week][day] = { routine: null };
      }
      return next;
    });
  };

  // Copy current week to remaining weeks
  const copyWeekToAll = () => {
    setSchedule(prev => {
      const source = prev[activeWeek];
      return prev.map((w, i) => i === activeWeek ? w : source.map(slot => slot ? { ...slot } : null));
    });
  };

  // Stats
  const filledSlots = schedule.reduce((acc, week) =>
    acc + week.filter(s => s && s.routine).length, 0);
  const totalSlots = schedule.reduce((acc, week) =>
    acc + week.filter(s => s !== null).length, 0);
  const completion = totalSlots > 0 ? (filledSlots / totalSlots) * 100 : 0;

  const canSave = name.trim().length > 0 && filledSlots > 0;

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
        maxWidth: mobile ? '100%' : 880,
        maxHeight: mobile ? '100%' : '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px -12px rgba(13,13,11,0.25)',
      }}>

        {/* Header */}
        <div style={{ padding: mobile ? '16px 16px 14px' : '24px 28px 18px', borderBottom: '1px solid var(--ink-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Label style={{ marginBottom: 6 }}>{initial ? 'Edit program' : 'New program'}</Label>
              <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink-900)' }}>
                {name || 'Untitled program'}
              </h2>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>
                {weeks} weeks · {daysPerWeek} days/week · {filledSlots}/{totalSlots} sessions filled
              </div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)', padding: 4 }}>
              <Icon name="x" size={18} />
            </button>
          </div>

          {/* Meta inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1.4fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Strength block — 12w" autoFocus />
            <select
              value={weeks}
              onChange={e => updateLength(parseInt(e.target.value), daysPerWeek)}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: 14, padding: '8px 10px',
                border: '1px solid var(--ink-150)', borderRadius: 4,
                background: 'var(--ink-0)', color: 'var(--ink-800)',
                cursor: 'pointer',
              }}
            >
              {[4, 6, 8, 10, 12, 16].map(w => <option key={w} value={w}>{w} weeks</option>)}
            </select>
            <select
              value={daysPerWeek}
              onChange={e => updateLength(weeks, parseInt(e.target.value))}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: 14, padding: '8px 10px',
                border: '1px solid var(--ink-150)', borderRadius: 4,
                background: 'var(--ink-0)', color: 'var(--ink-800)',
                cursor: 'pointer',
              }}
            >
              {[3, 4, 5, 6].map(d => <option key={d} value={d}>{d} days/week</option>)}
            </select>
          </div>
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short description (e.g. Heavy compounds Mon/Thu, accessory volume Tue/Sat)"
            style={{ fontSize: 13 }}
          />
        </div>

        {/* Week selector + actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: mobile ? '12px 16px' : '14px 28px',
          borderBottom: '1px solid var(--ink-100)',
          background: 'var(--ink-50)',
          flexWrap: 'wrap',
        }}>
          <Label>Week</Label>
          <div style={{ display: 'flex', gap: 4, flex: 1, overflowX: 'auto', paddingBottom: 2 }}>
            {Array.from({ length: weeks }).map((_, i) => {
              const isActive = activeWeek === i;
              const wFilled = schedule[i].filter(s => s && s.routine).length;
              const wTotal = schedule[i].filter(s => s !== null).length;
              const full = wFilled === wTotal && wTotal > 0;
              return (
                <button
                  key={i}
                  onClick={() => setActiveWeek(i)}
                  style={{
                    padding: '5px 10px',
                    minWidth: 38,
                    background: isActive ? 'var(--ink-900)' : 'var(--ink-0)',
                    color: isActive ? 'var(--ink-0)' : 'var(--ink-800)',
                    border: '1px solid ' + (isActive ? 'var(--ink-900)' : 'var(--ink-150)'),
                    borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    transition: 'all 120ms',
                  }}
                >
                  <span>w{i + 1}</span>
                  <span style={{
                    width: 4, height: 4, borderRadius: 999,
                    background: full ? (isActive ? 'var(--accent)' : 'var(--ok)') : (isActive ? 'var(--ink-400)' : 'var(--ink-200)'),
                  }} />
                </button>
              );
            })}
          </div>
          {weeks > 1 && (
            <Button variant="ghost" size="sm" icon="copy" onClick={copyWeekToAll}>
              Copy w{activeWeek + 1} to all
            </Button>
          )}
        </div>

        {/* Schedule grid for active week */}
        <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? '16px' : '20px 28px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(7, 1fr)',
            gap: 10,
          }}>
            {DAY_LABELS.map((d, idx) => {
              const slot = schedule[activeWeek][idx];
              const isRest = slot === null;
              return (
                <SessionSlot
                  key={idx}
                  day={d}
                  slot={slot}
                  onClick={() => {
                    if (isRest) {
                      toggleSlot(activeWeek, idx);
                    } else {
                      setPickerSlot({ week: activeWeek, day: idx });
                    }
                  }}
                  onClear={() => clearSlot(activeWeek, idx)}
                  onToggleRest={() => toggleSlot(activeWeek, idx)}
                />
              );
            })}
          </div>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--ink-100)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Label>Program completion</Label>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-600)', fontFeatureSettings: '"tnum" 1' }}>
                {Math.round(completion)}%
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: completion + '%',
                background: completion === 100 ? 'var(--ok)' : 'var(--accent)',
                transition: 'width 180ms',
              }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 10, lineHeight: 1.5 }}>
              Tap a session to swap routine · tap a rest day to add a session · use "Copy w{activeWeek + 1} to all" if every week is identical.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: mobile ? '12px 16px' : '16px 28px',
          borderTop: '1px solid var(--ink-100)',
          background: 'var(--ink-0)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="dark"
            onClick={() => canSave && onSave({
              id: initial?.id, name: name.trim(), description, weeks, daysPerWeek, schedule,
            })}
            style={{ opacity: canSave ? 1 : 0.4, cursor: canSave ? 'pointer' : 'not-allowed' }}
          >
            {initial ? 'Save changes' : 'Save program'}
          </Button>
        </div>
      </div>

      {pickerSlot && !creatingRoutine && (
        <RoutinePicker
          library={library}
          onPick={assignSlot}
          onCreateNew={() => setCreatingRoutine(true)}
          onClose={() => setPickerSlot(null)}
        />
      )}

      {creatingRoutine && (
        <RoutineBuilder
          onClose={() => setCreatingRoutine(false)}
          onSave={handleCreateRoutine}
        />
      )}
    </div>
  );
}

function SessionSlot({ day, slot, onClick, onClear, onToggleRest }) {
  const isRest = slot === null;
  const isEmpty = slot && !slot.routine;
  const filled = slot && slot.routine;
  const [hover, setHover] = useStatePB(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        border: '1px ' + (isRest ? 'dashed' : 'solid') + ' var(--ink-' + (hover ? '150' : '100') + ')',
        borderRadius: 8,
        padding: 12,
        background: isRest ? 'transparent' : (filled ? 'var(--ink-0)' : 'var(--ink-50)'),
        minHeight: 100,
        display: 'flex', flexDirection: 'column', gap: 8,
        cursor: 'pointer',
        transition: 'all 120ms',
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em',
          fontWeight: 500,
        }}>{day}</span>
        {hover && !isRest && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleRest(); }}
            title="Mark as rest day"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)', padding: 0 }}
          >
            <Icon name="x" size={12} />
          </button>
        )}
      </div>

      {filled ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: tagDotPB(slot.routine.tag) }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {slot.routine.tag}
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-900)', lineHeight: 1.25 }}>
            {slot.routine.name}
          </div>
        </>
      ) : isEmpty ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-400)' }}>
          <Icon name="plus" size={16} color="var(--ink-400)" />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-300, var(--ink-400))', fontSize: 11, opacity: 0.5 }}>
          Rest
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ProgramBuilder, coachRoutineLibrary });
