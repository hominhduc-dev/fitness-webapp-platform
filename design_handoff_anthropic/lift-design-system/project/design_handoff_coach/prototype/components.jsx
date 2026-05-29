/* global React */
const { useState, useEffect, useRef } = React;

/* ============================================================
   Lift — shared components / atoms
   ============================================================ */

const liftStyles = {
  btn: {
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    fontWeight: 500,
    padding: '8px 14px',
    borderRadius: 6,
    border: '1px solid transparent',
    cursor: 'pointer',
    lineHeight: 1.2,
    transition: 'background 120ms cubic-bezier(.2,.7,.2,1), color 120ms',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  },
};

function Button({ variant = 'secondary', size = 'md', icon, children, ...rest }) {
  const variants = {
    primary:   { background: 'var(--accent)',  color: '#fff', borderColor: 'transparent' },
    secondary: { background: '#fcfcfa',         color: 'var(--ink-800)', borderColor: 'var(--ink-150)' },
    ghost:     { background: 'transparent',    color: 'var(--ink-800)', borderColor: 'transparent' },
    danger:    { background: 'transparent',    color: 'var(--danger)',  borderColor: 'transparent' },
    dark:      { background: 'var(--ink-800)', color: '#fff', borderColor: 'var(--ink-800)' },
  };
  const sizes = {
    sm: { fontSize: 13, padding: '6px 10px' },
    md: { fontSize: 14, padding: '8px 14px' },
    lg: { fontSize: 15, padding: '11px 18px' },
  };
  const [hover, setHover] = useState(false);
  const hoverBg = {
    primary:   'var(--accent-hover)',
    secondary: 'var(--ink-50)',
    ghost:     'var(--ink-50)',
    danger:    'var(--danger-soft)',
    dark:      'var(--ink-900)',
  }[variant];
  return (
    <button
      {...rest}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...liftStyles.btn,
        ...variants[variant],
        ...sizes[size],
        ...(hover ? { background: hoverBg } : {}),
        ...rest.style,
      }}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}

function Icon({ name, size = 18, color, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (window.lucide && ref.current) {
      ref.current.innerHTML = '';
      const i = document.createElement('i');
      i.setAttribute('data-lucide', name);
      ref.current.appendChild(i);
      window.lucide.createIcons({ icons: window.lucide.icons, attrs: { width: size, height: size, 'stroke-width': 1.5 } });
    }
  }, [name, size]);
  return <span ref={ref} style={{ display: 'inline-flex', width: size, height: size, color: color || 'currentColor', ...style }} />;
}

function Input({ value, onChange, placeholder, style, type = 'text', invalid, ...rest }) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      {...rest}
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        padding: '8px 10px',
        border: '1px solid ' + (invalid ? 'var(--danger)' : focus ? 'var(--accent)' : 'var(--ink-150)'),
        borderRadius: 4,
        background: '#fcfcfa',
        color: 'var(--ink-800)',
        outline: 'none',
        boxShadow: focus ? '0 0 0 3px var(--accent-soft)' : 'none',
        transition: 'box-shadow 120ms, border-color 120ms',
        ...style,
      }}
    />
  );
}

function NumInput({ value, onChange, suffix, width = 70, ...rest }) {
  return (
    <Input
      value={value ?? ''}
      onChange={onChange}
      style={{
        fontFamily: 'var(--font-mono)',
        textAlign: 'center',
        width,
        fontFeatureSettings: '"tnum" 1',
      }}
      {...rest}
    />
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: 500,
        padding: '5px 12px',
        borderRadius: 999,
        border: '1px solid ' + (active ? 'var(--ink-800)' : 'var(--ink-150)'),
        background: active ? 'var(--ink-800)' : '#fcfcfa',
        color: active ? 'var(--ink-0)' : 'var(--ink-800)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 120ms, border-color 120ms',
      }}
    >
      {children}
    </button>
  );
}

function Tag({ tone = 'neutral', children }) {
  const tones = {
    pr:      { background: 'var(--accent-soft)', color: 'var(--accent-ink)' },
    ok:      { background: 'var(--ok-soft)',     color: 'var(--ok)' },
    warn:    { background: 'var(--warn-soft)',   color: 'var(--warn)' },
    danger:  { background: 'var(--danger-soft)', color: 'var(--danger)' },
    neutral: { background: 'var(--ink-100)',     color: 'var(--ink-600)' },
  };
  return (
    <span style={{
      display: 'inline-flex',
      padding: '3px 7px',
      borderRadius: 4,
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontWeight: 500,
      ...tones[tone],
    }}>{children}</span>
  );
}

function Card({ raised, children, style, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        background: raised ? 'var(--ink-50)' : 'var(--ink-0)',
        border: '1px solid var(--ink-100)',
        borderRadius: 10,
        padding: 24,
        ...style,
      }}
    >{children}</div>
  );
}

function Label({ children, color, style }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: color || 'var(--ink-400)',
      fontWeight: 500,
      ...style,
    }}>{children}</div>
  );
}

function Avatar({ initials = 'JS', size = 28 }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'var(--ink-800)',
      color: 'var(--ink-0)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      fontWeight: 600,
      fontSize: size * 0.4,
      letterSpacing: '-0.02em',
    }}>{initials}</div>
  );
}

function Toolbar({ title, children }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 32px',
      borderBottom: '1px solid var(--ink-100)',
      background: 'var(--ink-0)',
    }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--ink-900)', margin: 0 }}>{title}</h1>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{children}</div>
    </div>
  );
}

/* -- responsive hook ------------------------------------------------- */
function useMediaQuery(query) {
  const get = () => typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener ? mql.addEventListener('change', onChange) : mql.addListener(onChange);
    return () => {
      mql.removeEventListener ? mql.removeEventListener('change', onChange) : mql.removeListener(onChange);
    };
  }, [query]);
  return matches;
}
const useIsMobile = () => useMediaQuery('(max-width: 767px)');
const useIsTablet = () => useMediaQuery('(max-width: 1023px)');

Object.assign(window, { Button, Icon, Input, NumInput, Chip, Tag, Card, Label, Avatar, Toolbar, useMediaQuery, useIsMobile, useIsTablet });
