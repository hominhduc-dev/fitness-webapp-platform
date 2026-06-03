/* global React, Icon, Label, Avatar, useIsMobile */
const { useState: useStateAS } = React;

const adminNav = [
  { id: 'dashboard',   icon: 'layout-dashboard', label: 'Dashboard' },
  { id: 'users',       icon: 'users',            label: 'Users' },
  { id: 'requests',    icon: 'user-round-check', label: 'Coach Requests' },
  { id: 'connections', icon: 'link',             label: 'Connections' },
  { id: 'programs',     icon: 'clipboard-list',   label: 'Programs' },
  { id: 'exercises',   icon: 'dumbbell',         label: 'Exercises' },
  { id: 'audit',       icon: 'scroll-text',      label: 'Audit' },
];

function AdminNavItem({ item, isActive, onClick, badge }) {
  const [hover, setHover] = useStateAS(false);
  const bg = isActive ? 'var(--ink-100)' : (hover ? 'var(--ink-50)' : 'transparent');
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 10px', background: bg,
        color: isActive ? 'var(--ink-900)' : 'var(--ink-600)',
        border: 'none', borderRadius: 6,
        fontFamily: 'var(--font-sans)', fontSize: 14,
        fontWeight: isActive ? 500 : 400,
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'background 120ms',
      }}
    >
      <Icon name={item.icon} size={16} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {badge ? (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
          background: 'var(--accent)', color: '#fff',
          borderRadius: 999, minWidth: 18, height: 18, padding: '0 5px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{badge}</span>
      ) : null}
    </button>
  );
}

function AdminDesktopSidebar({ active, onNavigate, pendingCount }) {
  return (
    <aside style={{
      width: 240, flexShrink: 0,
      borderRight: '1px solid var(--ink-100)', background: 'var(--ink-0)',
      padding: '20px 14px', display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 8px' }}>
        <div style={{ width: 28, height: 28, color: 'var(--ink-900)' }}>
          <img src="assets/lift-mark.svg" style={{ width: '100%', height: '100%' }} alt="" />
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.04em', color: 'var(--ink-900)' }}>lift</div>
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
        margin: '0 10px 24px', padding: '3px 8px', borderRadius: 5,
        background: 'var(--ink-900)', color: 'var(--ink-0)',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        <Icon name="shield-check" size={12} color="var(--ink-0)" /> Admin
      </div>

      <Label style={{ padding: '0 10px 8px' }}>Control center</Label>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {adminNav.map(it => (
          <AdminNavItem
            key={it.id} item={it}
            isActive={active === it.id}
            onClick={() => onNavigate(it.id)}
            badge={it.id === 'requests' && pendingCount ? pendingCount : null}
          />
        ))}
      </nav>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--ink-100)', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar initials="DL" />
        <div style={{ lineHeight: 1.2, fontSize: 13 }}>
          <div style={{ color: 'var(--ink-800)', fontWeight: 500 }}>Devon Lee</div>
          <div style={{ color: 'var(--ink-400)', fontSize: 12 }}>System admin</div>
        </div>
      </div>
    </aside>
  );
}

function AdminMobileBar({ active, onNavigate, pendingCount }) {
  const [open, setOpen] = useStateAS(false);
  return (
    <>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--ink-100)',
        background: 'rgba(252,252,250,0.92)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22 }}>
            <img src="assets/lift-mark.svg" style={{ width: '100%', height: '100%' }} alt="" />
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.04em', color: 'var(--ink-900)' }}>lift</div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--ink-900)', color: '#fff', borderRadius: 4, padding: '2px 5px' }}>Admin</span>
        </div>
        <button onClick={() => setOpen(o => !o)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-600)' }}>
          <Icon name={open ? 'x' : 'menu'} size={22} />
        </button>
      </header>
      {open && (
        <nav style={{ borderBottom: '1px solid var(--ink-100)', background: 'var(--ink-0)', padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {adminNav.map(it => (
            <AdminNavItem key={it.id} item={it} isActive={active === it.id}
              onClick={() => { onNavigate(it.id); setOpen(false); }}
              badge={it.id === 'requests' && pendingCount ? pendingCount : null} />
          ))}
        </nav>
      )}
    </>
  );
}

function AdminSidebar({ active, onNavigate, pendingCount }) {
  const mobile = useIsMobile();
  return mobile
    ? <AdminMobileBar active={active} onNavigate={onNavigate} pendingCount={pendingCount} />
    : <AdminDesktopSidebar active={active} onNavigate={onNavigate} pendingCount={pendingCount} />;
}

Object.assign(window, { AdminSidebar });
