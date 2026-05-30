/* global React, Icon, Label, Tag, Button, Chip, useIsMobile, adminStats, adminCharts, adminUsers */
const { useState: useStateAD } = React;

/* shared page header used across admin sections */
function AdminHeader({ label, title, sub, children }) {
  const mobile = useIsMobile();
  return (
    <div style={{
      display: 'flex', alignItems: mobile ? 'flex-start' : 'flex-end',
      flexDirection: mobile ? 'column' : 'row', gap: mobile ? 14 : 0,
      justifyContent: 'space-between', marginBottom: 24,
    }}>
      <div>
        <Label style={{ marginBottom: 8 }}>{label}</Label>
        <h1 style={{ fontSize: mobile ? 26 : 34, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink-900)' }}>{title}</h1>
        {sub ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-400)', marginTop: 6 }}>{sub}</div> : null}
      </div>
      {children ? <div style={{ display: 'flex', gap: 8 }}>{children}</div> : null}
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, padding: 18 }}>
      <Label>{label}</Label>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 600, marginTop: 8,
        color: accent ? 'var(--accent)' : 'var(--ink-900)', fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em',
      }}>{value.toLocaleString()}</div>
      {sub ? <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

function BarChart({ title, sub, points, highlightLast }) {
  const max = Math.max(...points.map(p => p[1]), 1);
  return (
    <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2, marginBottom: 16 }}>{sub}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 132 }}>
        {points.map((p, i) => {
          const h = p[1] === 0 ? 4 : Math.max((p[1] / max) * 110, 8);
          const last = highlightLast && i === points.length - 1;
          return (
            <div key={p[0]} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-400)', fontFeatureSettings: '"tnum" 1' }}>{p[1] >= 1000 ? (p[1] / 1000).toFixed(1) + 'k' : p[1]}</span>
              <div style={{ width: '100%', height: h, borderRadius: 4, background: last ? 'var(--accent)' : 'var(--ink-200, #d9d9d2)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p[0]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function roleTone(role) { return role === 'admin' ? 'pr' : role === 'coach' ? 'ok' : 'neutral'; }

function AdminDashboard({ onOpenUser }) {
  const mobile = useIsMobile();
  const [view, setView] = useStateAD('weekly');
  const recent = adminUsers.slice(0, 5);
  const atRisk = adminUsers.filter(u => /d ago/.test(u.lastActive) && parseInt(u.lastActive) >= 6);

  return (
    <div style={{ padding: mobile ? '20px 16px 40px' : '32px 36px', height: '100%', overflowY: 'auto' }}>
      <AdminHeader label="Overview" title="System health." sub={`${adminStats.totalUsers.toLocaleString()} users · ${adminStats.totalCoaches} coaches · ${adminStats.activeUsersLast7Days} active this week`} />

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 12, marginBottom: 14 }}>
        <StatCard label="Total users" value={adminStats.totalUsers} sub="all roles" />
        <StatCard label="Coaches" value={adminStats.totalCoaches} sub="coach accounts" />
        <StatCard label="Trainees" value={adminStats.totalTrainees} sub="fitness users" />
        <StatCard label="Active 7d" value={adminStats.activeUsersLast7Days} sub="activity in 7 days" />
        <StatCard label="Active 30d" value={adminStats.activeUsersLast30Days} sub="activity in 30 days" accent />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 0 14px' }}>
        <Label>Platform charts</Label>
        <div style={{ display: 'flex', gap: 6 }}>
          <Chip active={view === 'weekly'} onClick={() => setView('weekly')}>Weekly</Chip>
          <Chip active={view === 'monthly'} onClick={() => setView('monthly')}>Monthly</Chip>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)', gap: 12, marginBottom: 22 }}>
        <BarChart title="User growth" sub="New accounts" points={adminCharts.userGrowth[view]} highlightLast />
        <BarChart title="Active users" sub="With workout/meal activity" points={adminCharts.activeUsers[view]} highlightLast />
        <BarChart title="Workout logs" sub="Sessions started" points={adminCharts.workoutLogs[view]} highlightLast />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1.4fr 1fr', gap: 14 }}>
        <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)' }}>Recent users</div>
            <Label>Newest accounts</Label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recent.map(u => (
              <button key={u.id} onClick={() => onOpenUser(u.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                padding: '10px 8px', border: 'none', borderTop: '1px solid var(--ink-50)', background: 'transparent', cursor: 'pointer', borderRadius: 6,
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)' }}>{u.name}</span>
                    <Tag tone={roleTone(u.role)}>{u.role}</Tag>
                    {!u.isActive && <Tag tone="danger">Locked</Tag>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>{u.email}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>{u.joined}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--ink-0)', border: '1px solid var(--ink-100)', borderRadius: 10, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)' }}>At-risk trainees</div>
            <Tag tone="warn">{atRisk.length} inactive</Tag>
          </div>
          {atRisk.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-400)', padding: '12px 0' }}>Everyone active recently.</div>
          ) : atRisk.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--ink-50)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)' }}>{u.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>{u.workouts} workouts logged</div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--warn)' }}>{u.lastActive}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminDashboard, AdminHeader });
