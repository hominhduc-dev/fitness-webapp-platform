/* global React, Icon, Label, Tag, Button, Chip, Input, useIsMobile, AdminHeader, adminExercises */
const { useState: useStateEX, useMemo: useMemoEX } = React;

const MUSCLES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Glutes', 'Calves'];
const EQUIP = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Smith Machine', 'EZ Bar', 'Kettlebell'];

function GroupBlock({ group, exercises, open, onToggle, onEdit, onDelete }) {
  return (
    <div style={{ border: '1px solid var(--ink-100)', borderRadius: 10, overflow: 'hidden', background: 'var(--ink-0)' }}>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
        padding: '13px 16px', border: 'none', background: open ? 'var(--ink-50)' : 'transparent', cursor: 'pointer',
      }}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} color="var(--ink-400)" />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)', flex: 1 }}>{group}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>{exercises.length} variations</span>
        <Tag tone="neutral">{exercises.reduce((a, e) => a + e.usageCount, 0).toLocaleString()} uses</Tag>
      </button>
      {open && (
        <div>
          {exercises.map(e => (
            <div key={e.id} style={{
              display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) 80px 70px auto',
              gap: 10, alignItems: 'center', padding: '9px 16px', borderTop: '1px solid var(--ink-50)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                {e.isDefault && <Tag tone="pr">Default</Tag>}
              </div>
              <span style={{ fontSize: 12, color: 'var(--ink-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.variationName}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>{e.equipment}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)', textAlign: 'right' }}>{e.usageCount}</span>
              <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <button onClick={() => onEdit(e)} title="Edit" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)', padding: 5, borderRadius: 5 }}
                  onMouseEnter={ev => ev.currentTarget.style.background = 'var(--ink-100)'} onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                  <Icon name="pencil" size={14} />
                </button>
                <button onClick={() => onDelete(e)} title="Delete" disabled={e.usageCount > 0}
                  style={{ border: 'none', background: 'transparent', cursor: e.usageCount > 0 ? 'not-allowed' : 'pointer', color: e.usageCount > 0 ? 'var(--ink-150)' : 'var(--danger)', padding: 5, borderRadius: 5 }}
                  onMouseEnter={ev => { if (e.usageCount === 0) ev.currentTarget.style.background = 'var(--danger-soft)'; }}
                  onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                  <Icon name="trash-2" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExerciseFormModal({ initial, onClose, onSave }) {
  const mobile = useIsMobile();
  const [name, setName] = useStateEX(initial ? initial.name : '');
  const [variationName, setVar] = useStateEX(initial ? initial.variationName : 'Default');
  const [muscleGroup, setMG] = useStateEX(initial ? initial.muscleGroup : 'Chest');
  const [equipment, setEq] = useStateEX(initial ? initial.equipment : 'Barbell');
  const canSave = name.trim();
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,13,11,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'center', zIndex: 100, padding: mobile ? 0 : 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--ink-0)', borderRadius: mobile ? 0 : 14, width: '100%', maxWidth: mobile ? '100%' : 460, boxShadow: '0 24px 60px -12px rgba(13,13,11,0.25)' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Label style={{ marginBottom: 6 }}>{initial ? 'Edit exercise' : 'New exercise'}</Label>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: 'var(--ink-900)' }}>{initial ? initial.name : 'Add to library'}</h2>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)', padding: 4 }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Label style={{ marginBottom: 6 }}>Exercise name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bench Press" style={{ width: '100%' }} />
          </div>
          <div>
            <Label style={{ marginBottom: 6 }}>Variation</Label>
            <Input value={variationName} onChange={e => setVar(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <Label style={{ marginBottom: 8 }}>Muscle group</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MUSCLES.map(m => <Chip key={m} active={muscleGroup === m} onClick={() => setMG(m)}>{m}</Chip>)}
            </div>
          </div>
          <div>
            <Label style={{ marginBottom: 8 }}>Equipment</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EQUIP.map(m => <Chip key={m} active={equipment === m} onClick={() => setEq(m)}>{m}</Chip>)}
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--ink-100)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="dark" icon="check" disabled={!canSave} onClick={() => onSave({ id: initial && initial.id, name: name.trim(), variationName, muscleGroup, equipment })} style={!canSave ? { opacity: 0.45, cursor: 'not-allowed' } : {}}>{initial ? 'Save' : 'Create'}</Button>
        </div>
      </div>
    </div>
  );
}

function AdminExercises({ onToast, onImport }) {
  const mobile = useIsMobile();
  const [exercises, setExercises] = useStateEX(adminExercises);
  const [q, setQ] = useStateEX('');
  const [openGroups, setOpenGroups] = useStateEX(['Chest']);
  const [modal, setModal] = useStateEX(null); // {edit} | 'new'

  const filtered = useMemoEX(() => exercises.filter(e =>
    !q || [e.name, e.variationName, e.muscleGroup, e.equipment].some(v => v && v.toLowerCase().includes(q.toLowerCase()))
  ), [exercises, q]);

  const grouped = useMemoEX(() => {
    const m = {};
    filtered.forEach(e => { (m[e.muscleGroup] = m[e.muscleGroup] || []).push(e); });
    return Object.keys(m).sort().map(g => ({ group: g, items: m[g] }));
  }, [filtered]);

  const toggle = (g) => setOpenGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const save = (data) => {
    if (data.id) { setExercises(prev => prev.map(e => e.id === data.id ? { ...e, ...data } : e)); onToast('Exercise updated'); }
    else { setExercises(prev => [{ ...data, id: 'e' + Date.now(), isDefault: false, usageCount: 0, createdBy: { name: 'Devon Lee' } }, ...prev]); onToast('Exercise created'); setOpenGroups(prev => prev.includes(data.muscleGroup) ? prev : [...prev, data.muscleGroup]); }
    setModal(null);
  };
  const del = (e) => { if (window.confirm(`Delete "${e.name} · ${e.variationName}"?`)) { setExercises(prev => prev.filter(x => x.id !== e.id)); onToast('Exercise deleted'); } };

  return (
    <div style={{ padding: mobile ? '20px 16px 40px' : '32px 36px', height: '100%', overflowY: 'auto' }}>
      <AdminHeader label="Library" title={`${exercises.length} exercises.`} sub={`${grouped.length} muscle groups`}>
        <Button variant="secondary" icon="upload" onClick={onImport}>Import Excel</Button>
        <Button variant="dark" icon="plus" onClick={() => setModal('new')}>New exercise</Button>
      </AdminHeader>

      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 360 }}>
        <Icon name="search" size={14} color="var(--ink-400)" style={{ position: 'absolute', left: 11, top: 10, pointerEvents: 'none' }} />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search exercises…" style={{ width: '100%', paddingLeft: 32 }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {grouped.map(g => (
          <GroupBlock key={g.group} group={g.group} exercises={g.items} open={openGroups.includes(g.group) || !!q}
            onToggle={() => toggle(g.group)} onEdit={(e) => setModal({ edit: e })} onDelete={del} />
        ))}
        {grouped.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>No exercises match.</div>}
      </div>

      {modal && <ExerciseFormModal initial={modal === 'new' ? null : modal.edit} onClose={() => setModal(null)} onSave={save} />}
    </div>
  );
}

Object.assign(window, { AdminExercises });
