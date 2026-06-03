/* global React, Icon, Label, Input, Chip, Tag, Button, useIsMobile, coachRoutineLibrary */
const { useState: useStateAW, useEffect: useEffectAW } = React;

/* ============================================================
   AssignWorkoutModal — from client detail, lets coach assign:
     - a one-off routine, OR
     - a multi-week program (starts on selected date)
   ============================================================ */

function tagDotAW(t) {
  return ({
    push: 'var(--accent)', pull: 'var(--ok)', legs: 'var(--warn)',
    upper: '#7c5dff', lower: '#1a8a8a', full: 'var(--ink-600)',
  })[t] || 'var(--ink-400)';
}

// 14-day window starting today (May 28, 2026 in this prototype)
const upcomingDays = [
  { date: 'May 28', day: 'Thu', label: 'Today',     iso: '2026-05-28' },
  { date: 'May 29', day: 'Fri', label: 'Tomorrow',  iso: '2026-05-29' },
  { date: 'May 30', day: 'Sat', iso: '2026-05-30' },
  { date: 'May 31', day: 'Sun', iso: '2026-05-31' },
  { date: 'Jun 1',  day: 'Mon', iso: '2026-06-01' },
  { date: 'Jun 2',  day: 'Tue', iso: '2026-06-02' },
  { date: 'Jun 3',  day: 'Wed', iso: '2026-06-03' },
  { date: 'Jun 4',  day: 'Thu', iso: '2026-06-04' },
  { date: 'Jun 5',  day: 'Fri', iso: '2026-06-05' },
  { date: 'Jun 6',  day: 'Sat', iso: '2026-06-06' },
  { date: 'Jun 7',  day: 'Sun', iso: '2026-06-07' },
  { date: 'Jun 8',  day: 'Mon', iso: '2026-06-08' },
  { date: 'Jun 9',  day: 'Tue', iso: '2026-06-09' },
  { date: 'Jun 10', day: 'Wed', iso: '2026-06-10' },
];

