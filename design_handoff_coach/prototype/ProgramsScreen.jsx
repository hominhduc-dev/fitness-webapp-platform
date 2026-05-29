/* global React, Icon, Label, Chip, Tag, Button, Avatar, ProgramBuilder, useIsMobile */
const { useState: useStatePS, useEffect: useEffectPS, useRef: useRefPS } = React;

/* Roster the coach can assign a program to (initials drive the avatar). */
const assignableClients = [
  { name: 'Maya Reyes',  initials: 'MR' },
  { name: 'Theo Sato',   initials: 'TS' },
  { name: 'Hana Kim',    initials: 'HK' },
  { name: 'Devon Lee',   initials: 'DL' },
  { name: 'Priya Anand', initials: 'PA' },
  { name: 'Sam Okafor',  initials: 'SO' },
  { name: 'Lila Brooks', initials: 'LB' },
  { name: 'Noah West',   initials: 'NW' },
  { name: 'Jon B.',      initials: 'JB' },
];

/* ============================================================
   ProgramsScreen — coach's list of programs they've authored
   ============================================================ */

const seedPrograms = [
  {
    id: 'p1',
    name: 'Strength block — 12w',
    description: 'Heavy compounds Mon/Thu, accessory volume Tue/Sat. Built for intermediate lifters with 2+ years training.',
    weeks: 12,
    daysPerWeek: 4,
    assignedTo: [
      { name: 'Maya Reyes',  initials: 'MR', week: 3 },
      { name: 'Devon Lee',   initials: 'DL', week: 5 },
      { name: 'Priya Anand', initials: 'PA', week: 1 },
    ],
    lastEdited: '4 days ago',
  },
  {
    id: 'p2',
    name: 'Beginner LP — 8w',
    description: 'Linear progression for novices. Bench, squat, deadlift, OHP, row. Three days a week.',
    weeks: 8,
    daysPerWeek: 3,
    assignedTo: [
      { name: 'Hana Kim',   initials: 'HK', week: 6 },
      { name: 'Lila Brooks', initials: 'LB', week: 2 },
    ],
    lastEdited: '2 weeks ago',
  },
  {
    id: 'p3',
    name: 'Hypertrophy block — 8w',
    description: 'Volume-focused. Push/pull/legs split, 5 days/week. For lifters wanting size, not pure strength.',
    weeks: 8,
    daysPerWeek: 5,
    assignedTo: [
      { name: 'Theo Sato',   initials: 'TS', week: 2 },
      { name: 'Sam Okafor',  initials: 'SO', week: 4 },
      { name: 'Noah West',   initials: 'NW', week: 2 },
      { name: 'Jon B.',      initials: 'JB', week: 1 },
    ],
    lastEdited: '3 days ago',
  },
  {
    id: 'p4',
    name: 'Cut + maintain — 6w',
    description: 'For clients in a calorie deficit. Lower volume, keep strength. 4 days, upper/lower.',
    weeks: 6,
    daysPerWeek: 4,
    assignedTo: [],
    lastEdited: 'yesterday',
  },
];

