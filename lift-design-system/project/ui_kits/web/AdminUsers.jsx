/* global React, Icon, Label, Tag, Button, Chip, Input, Avatar, useIsMobile, AdminHeader, adminUsers */
const { useState: useStateUS, useMemo: useMemoUS } = React;

const roleToneU = (r) => r === 'admin' ? 'pr' : r === 'coach' ? 'ok' : 'neutral';
const initialsOf = (n) => n.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

function UserRow({ u, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
      padding: '11px 14px', border: 'none',
      borderLeft: '3px solid ' + (active ? 'var(--accent)' : 'transparent'),
      background: active ? 'var(--ink-50)' : 'transparent', cursor: 'pointer',
      borderBottom: '1px solid var(--ink-50)', transition: 'background 120ms',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--ink-50)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      <Avatar initials={initialsOf(u.name)} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
          {!u.isActive && <Icon name="lock" size={12} color="var(--danger)" />}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
      </div>
      <Tag tone={roleToneU(u.role)}>{u.role}</Tag>
    </button>
  );
}

function DetailRow({ k, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--ink-50)', gap: 12 }}>
      <Label>{k}</Label>
      <div style={{ fontSize: 13, color: 'var(--ink-800)', textAlign: 'right' }}>{children}</div>
    </div>
  );
}

function UserDetail({ u, onChange, onToast }) {
  const [pw, setPw] = useStateUS('');
  if (!u) return null;
  return (
    <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <Avatar initials={initialsOf(u.name)} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--ink-900)', letterSpacing: '-0.01em' }}>{u.name}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-400)' }}>{u.email}</div>
        </div>
        {u.isActive
          ? <Tag tone="ok">Active</Tag>
          : <Tag tone="danger">Locked</Tag>}
      </div>

      <Label style={{ marginBottom: 8 }}>Role</Label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {['trainee', 'coach', 'admin'].map(r => (
          <Chip key={r} active={u.role === r} onClick={() => { onChange(u.id, { role: r }); onToast(`Role → ${r}`); }}>{r}</Chip>
        ))}
      </div>

      <DetailRow k="Username">{u.username}</DetailRow>
      <DetailRow k="Phone"><span style={{ fontFamily: 'var(--font-mono)' }}>{u.phone}</span></DetailRow>
      <DetailRow k="Coach">{u.coach ? u.coach.name : <span style={{ color: 'var(--ink-400)' }}>—</span>}</DetailRow>
      <DetailRow k="Joined"><span style={{ fontFamily: 'var(--font-mono)' }}>{u.joined}</span></DetailRow>
      <DetailRow k="Last active"><span style={{ fontFamily: 'var(--font-mono)' }}>{u.lastActive}</span></DetailRow>
      <DetailRow k="Workouts"><span style={{ fontFamily: 'var(--font-mono)' }}>{u.workouts}</span></DetailRow>
      {u.role === 'coach' && <DetailRow k="Clients"><span style={{ fontFamily: 'var(--font-mono)' }}>{u.clients}</span></DetailRow>}

      <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--ink-100)' }}>
        <Label style={{ marginBottom: 8 }}>Manual password reset</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input value={pw} onChange={e => setPw(e.target.value)} placeholder="New password" style={{ flex: 1 }} />
          <Button variant="secondary" icon="key-round" disabled={!pw} onClick={() => { setPw(''); onToast('Password reset'); }} style={!pw ? { opacity: 0.45, cursor: 'not-allowed' } : {}}>Reset</Button>
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
        {u.isActive ? (
          <Button variant="danger" icon="lock" onClick={() => { onChange(u.id, { isActive: false }); onToast('Account locked'); }}>Lock account</Button>
        ) : (
          <Button variant="secondary" icon="lock-open" onClick={() => { onChange(u.id, { isActive: true }); onToast('Account unlocked'); }}>Unlock account</Button>
        )}
      </div>
    </div>
  );
}

function AdminUsers({ initialUserId, onToast }) {
  const mobile = useIsMobile();
  const [users, setUsers] = useStateUS(adminUsers);
  const [sel, setSel] = useStateUS(initialUserId || adminUsers[0].id);
  const [q, setQ] = useStateUS('');
  const [roleFilter, setRoleFilter] = useStateUS('all');

  const filtered = useMemoUS(() => users.filter(u => {
    const okRole = roleFilter === 'all' || u.role === roleFilter;
    const okQ = !q || [u.name, u.email, u.username, u.phone].some(v => v && v.toLowerCase().includes(q.toLowerCase()));
    return okRole && okQ;
  }), [users, q, roleFilter]);

  const current = users.find(u => u.id === sel);
  const change = (id, patch) => setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));

  return (
    <div style={{ padding: mobile ? '20px 16px 40px' : '32px 36px', height: '100%', overflowY: 'auto' }}>
      <AdminHeader label="Users" title={`${users.length} accounts.`} sub={`${users.filter(u => u.role === 'coach').length} coaches · ${users.filter(u => !u.isActive).length} locked`} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Icon name="search" size={14} color="var(--ink-400)" style={{ position: 'absolute', left: 11, top: 10, pointerEvents: 'none' }} />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, phone…" style={{ width: '100%', paddingLeft: 32 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'trainee', 'coach', 'admin'].map(r => (
            <Chip key={r} active={roleFilter === r} onClick={() => setRoleFilter(r)}>{r}</Chip>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '360px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, overflow: 'hidden' }}>
          {filtered.map(u => <UserRow key={u.id} u={u} active={u.id === sel} onClick={() => setSel(u.id)} />)}
          {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--ink-400)' }}>No users match.</div>}
        </div>
        {!mobile || current ? <UserDetail u={current} onChange={change} onToast={onToast} /> : null}
      </div>
    </div>
  );
}

Object.assign(window, { AdminUsers });
