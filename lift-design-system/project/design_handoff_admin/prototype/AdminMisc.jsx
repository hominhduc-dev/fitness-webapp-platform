/* global React, Icon, Label, Tag, Button, Chip, Input, useIsMobile, AdminHeader, adminRequests, adminConnections, adminPrograms, adminAudit */
const { useState: useStateMI, useMemo: useMemoMI } = React;

const reqTone = (s) => s === 'approved' ? 'ok' : s === 'rejected' ? 'danger' : 'warn';
const diffTone = (d) => d === 'beginner' ? 'ok' : d === 'advanced' ? 'danger' : 'pr';

/* ---------------- Coach Requests ---------------- */
function AdminRequests({ onToast }) {
  const mobile = useIsMobile();
  const [reqs, setReqs] = useStateMI(adminRequests);
  const [filter, setFilter] = useStateMI('all');
  const act = (id, status) => { setReqs(prev => prev.map(r => r.id === id ? { ...r, status } : r)); onToast(status === 'approved' ? 'Request approved' : 'Request rejected'); };
  const shown = reqs.filter(r => filter === 'all' || r.status === filter);
  const pending = reqs.filter(r => r.status === 'pending').length;

  return (
    <div style={{ padding: mobile ? '20px 16px 40px' : '32px 36px', height: '100%', overflowY: 'auto' }}>
      <AdminHeader label="Coach Requests" title={`${pending} pending.`} sub={`${reqs.length} total requests`} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['all', 'pending', 'approved', 'rejected'].map(s => <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>{s}</Chip>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map(r => (
          <div key={r.id} style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, padding: 16, display: 'flex', alignItems: mobile ? 'flex-start' : 'center', flexDirection: mobile ? 'column' : 'row', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>{r.trainee.name}</span>
                <Icon name="arrow-right" size={13} color="var(--ink-400)" />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-600)' }}>{r.coach.name}</span>
                <Tag tone={reqTone(r.status)}>{r.status}</Tag>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>{r.trainee.email} · requested {r.created}{r.note ? ' · “' + r.note + '”' : ''}</div>
            </div>
            {r.status === 'pending' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" icon="x" onClick={() => act(r.id, 'rejected')}>Reject</Button>
                <Button variant="dark" icon="check" onClick={() => act(r.id, 'approved')}>Approve</Button>
              </div>
            )}
          </div>
        ))}
        {shown.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>No requests.</div>}
      </div>
    </div>
  );
}

/* ---------------- Connections ---------------- */
function AdminConnections({ onToast }) {
  const mobile = useIsMobile();
  const [conns, setConns] = useStateMI(adminConnections.connections);
  const [coachId, setCoachId] = useStateMI(adminConnections.coaches[0].id);
  const [traineeId, setTraineeId] = useStateMI(adminConnections.unassignedTrainees[0] ? adminConnections.unassignedTrainees[0].id : '');
  const [pool, setPool] = useStateMI(adminConnections.unassignedTrainees);
  const [q, setQ] = useStateMI('');

  const assign = () => {
    const coach = adminConnections.coaches.find(c => c.id === coachId);
    const tr = pool.find(t => t.id === traineeId);
    if (!coach || !tr) return;
    setConns(prev => [{ id: 'c' + Date.now(), trainee: tr, coach, since: 'just now' }, ...prev]);
    setPool(prev => { const next = prev.filter(t => t.id !== tr.id); setTraineeId(next[0] ? next[0].id : ''); return next; });
    onToast(`${tr.name} → ${coach.name}`);
  };
  const remove = (c) => { if (window.confirm(`Unlink ${c.trainee.name} from ${c.coach.name}?`)) { setConns(prev => prev.filter(x => x.id !== c.id)); onToast('Connection removed'); } };
  const shown = conns.filter(c => !q || [c.trainee.name, c.coach.name, c.trainee.email].some(v => v.toLowerCase().includes(q.toLowerCase())));

  return (
    <div style={{ padding: mobile ? '20px 16px 40px' : '32px 36px', height: '100%', overflowY: 'auto' }}>
      <AdminHeader label="Connections" title={`${conns.length} active.`} sub={`${pool.length} trainees unassigned`} />

      <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <Label style={{ marginBottom: 6 }}>Coach</Label>
          <select value={coachId} onChange={e => setCoachId(e.target.value)} style={selStyle}>
            {adminConnections.coaches.map(c => <option key={c.id} value={c.id}>{c.name} ({c.clients})</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <Label style={{ marginBottom: 6 }}>Unassigned trainee</Label>
          <select value={traineeId} onChange={e => setTraineeId(e.target.value)} disabled={pool.length === 0} style={selStyle}>
            {pool.length === 0 ? <option>— none —</option> : pool.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <Button variant="dark" icon="link" disabled={pool.length === 0} onClick={assign} style={pool.length === 0 ? { opacity: 0.45, cursor: 'not-allowed' } : {}}>Assign coach</Button>
      </div>

      <div style={{ position: 'relative', marginBottom: 12, maxWidth: 320 }}>
        <Icon name="search" size={14} color="var(--ink-400)" style={{ position: 'absolute', left: 11, top: 10, pointerEvents: 'none' }} />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search connections…" style={{ width: '100%', paddingLeft: 32 }} />
      </div>

      <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, overflow: 'hidden' }}>
        {shown.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--ink-50)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)' }}>{c.trainee.name}</span>
                <Icon name="link" size={12} color="var(--ink-400)" />
                <span style={{ fontSize: 14, color: 'var(--ink-600)' }}>{c.coach.name}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>since {c.since}</div>
            </div>
            <Button variant="danger" size="sm" icon="unlink" onClick={() => remove(c)}>Unlink</Button>
          </div>
        ))}
        {shown.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>No connections.</div>}
      </div>
    </div>
  );
}