function ProgramCard({ program, onEdit, onAssign, onDuplicate, onDelete }) {
  const [hover, setHover] = useStatePS(false);
  const [menuOpen, setMenuOpen] = useStatePS(false);
  const menuRef = useRefPS(null);

  useEffectPS(() => {
    if (!menuOpen) return;
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const menuItems = [
    { label: 'Edit program', icon: 'edit-3',  onClick: onEdit },
    { label: 'Assign',       icon: 'user-plus', onClick: onAssign },
    { label: 'Duplicate',    icon: 'copy',    onClick: onDuplicate },
    { label: 'Delete',       icon: 'trash-2', onClick: onDelete, danger: true },
  ];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--ink-0)',
        border: '1px solid ' + (hover ? 'var(--ink-150)' : 'var(--ink-100)'),
        borderRadius: 10,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        transition: 'border-color 120ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink-900)', letterSpacing: '-0.01em' }}>
            {program.name}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>
            {program.weeks} weeks · {program.daysPerWeek} days/week
          </div>
        </div>
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Program actions"
            style={{
              border: 'none',
              background: menuOpen ? 'var(--ink-100)' : 'transparent',
              color: menuOpen ? 'var(--ink-800)' : 'var(--ink-400)',
              cursor: 'pointer', padding: 5, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 120ms',
            }}
          ><Icon name="more-horizontal" size={16} /></button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', right: 0,
              minWidth: 168,
              background: 'var(--ink-0)',
              border: '1px solid var(--ink-100)',
              borderRadius: 8,
              boxShadow: '0 16px 40px -12px rgba(13,13,11,0.22)',
              padding: 4,
              zIndex: 30,
            }}>
              {menuItems.map((it, i) => (
                <button
                  key={it.label}
                  onClick={() => { setMenuOpen(false); it.onClick && it.onClick(); }}
                  onMouseEnter={e => e.currentTarget.style.background = it.danger ? 'var(--danger-soft, #fbecec)' : 'var(--ink-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '8px 10px',
                    background: 'transparent', border: 'none', borderRadius: 5,
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font-sans)', fontSize: 13,
                    color: it.danger ? 'var(--danger)' : 'var(--ink-800)',
                    marginTop: it.danger ? 4 : 0,
                    borderTop: it.danger ? '1px solid var(--ink-100)' : 'none',
                    transition: 'background 120ms',
                  }}
                >
                  <Icon name={it.icon} size={14} color={it.danger ? 'var(--danger)' : 'var(--ink-400)'} />
                  {it.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.5, margin: 0 }}>
        {program.description}
      </p>

      {/* Assigned avatars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--ink-50)', borderRadius: 6 }}>
        {program.assignedTo.length > 0 ? (
          <>
            <div style={{ display: 'flex' }}>
              {program.assignedTo.slice(0, 4).map((c, i) => (
                <div key={i} style={{ marginLeft: i > 0 ? -8 : 0, border: '2px solid var(--ink-50)', borderRadius: '50%' }}>
                  <Avatar initials={c.initials} size={26} />
                </div>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-600)' }}>
              {program.assignedTo.length} active client{program.assignedTo.length === 1 ? '' : 's'}
            </div>
          </>
        ) : (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Not assigned yet
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <Button variant="dark" size="sm" icon="user-plus" onClick={onAssign} style={{ flex: 1, justifyContent: 'center' }}>
          Assign
        </Button>
        <Button variant="secondary" size="sm" icon="edit-3" onClick={onEdit}>Edit</Button>
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Edited {program.lastEdited}
      </div>
    </div>
  );
}

function ProgramsScreen() {
  const [programs, setPrograms] = useStatePS(seedPrograms);
  const [mode, setMode] = useStatePS(null);     // null | 'new' | 'edit'
  const [editing, setEditing] = useStatePS(null);
  const [assignTarget, setAssignTarget] = useStatePS(null); // program being assigned
  const mobile = useIsMobile();

  const openNew = () => { setEditing(null); setMode('new'); };
  const openEdit = (p) => { setEditing(p); setMode('edit'); };
  const close = () => { setMode(null); setEditing(null); };

  const handleSave = (data) => {
    if (data.id) {
      setPrograms(prev => prev.map(p => p.id === data.id ? { ...p, ...data, lastEdited: 'just now' } : p));
    } else {
      const id = 'p' + Date.now();
      setPrograms(prev => [{ ...data, id, assignedTo: [], lastEdited: 'just now' }, ...prev]);
    }
    close();
  };

  const handleDuplicate = (p) => {
    const id = 'p' + Date.now();
    setPrograms(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      const copy = { ...p, id, name: p.name + ' (copy)', assignedTo: [], lastEdited: 'just now' };
      const next = prev.slice();
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const handleDelete = (p) => {
    if (!window.confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    setPrograms(prev => prev.filter(x => x.id !== p.id));
  };

  const handleAssignSave = (selected) => {
    setPrograms(prev => prev.map(p =>
      p.id === assignTarget.id
        ? { ...p, assignedTo: selected.map(c => ({ ...c, week: 1 })), lastEdited: 'just now' }
        : p
    ));
    setAssignTarget(null);
  };

  const totalClients = programs.reduce((a, p) => a + p.assignedTo.length, 0);

  return (
    <div style={{ padding: mobile ? '20px 16px 32px' : '32px 36px', overflowY: 'auto', height: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: mobile ? 'flex-start' : 'baseline',
        flexDirection: mobile ? 'column' : 'row',
        gap: mobile ? 14 : 0,
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <Label style={{ marginBottom: 8 }}>Programs</Label>
          <h1 style={{ fontSize: mobile ? 28 : 36, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
            {programs.length} authored.
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-400)', marginTop: 6 }}>
            {totalClients} clients training on a program · {programs.filter(p => p.assignedTo.length === 0).length} unassigned
          </div>
        </div>
        <Button variant="dark" icon="plus" onClick={openNew}>New program</Button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 14,
      }}>
        {programs.map(p => (
          <ProgramCard
            key={p.id}
            program={p}
            onEdit={() => openEdit(p)}
            onAssign={() => setAssignTarget(p)}
            onDuplicate={() => handleDuplicate(p)}
            onDelete={() => handleDelete(p)}
          />
        ))}
      </div>

      {mode && (
        <ProgramBuilder
          initial={editing}
          onClose={close}
          onSave={handleSave}
        />
      )}

      {assignTarget && (
        <AssignClientsModal
          program={assignTarget}
          roster={assignableClients}
          onClose={() => setAssignTarget(null)}
          onSave={handleAssignSave}
        />
      )}
    </div>
  );
}

function AssignClientsModal({ program, roster, onClose, onSave }) {
  const preselected = (program.assignedTo || []).map(c => c.initials);
  const [selected, setSelected] = useStatePS(preselected);
  const [q, setQ] = useStatePS('');
  const mobile = useIsMobile();

  useEffectPS(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (initials) =>
    setSelected(prev => prev.includes(initials) ? prev.filter(i => i !== initials) : [...prev, initials]);

  const visible = roster.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  const chosen = roster.filter(c => selected.includes(c.initials));

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(13,13,11,0.45)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'center',
        zIndex: 100, padding: mobile ? 0 : 24,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--ink-0)',
        borderRadius: mobile ? 0 : 14,
        width: '100%', maxWidth: mobile ? '100%' : 480,
        maxHeight: mobile ? '100%' : '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px -12px rgba(13,13,11,0.25)',
      }}>
        <div style={{ padding: mobile ? '18px 18px 12px' : '22px 24px 14px', borderBottom: '1px solid var(--ink-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <Label style={{ marginBottom: 6 }}>Assign program</Label>
              <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink-900)' }}>
                {program.name}
              </h2>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>
                {program.weeks} weeks · {program.daysPerWeek} days/week
              </div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)', padding: 4 }}>
              <Icon name="x" size={18} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={14} color="var(--ink-400)" style={{ position: 'absolute', left: 12, top: 11, pointerEvents: 'none' }} />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search clients…" style={{ paddingLeft: 34, width: '100%' }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {visible.map(c => {
            const on = selected.includes(c.initials);
            return (
              <button
                key={c.initials}
                onClick={() => toggle(c.initials)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: mobile ? '12px 18px' : '11px 24px',
                  background: on ? 'var(--ink-50)' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  transition: 'background 120ms',
                }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--ink-50)'; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}
              >
                <Avatar initials={c.initials} size={32} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--ink-900)' }}>{c.name}</span>
                <span style={{
                  width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                  border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--ink-150)'),
                  background: on ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 120ms',
                }}>
                  {on && <Icon name="check" size={13} color="#fff" />}
                </span>
              </button>
            );
          })}
          {visible.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>
              No clients match.
            </div>
          )}
        </div>

        <div style={{
          padding: mobile ? '12px 18px' : '16px 24px',
          borderTop: '1px solid var(--ink-100)',
          background: 'var(--ink-0)',
          display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)' }}>
            {chosen.length} selected
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="dark" icon="check" onClick={() => onSave(chosen)}>
              {chosen.length === 0 ? 'Clear assignments' : `Assign ${chosen.length}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProgramsScreen, seedPrograms });
