/* global React, Icon, useIsMobile */
const { useEffect: useEffectRT, useState: useStateRT, useRef: useRefRT } = React;

/* ============================================================
   RestTimer — sticky footer overlay. The one blur surface.
   Demo: counts down from 30s (sped up from 90s).
   ============================================================ */

function RestTimer({ event, onDismiss }) {
  const [remaining, setRemaining] = useStateRT(30);
  const startedRef = useRefRT(Date.now());
  const totalRef = useRefRT(30);
  const mobile = useIsMobile();

  useEffectRT(() => {
    setRemaining(30);
    totalRef.current = 30;
    startedRef.current = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - startedRef.current) / 1000;
      const r = Math.max(0, totalRef.current - elapsed);
      setRemaining(r);
      if (r <= 0) {
        clearInterval(id);
        setTimeout(onDismiss, 400);
      }
    }, 100);
    return () => clearInterval(id);
  }, [event?.exercise, event?.set?.id]);

  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  const pct = (remaining / totalRef.current) * 100;

  return (
    <div style={{
      position: 'fixed',
      left: mobile ? 12 : 280,
      right: mobile ? 12 : 40,
      bottom: mobile ? 80 : 24,
      maxWidth: mobile ? 'none' : 880,
      margin: '0 auto',
      pointerEvents: 'auto',
      zIndex: 100,
    }}>
      <div style={{
        background: 'rgba(252,252,250,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--ink-100)',
        borderRadius: 12,
        padding: mobile ? '12px 14px' : '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: mobile ? 12 : 20,
        flexWrap: mobile ? 'wrap' : 'nowrap',
        boxShadow: '0 16px 48px -12px rgba(13,13,11,0.18), 0 2px 6px rgba(13,13,11,0.06)',
      }}>
        <div style={{ minWidth: mobile ? 'auto' : 110 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-400)', marginBottom: 2 }}>Rest</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: mobile ? 26 : 30,
            fontWeight: 600,
            color: 'var(--accent)',
            lineHeight: 1,
            fontFeatureSettings: '"tnum" 1',
          }}>{String(mins)}:{String(secs).padStart(2, '0')}</div>
        </div>

        <div style={{ flex: 1, minWidth: mobile ? '100%' : 0, order: mobile ? 3 : 'unset' }}>
          <div style={{ height: 4, background: 'var(--ink-100)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: pct + '%',
              background: 'var(--accent)',
              transition: 'width 100ms linear',
            }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-600)', marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            After: {event?.exercise || '—'}{event?.set ? ` · ${event.set.kg} kg × ${event.set.reps || '—'}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button onClick={() => { totalRef.current = remaining + 30; startedRef.current = Date.now(); setRemaining(r => r + 30); }} style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            padding: '6px 12px',
            background: 'transparent',
            border: '1px solid var(--ink-150)',
            borderRadius: 6,
            color: 'var(--ink-800)',
            cursor: 'pointer',
          }}>+30 s</button>
          <button onClick={onDismiss} style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            padding: '6px 12px',
            background: 'transparent',
            border: 'none',
            color: 'var(--danger)',
            cursor: 'pointer',
          }}>Skip</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RestTimer });
