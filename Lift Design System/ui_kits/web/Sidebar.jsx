/* global React, Icon, Label, Avatar, useIsMobile */
const { useState: useStateSB } = React;

const navItems = [
  { id: 'today',    icon: 'dumbbell',         label: 'Today' },
  { id: 'schedule', icon: 'calendar-days',    label: 'Schedule' },
  { id: 'routines', icon: 'layout-list',      label: 'Routines' },
  { id: 'history',  icon: 'calendar',         label: 'History' },
  { id: 'library',  icon: 'list',             label: 'Exercises' },
  { id: 'prs',      icon: 'flame',            label: 'Records' },
  { id: 'body',     icon: 'ruler',            label: 'Body' },
];

function NavItem({ item, isActive, onClick }) {
  const [hover, setHover] = useStateSB(false);
  const bg = isActive ? 'var(--ink-100)' : (hover ? 'var(--ink-50)' : 'transparent');
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 10px',
        background: bg,
        color: isActive ? 'var(--ink-900)' : 'var(--ink-600)',
        border: 'none',
        borderRadius: 6,
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        fontWeight: isActive ? 500 : 400,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 120ms',
      }}
    >
      <Icon name={item.icon} size={16} />
      <span>{item.label}</span>
    </button>
  );
}

/* -------- desktop sidebar --------------------------------------------- */
function DesktopSidebar({ active, onNavigate }) {
  return (
    <aside style={{
      width: 240,
      flexShrink: 0,
      borderRight: '1px solid var(--ink-100)',
      background: 'var(--ink-0)',
      padding: '20px 14px',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 24px' }}>
        <div style={{ width: 28, height: 28, color: 'var(--ink-900)' }}>
          <img src="../../assets/lift-mark.svg" style={{ width: '100%', height: '100%' }} alt="" />
        </div>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: '-0.04em',
          color: 'var(--ink-900)',
        }}>lift</div>
      </div>

      <button
        onClick={() => onNavigate('today')}
        style={{
          margin: '0 0 28px',
          padding: '10px 14px',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
        }}
      >
        <Icon name="plus" size={16} color="#fff" />
        Start workout
      </button>

      <Label style={{ padding: '0 10px 8px' }}>Workspace</Label>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(it => (
          <NavItem
            key={it.id}
            item={it}
            isActive={active === it.id}
            onClick={() => onNavigate(it.id)}
          />
        ))}
      </nav>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--ink-100)', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar initials="JS" />
        <div style={{ lineHeight: 1.2, fontSize: 13 }}>
          <div style={{ color: 'var(--ink-800)', fontWeight: 500 }}>Jordan S.</div>
          <div style={{ color: 'var(--ink-400)', fontSize: 12 }}>14-day streak</div>
        </div>
      </div>
    </aside>
  );
}

/* -------- mobile top bar ---------------------------------------------- */
function MobileTopBar({ onStart }) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid var(--ink-100)',
      background: 'rgba(252,252,250,0.92)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 22, height: 22, color: 'var(--ink-900)' }}>
          <img src="../../assets/lift-mark.svg" style={{ width: '100%', height: '100%' }} alt="" />
        </div>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.04em',
          color: 'var(--ink-900)',
        }}>lift</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onStart}
          style={{
            padding: '7px 12px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="plus" size={14} color="#fff" />
          Start
        </button>
        <Avatar initials="JS" size={28} />
      </div>
    </header>
  );
}

/* -------- mobile bottom tab bar --------------------------------------- */
function MobileBottomTabs({ active, onNavigate }) {
  // Only 5 fit comfortably on mobile — keep most-used 5
  const ids = ['today', 'schedule', 'routines', 'prs', 'body'];
  const tabs = ids.map(id => navItems.find(it => it.id === id)).filter(Boolean);
  return (
    <nav style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      display: 'grid',
      gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
      background: 'rgba(252,252,250,0.92)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--ink-100)',
      paddingBottom: 'env(safe-area-inset-bottom, 0)',
      zIndex: 60,
    }}>
      {tabs.map(it => {
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onNavigate(it.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '10px 4px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? 'var(--accent)' : 'var(--ink-400)',
            }}
          >
            <Icon name={it.icon} size={20} />
            <span style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 10,
              fontWeight: isActive ? 600 : 500,
              letterSpacing: 0,
            }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Sidebar({ active, onNavigate }) {
  const mobile = useIsMobile();
  if (mobile) {
    return (
      <>
        <MobileTopBar onStart={() => onNavigate('today')} />
        <MobileBottomTabs active={active} onNavigate={onNavigate} />
      </>
    );
  }
  return <DesktopSidebar active={active} onNavigate={onNavigate} />;
}

Object.assign(window, { Sidebar });