/* ---------------- Programs oversight ---------------- */
function AdminPrograms({ onToast }) {
  const mobile = useIsMobile();
  const [progs, setProgs] = useStateMI(adminPrograms);
  const [q, setQ] = useStateMI('');
  const del = (p) => { if (window.confirm(`Delete "${p.name}"? Affects ${p.assigned} assigned clients.`)) { setProgs(prev => prev.filter(x => x.id !== p.id)); onToast('Program deleted'); } };
  const shown = progs.filter(p => !q || [p.name, p.createdBy.name].some(v => v.toLowerCase().includes(q.toLowerCase())));

  return (
    <div style={{ padding: mobile ? '20px 16px 40px' : '32px 36px', height: '100%', overflowY: 'auto' }}>
      <AdminHeader label="Programs" title={`${progs.length} authored.`} sub={`${progs.reduce((a, p) => a + p.assigned, 0)} total assignments`} />
      <div style={{ position: 'relative', marginBottom: 12, maxWidth: 320 }}>
        <Icon name="search" size={14} color="var(--ink-400)" style={{ position: 'absolute', left: 11, top: 10, pointerEvents: 'none' }} />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search programs or coach…" style={{ width: '100%', paddingLeft: 32 }} />
      </div>
      <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, overflow: 'hidden' }}>
        {shown.map(p => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr auto' : 'minmax(0,1.6fr) 120px 100px 100px auto', gap: 10, alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--ink-50)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <Tag tone={diffTone(p.difficulty)}>{p.difficulty}</Tag>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>by {p.createdBy.name}</div>
            </div>
            {!mobile && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-600)' }}>{p.weeks} weeks</span>}
            {!mobile && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-600)' }}>{p.assigned} clients</span>}
            {!mobile && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>{p.created}</span>}
            <Button variant="danger" size="sm" icon="trash-2" onClick={() => del(p)}>Delete</Button>
          </div>
        ))}
        {shown.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>No programs.</div>}
      </div>
    </div>
  );
}

/* ---------------- Audit log ---------------- */
const auditIcon = (t) => ({ user: 'user-cog', request: 'user-round-check', exercise: 'dumbbell', program: 'clipboard-list', connection: 'link' }[t] || 'scroll-text');
function AdminAudit() {
  const mobile = useIsMobile();
  const [q, setQ] = useStateMI('');
  const [type, setType] = useStateMI('all');
  const types = ['all', 'user', 'request', 'exercise', 'program', 'connection'];
  const shown = adminAudit.filter(l => (type === 'all' || l.entityType === type) && (!q || [l.action, l.entityLabel, l.admin.name].some(v => v.toLowerCase().includes(q.toLowerCase()))));

  return (
    <div style={{ padding: mobile ? '20px 16px 40px' : '32px 36px', height: '100%', overflowY: 'auto' }}>
      <AdminHeader label="Audit" title="Activity log." sub={`${adminAudit.length} recent admin actions`} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
          <Icon name="search" size={14} color="var(--ink-400)" style={{ position: 'absolute', left: 11, top: 10, pointerEvents: 'none' }} />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search actions…" style={{ width: '100%', paddingLeft: 32 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {types.map(t => <Chip key={t} active={type === t} onClick={() => setType(t)}>{t}</Chip>)}
        </div>
      </div>
      <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, overflow: 'hidden' }}>
        {shown.map(l => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--ink-50)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--ink-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={auditIcon(l.entityType)} size={15} color="var(--ink-600)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-600)' }}>{l.action}</span>
                <Tag tone="neutral">{l.entityType}</Tag>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-800)', marginTop: 2 }}>{l.entityLabel}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-600)' }}>{l.admin.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>{l.at}</div>
            </div>
          </div>
        ))}
        {shown.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>No matching activity.</div>}
      </div>
    </div>
  );
}

const selStyle = {
  fontFamily: 'var(--font-sans)', fontSize: 14, padding: '8px 10px',
  border: '1px solid var(--ink-150)', borderRadius: 4, background: '#fcfcfa',
  color: 'var(--ink-800)', width: '100%', cursor: 'pointer',
};

Object.assign(window, { AdminRequests, AdminConnections, AdminPrograms, AdminAudit });