function AssignWorkoutModal({ client, programs = [], onClose, onAssign }) {
  const [tab, setTab] = useStateAW('routine');        // 'routine' | 'program'
  const [pickedRoutine, setPickedRoutine] = useStateAW(null);
  const [pickedProgram, setPickedProgram] = useStateAW(null);
  const [pickedDate, setPickedDate] = useStateAW('2026-05-28');
  const [note, setNote] = useStateAW('');
  const [q, setQ] = useStateAW('');
  const mobile = useIsMobile();

  useEffectAW(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filteredRoutines = (coachRoutineLibrary || []).filter(r =>
    !q || r.name.toLowerCase().includes(q.toLowerCase())
  );

  const canAssign = (tab === 'routine' && pickedRoutine && pickedDate) ||
                    (tab === 'program' && pickedProgram && pickedDate);

  const handleAssign = () => {
    if (!canAssign) return;
    onAssign({
      type: tab,
      target: tab === 'routine' ? pickedRoutine : pickedProgram,
      date: pickedDate,
      note: note.trim(),
      client: client.name,
    });
  };

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
        maxWidth: mobile ? '100%' : 580,
        maxHeight: mobile ? '100%' : '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px -12px rgba(13,13,11,0.25)',
      }}>

        {/* Header */}
        <div style={{ padding: mobile ? '18px 18px 12px' : '22px 24px 14px', borderBottom: '1px solid var(--ink-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <Label style={{ marginBottom: 6 }}>Assign to {client?.name || 'client'}</Label>
              <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink-900)' }}>
                Assign workout
              </h2>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)', padding: 4 }}>
              <Icon name="x" size={18} />
            </button>
          </div>

          {/* Tab toggle */}
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip active={tab === 'routine'} onClick={() => setTab('routine')}>
              Single routine
            </Chip>
            <Chip active={tab === 'program'} onClick={() => setTab('program')}>
              Full program
            </Chip>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? '16px 18px' : '20px 24px' }}>

          {tab === 'routine' && (
            <>
              <Label style={{ marginBottom: 10 }}>Pick a routine</Label>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Icon name="search" size={14} color="var(--ink-400)" style={{ position: 'absolute', left: 12, top: 11, pointerEvents: 'none' }} />
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" style={{ paddingLeft: 34, width: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 22 }}>
                {filteredRoutines.map(r => {
                  const isPicked = pickedRoutine?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setPickedRoutine(r)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px',
                        background: isPicked ? 'var(--ink-0)' : 'var(--ink-50)',
                        border: '1px solid ' + (isPicked ? 'var(--accent)' : 'var(--ink-100)'),
                        boxShadow: isPicked ? '0 0 0 3px var(--accent-soft, #eaeeff)' : 'none',
                        borderRadius: 8,
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'all 120ms',
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: tagDotAW(r.tag), flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-900)' }}>{r.name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
                          {r.tag} · {r.exercises} exercises
                        </div>
                      </div>
                      {isPicked && <Icon name="check" size={14} color="var(--accent)" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'program' && (
            <>
              <Label style={{ marginBottom: 10 }}>Pick a program</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
                {programs.map(p => {
                  const isPicked = pickedProgram?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPickedProgram(p)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '14px 16px',
                        background: isPicked ? 'var(--ink-0)' : 'var(--ink-50)',
                        border: '1px solid ' + (isPicked ? 'var(--accent)' : 'var(--ink-100)'),
                        boxShadow: isPicked ? '0 0 0 3px var(--accent-soft, #eaeeff)' : 'none',
                        borderRadius: 8,
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'all 120ms',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)' }}>{p.name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>
                          {p.weeks} weeks · {p.daysPerWeek} days/week · {p.assignedTo.length} on it
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--ink-600)', lineHeight: 1.45, marginTop: 6, marginBottom: 0 }}>
                          {p.description}
                        </p>
                      </div>
                      {isPicked && <Icon name="check" size={14} color="var(--accent)" />}
                    </button>
                  );
                })}
                {programs.length === 0 && (
                  <div style={{
                    padding: 30, textAlign: 'center',
                    border: '1px dashed var(--ink-150)', borderRadius: 8,
                    color: 'var(--ink-400)', fontSize: 13,
                  }}>
                    No programs yet. Build one first.
                  </div>
                )}
              </div>
            </>
          )}

          <Label style={{ marginBottom: 10 }}>
            {tab === 'program' ? 'Start date' : 'Schedule for'}
          </Label>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 22 }}>
            {upcomingDays.map(d => {
              const isPicked = pickedDate === d.iso;
              return (
                <button
                  key={d.iso}
                  onClick={() => setPickedDate(d.iso)}
                  style={{
                    flexShrink: 0,
                    minWidth: 62,
                    padding: '8px 10px',
                    border: '1px solid ' + (isPicked ? 'var(--accent)' : 'var(--ink-150)'),
                    boxShadow: isPicked ? '0 0 0 3px var(--accent-soft, #eaeeff)' : 'none',
                    background: isPicked ? 'var(--ink-0)' : 'var(--ink-0)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    color: isPicked ? 'var(--accent)' : 'var(--ink-800)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    transition: 'all 120ms',
                  }}
                >
                  <span style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-400)' }}>
                    {d.label || d.day}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>
                    {d.date.split(' ')[1]}
                  </span>
                  <span style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-400)' }}>
                    {d.date.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          <Label style={{ marginBottom: 10 }}>Note to client (optional)</Label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Focus on bar path on bench. Video your top set."
            rows={3}
            style={{
              fontFamily: 'var(--font-sans)', fontSize: 13,
              padding: '10px 12px',
              border: '1px solid var(--ink-150)',
              borderRadius: 4,
              background: '#fcfcfa',
              color: 'var(--ink-800)',
              outline: 'none',
              width: '100%',
              resize: 'vertical',
              lineHeight: 1.5,
            }}
          />

          {/* Preview */}
          {canAssign && (
            <div style={{
              marginTop: 20,
              padding: '14px 16px',
              background: 'var(--ink-50)',
              border: '1px solid var(--ink-100)',
              borderRadius: 8,
            }}>
              <Label style={{ marginBottom: 6 }}>Preview</Label>
              <div style={{ fontSize: 13, color: 'var(--ink-800)', lineHeight: 1.55 }}>
                {client.name} will see <span style={{ fontWeight: 500 }}>
                  {tab === 'routine' ? pickedRoutine.name : `${pickedProgram.name} (${pickedProgram.weeks}-week program)`}
                </span>{tab === 'program' ? ' starting' : ' on'}{' '}
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  {upcomingDays.find(d => d.iso === pickedDate)?.date}
                </span>{tab === 'program' ? '.' : '.'}
              </div>
              {note && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-600)', fontStyle: 'italic' }}>
                  "{note}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: mobile ? '12px 18px' : '16px 24px',
          borderTop: '1px solid var(--ink-100)',
          background: 'var(--ink-0)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="dark"
            icon="check"
            onClick={handleAssign}
            style={{ opacity: canAssign ? 1 : 0.4, cursor: canAssign ? 'pointer' : 'not-allowed' }}
          >
            Assign
          </Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AssignWorkoutModal });
