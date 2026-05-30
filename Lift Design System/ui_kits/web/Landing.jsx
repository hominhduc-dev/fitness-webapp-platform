/* global React, Button, Icon, Input, Label, useIsMobile */
const { useState: useStateLD, useEffect: useEffectLD } = React;

/* ============================================================
   Landing — marketing page + auth modals
   ============================================================ */

function TopBar({ onSignIn, onSignUp }) {
  const mobile = useIsMobile();
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 30,
      background: 'rgba(252,252,250,0.85)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--ink-100)',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: mobile ? '14px 20px' : '18px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, color: 'var(--ink-900)' }}>
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
        <nav style={{ display: 'flex', alignItems: 'center', gap: mobile ? 8 : 28 }}>
          {!mobile && (
            <>
              <a href="#features" style={{ color: 'var(--ink-600)', fontSize: 14 }}>Features</a>
              <a href="#trainers" style={{ color: 'var(--ink-600)', fontSize: 14 }}>For trainers</a>
              <a href="#pricing" style={{ color: 'var(--ink-600)', fontSize: 14 }}>Pricing</a>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={onSignIn}>Sign in</Button>
          <Button variant="dark" size="sm" onClick={onSignUp}>Get started</Button>
        </nav>
      </div>
    </header>
  );
}

function Hero({ onSignUp }) {
  const mobile = useIsMobile();
  return (
    <section style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: mobile ? '40px 20px 32px' : '80px 40px 64px',
    }}>
      <div style={{ maxWidth: 760 }}>
        <Label style={{ marginBottom: 14 }}>v1.0 · march 2026</Label>
        <h1 style={{
          fontSize: mobile ? 44 : 84,
          fontWeight: 600,
          letterSpacing: '-0.035em',
          lineHeight: 0.96,
          color: 'var(--ink-900)',
          margin: 0,
        }}>
          Log the set. <br /><span style={{ color: 'var(--ink-400)' }}>Move on.</span>
        </h1>
        <p style={{
          fontSize: mobile ? 16 : 19,
          color: 'var(--ink-600)',
          lineHeight: 1.55,
          margin: '24px 0 0',
          maxWidth: 540,
        }}>
          A quiet gym log for lifters who know what they're doing. No streaks to maintain. No coach pinging you. Just your numbers, where you left them.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 32, flexWrap: 'wrap' }}>
          <Button variant="primary" size="lg" onClick={onSignUp}>Start logging — it's free</Button>
          <Button variant="ghost" size="lg" icon="play">
            <span>Watch 30s demo</span>
          </Button>
        </div>
        <div style={{
          marginTop: 22,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-400)',
        }}>
          No credit card · iOS &amp; web · export your data anytime
        </div>
      </div>

      {/* Product preview tile */}
      <div style={{
        marginTop: mobile ? 40 : 72,
        background: 'var(--ink-0)',
        border: '1px solid var(--ink-100)',
        borderRadius: 14,
        padding: mobile ? 16 : 28,
        boxShadow: '0 24px 60px -28px rgba(13,13,11,0.12)',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : '1.4fr 1fr',
          gap: mobile ? 14 : 24,
        }}>
          {/* Mock set log */}
          <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ink-100)' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-900)' }}>Bench press</div>
              <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>3 working sets · last 82.5 × 8</div>
            </div>
            {[
              { n: 1, kind: 'warm', kg: 60, reps: 10, done: true },
              { n: 2, kind: 'work', kg: 80, reps: 8, done: true },
              { n: 3, kind: 'work', kg: 82.5, reps: 8, done: true, pr: true },
              { n: 4, kind: 'work', kg: 85, reps: null, done: false },
            ].map(s => (
              <div key={s.n} style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 60px 60px 28px',
                gap: 10,
                padding: '10px 18px',
                borderBottom: '1px solid var(--ink-100)',
                background: s.done ? 'var(--ink-50)' : 'transparent',
                alignItems: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
              }}>
                <span style={{ fontWeight: 600, color: 'var(--ink-800)' }}>{s.n}</span>
                <span style={{
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: s.kind === 'warm' ? 'var(--ink-400)' : 'var(--ink-600)',
                }}>{s.kind}{s.pr ? ' · pr' : ''}</span>
                <span style={{ color: s.done ? 'var(--ink-400)' : 'var(--ink-800)', textAlign: 'center' }}>{s.kg}</span>
                <span style={{ color: s.done ? 'var(--ink-400)' : 'var(--ink-800)', textAlign: 'center' }}>{s.reps ?? '—'}</span>
                <div style={{
                  width: 20, height: 20, borderRadius: 4,
                  border: s.done ? 'none' : '1.5px solid var(--ink-200)',
                  background: s.done ? 'var(--ok)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{s.done && <Icon name="check" size={12} color="#fff" />}</div>
              </div>
            ))}
          </div>

          {/* Mock chart */}
          <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, padding: 18 }}>
            <Label style={{ marginBottom: 6 }}>Bench press · 1RM est.</Label>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 36,
                fontWeight: 600,
                letterSpacing: '-0.03em',
                color: 'var(--ink-900)',
                fontFeatureSettings: '"tnum" 1',
              }}>112.5</div>
              <span style={{ color: 'var(--ink-400)', fontSize: 13 }}>kg</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ok)', marginLeft: 4 }}>↑ 5.0 · 12 w</span>
            </div>
            <svg viewBox="0 0 240 100" style={{ display: 'block', width: '100%', marginTop: 16 }}>
              <line x1="0" y1="25" x2="240" y2="25" stroke="var(--ink-100)" strokeWidth="1"/>
              <line x1="0" y1="60" x2="240" y2="60" stroke="var(--ink-100)" strokeWidth="1"/>
              <polyline fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round"
                points="0,80 24,75 48,68 72,70 96,55 120,50 144,52 168,38 192,28 216,22 240,12" />
              <circle cx="240" cy="12" r="3" fill="var(--accent)"/>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const mobile = useIsMobile();
  const items = [
    { icon: 'dumbbell', title: 'Log a set in 3 taps',  copy: 'Previous numbers pre-filled. Tap kg, tap reps, tap check. Move on.' },
    { icon: 'flame',     title: 'PRs that find themselves', copy: 'Hit a new best? Lift notices. No celebrating, no confetti — just a small tag.' },
    { icon: 'bar-chart-3', title: 'Charts that mean something', copy: 'Volume, frequency, 1RM estimate. No vanity numbers.' },
    { icon: 'ruler',     title: 'Body weight + measurements', copy: 'Weekly weigh-ins. Track waist, arms, body fat. Skip what you do not care about.' },
    { icon: 'timer',     title: 'Rest timer that knows',    copy: 'Auto-starts after each set. Tap to add 30 seconds. Auto-dismisses when done.' },
    { icon: 'calendar',  title: 'History without the noise', copy: 'A clean monthly calendar. Click any day to see the session.' },
  ];
  return (
    <section id="features" style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: mobile ? '40px 20px' : '80px 40px',
      borderTop: '1px solid var(--ink-100)',
    }}>
      <div style={{ maxWidth: 640, marginBottom: mobile ? 28 : 48 }}>
        <Label style={{ marginBottom: 12 }}>What's inside</Label>
        <h2 style={{ fontSize: mobile ? 32 : 48, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.05, margin: 0, color: 'var(--ink-900)' }}>
          Everything you need. <span style={{ color: 'var(--ink-400)' }}>Nothing you don't.</span>
        </h2>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)',
        gap: 0,
        border: '1px solid var(--ink-100)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--ink-0)',
      }}>
        {items.map((it, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          return (
            <div key={i} style={{
              padding: mobile ? '22px 20px' : '32px 28px',
              borderRight: (!mobile && col < 2) ? '1px solid var(--ink-100)' : 'none',
              borderBottom: (!mobile && row < 1) || (mobile && i < items.length - 1) ? '1px solid var(--ink-100)' : 'none',
            }}>
              <Icon name={it.icon} size={22} color="var(--ink-800)" />
              <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink-900)', marginTop: 14, marginBottom: 6 }}>{it.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--ink-600)', lineHeight: 1.5, margin: 0 }}>{it.copy}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TrainerCallout() {
  const mobile = useIsMobile();
  return (
    <section id="trainers" style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: mobile ? '20px 20px 40px' : '40px 40px 80px',
    }}>
      <div style={{
        background: 'var(--ink-900)',
        color: 'var(--ink-0)',
        borderRadius: 14,
        padding: mobile ? '32px 24px' : '48px 52px',
        display: 'grid',
        gridTemplateColumns: mobile ? '1fr' : '1.3fr 1fr',
        gap: mobile ? 24 : 48,
        alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#9a9a92',
            marginBottom: 12,
          }}>For coaches &amp; trainers</div>
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: mobile ? 28 : 42,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
            margin: 0,
            color: '#fcfcfa',
          }}>One dashboard for every lifter you coach.</h2>
          <p style={{ fontSize: 15, color: '#c9c9c2', lineHeight: 1.55, marginTop: 18, marginBottom: 24, maxWidth: 440 }}>
            Assign programs, watch real sets land in real time, flag form check videos, and message clients between sessions — without a third app.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="trainer.html" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="md">Open trainer view →</Button>
            </a>
            <Button variant="ghost" size="md" style={{ color: '#fcfcfa' }}>Request invite</Button>
          </div>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: '#c9c9c2',
          lineHeight: 1.7,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: 20,
        }}>
          <div style={{ color: '#fcfcfa', marginBottom: 10 }}>This week · 12 clients</div>
          {[
            ['Maya R.', 'pulled', 'pr · deadlift 142.5'],
            ['Theo S.', 'pushed', '−2 sets vs plan'],
            ['Hana K.', 'rested', '4 days off'],
            ['Devon L.', 'pulled', 'on track'],
          ].map(([n, k, s], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ color: '#fcfcfa' }}>{n}</span>
              <span>{k}</span>
              <span style={{ color: s.startsWith('pr') ? 'var(--accent)' : s.startsWith('−') ? 'var(--warn)' : '#8a8a82' }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const mobile = useIsMobile();
  return (
    <footer style={{
      borderTop: '1px solid var(--ink-100)',
      padding: mobile ? '24px 20px' : '32px 40px',
      maxWidth: 1200,
      margin: '0 auto',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: mobile ? 'column' : 'row',
        gap: mobile ? 12 : 0,
        justifyContent: 'space-between',
        alignItems: mobile ? 'flex-start' : 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)', letterSpacing: '0.04em' }}>
          © 2026 lift · log the set, move on.
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          <a href="#" style={{ color: 'var(--ink-600)', fontSize: 13 }}>Privacy</a>
          <a href="#" style={{ color: 'var(--ink-600)', fontSize: 13 }}>Terms</a>
          <a href="#" style={{ color: 'var(--ink-600)', fontSize: 13 }}>Changelog</a>
          <a href="#" style={{ color: 'var(--ink-600)', fontSize: 13 }}>Contact</a>
        </div>
      </div>
    </footer>
  );
}

/* -------- Auth modals ------------------------------------------------- */

function AuthModal({ mode, onClose, onSwitch, onSubmit }) {
  const [email, setEmail] = useStateLD('');
  const [password, setPassword] = useStateLD('');
  const [name, setName] = useStateLD('');
  const mobile = useIsMobile();
  const isSignUp = mode === 'signup';

  useEffectLD(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13,13,11,0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: mobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: mobile ? 0 : 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--ink-0)',
          borderRadius: mobile ? '16px 16px 0 0' : 12,
          width: '100%',
          maxWidth: 420,
          padding: mobile ? '28px 24px 32px' : '32px 32px 28px',
          boxShadow: '0 24px 60px -12px rgba(13,13,11,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ width: 24, height: 24, color: 'var(--ink-900)', marginBottom: 14 }}>
              <img src="../../assets/lift-mark.svg" style={{ width: '100%', height: '100%' }} alt="" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink-900)' }}>
              {isSignUp ? 'Start logging.' : 'Welcome back.'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ink-600)', margin: '6px 0 0' }}>
              {isSignUp ? 'Takes 30 seconds. No credit card.' : 'Pick up where you left off.'}
            </p>
          </div>
          <button onClick={onClose} style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--ink-400)',
            padding: 4,
            marginRight: -4,
            marginTop: -4,
          }}><Icon name="x" size={18} /></button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSubmit({ email, password, name }); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isSignUp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Jordan Smith" autoFocus />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoFocus={!isSignUp} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>Password</Label>
            <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="—" type="password" />
            {!isSignUp && (
              <a href="#" style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 4, alignSelf: 'flex-end' }}>Forgot password?</a>
            )}
          </div>

          <Button variant="primary" size="lg" type="submit" style={{ justifyContent: 'center', marginTop: 6 }}>
            {isSignUp ? 'Create account' : 'Sign in'}
          </Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--ink-100)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-400)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--ink-100)' }} />
          </div>

          <button type="button" style={{
            padding: '10px 14px',
            background: '#fcfcfa',
            border: '1px solid var(--ink-150)',
            borderRadius: 6,
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--ink-800)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-600)', marginTop: 6 }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <a href="#" onClick={e => { e.preventDefault(); onSwitch(); }} style={{ color: 'var(--accent)', fontWeight: 500 }}>
              {isSignUp ? 'Sign in' : 'Sign up'}
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

function Landing() {
  const [authMode, setAuthMode] = useStateLD(null); // null | 'signin' | 'signup'

  return (
    <>
      <TopBar onSignIn={() => setAuthMode('signin')} onSignUp={() => setAuthMode('signup')} />
      <Hero onSignUp={() => setAuthMode('signup')} />
      <Features />
      <TrainerCallout />
      <Footer />
      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSwitch={() => setAuthMode(m => m === 'signin' ? 'signup' : 'signin')}
          onSubmit={(data) => {
            // demo: jump to the app
            window.location.href = 'index.html';
          }}
        />
      )}
    </>
  );
}

Object.assign(window, { Landing });
