/* global React, Icon, Label, Tag, Button, Chip, Avatar, useIsMobile */
const { useState: useStateSCH, useMemo: useMemoSCH } = React;

/* ============================================================
   TrainerSchedule — week calendar of every client's sessions
   ============================================================ */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/* sessions keyed by weekday index (0=Mon). status: scheduled | done | missed */
const weekSessions = {
  0: [
    { client: 'Maya Reyes',  workout: 'Pull A',  time: '07:00', status: 'done' },
    { client: 'Devon Lee',   workout: 'Upper',   time: '12:30', status: 'done' },
    { client: 'Priya Anand', workout: 'Squat focus', time: '18:00', status: 'scheduled' },
  ],
  1: [
    { client: 'Theo Sato',   workout: 'Push B',  time: '08:00', status: 'missed' },
    { client: 'Lila Brooks', workout: 'Legs',    time: '17:30', status: 'scheduled' },
  ],
  2: [
    { client: 'Maya Reyes',  workout: 'Push A',  time: '07:00', status: 'done' },
    { client: 'Sam Okafor',  workout: 'Full body', time: '13:00', status: 'scheduled' },
    { client: 'Noah West',   workout: 'Upper',   time: '19:00', status: 'scheduled' },
  ],
  3: [
    { client: 'Devon Lee',   workout: 'Lower',   time: '12:30', status: 'scheduled' },
    { client: 'Priya Anand', workout: 'Bench focus', time: '18:00', status: 'scheduled' },
  ],
  4: [
    { client: 'Maya Reyes',  workout: 'Legs',    time: '07:00', status: 'scheduled' },
    { client: 'Theo Sato',   workout: 'Pull B',  time: '08:00', status: 'scheduled' },
    { client: 'Lila Brooks', workout: 'Push',    time: '17:30', status: 'scheduled' },
  ],
  5: [
    { client: 'Sam Okafor',  workout: 'Optional arms', time: '10:00', status: 'scheduled' },
  ],
  6: [],
};

const statusMetaSch = {
  done:      { tone: 'ok',      dot: 'var(--ok)',     label: 'Done' },
  scheduled: { tone: 'neutral', dot: 'var(--accent)', label: 'Scheduled' },
  missed:    { tone: 'danger',  dot: 'var(--danger)', label: 'Missed' },
};

const initialsSch = (n) => n.split(' ').map(s => s[0]).join('').slice(0, 2);

/* week label helpers (relative to a fixed Monday for the mock) */
function weekLabel(offset) {
  if (offset === 0) return 'This week';
  if (offset === -1) return 'Last week';
  if (offset === 1) return 'Next week';
  return (offset > 0 ? '+' : '') + offset + ' weeks';
}
function weekDates(offset) {
  // mock: Mon Jun 2 2025 as "this week" anchor
  const base = new Date(2025, 5, 2);
  base.setDate(base.getDate() + offset * 7);
  return DAYS.map((_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });
}
const TODAY_INDEX = 2; // Wed = today in the mock

function SessionCard({ s, mobile }) {
  const meta = statusMetaSch[s.status];
  return (
    <div style={{
      background: 'var(--ink-0)',
      border: '1px solid var(--ink-100)',
      borderLeft: '3px solid ' + meta.dot,
      borderRadius: 8,
      padding: '9px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      opacity: s.status === 'missed' ? 0.85 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Avatar initials={initialsSch(s.client)} size={22} />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{s.client}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.workout}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: s.status === 'missed' ? 'var(--danger)' : 'var(--ink-400)', flexShrink: 0, fontFeatureSettings: '"tnum" 1' }}>
          {s.status === 'done' ? '✓' : s.status === 'missed' ? 'missed' : s.time}
        </span>
      </div>
    </div>
  );
}

function TrainerSchedule() {
  const mobile = useIsMobile();
  const [offset, setOffset] = useStateSCH(0);
  const [filter, setFilter] = useStateSCH('all'); // all | scheduled | done | missed

  const dates = useMemoSCH(() => weekDates(offset), [offset]);
  const isCurrentWeek = offset === 0;

  const filterSessions = (list) => list.filter(s => filter === 'all' || s.status === filter);

  const allThisWeek = Object.values(weekSessions).flat();
  const counts = {
    total: allThisWeek.length,
    done: allThisWeek.filter(s => s.status === 'done').length,
    scheduled: allThisWeek.filter(s => s.status === 'scheduled').length,
    missed: allThisWeek.filter(s => s.status === 'missed').length,
  };

  return (
    <div style={{ padding: mobile ? '20px 16px 40px' : '32px 36px', height: mobile ? 'auto' : '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: mobile ? 'flex-start' : 'flex-end', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 14 : 0, justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <Label style={{ marginBottom: 8 }}>Schedule</Label>
          <h1 style={{ fontSize: mobile ? 28 : 36, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink-900)' }}>{weekLabel(offset)}.</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-400)', marginTop: 6 }}>
            {counts.total} sessions · {counts.done} done · {counts.scheduled} upcoming · {counts.missed} missed
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setOffset(o => o - 1)} aria-label="Previous week" style={navBtn}><Icon name="chevron-left" size={16} /></button>
          <button onClick={() => setOffset(0)} style={{ ...navBtn, width: 'auto', padding: '0 14px', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: isCurrentWeek ? 'var(--ink-200)' : 'var(--ink-800)', cursor: isCurrentWeek ? 'default' : 'pointer' }} disabled={isCurrentWeek}>Today</button>
          <button onClick={() => setOffset(o => o + 1)} aria-label="Next week" style={navBtn}><Icon name="chevron-right" size={16} /></button>
        </div>
      </div>

      {/* filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {[['all', 'All'], ['scheduled', 'Upcoming'], ['done', 'Done'], ['missed', 'Missed']].map(([k, l]) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{l}</Chip>
        ))}
      </div>

      {/* calendar grid */}
      {mobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {DAYS.map((d, i) => {
            const list = filterSessions(weekSessions[i] || []);
            const isToday = isCurrentWeek && i === TODAY_INDEX;
            return (
              <div key={d}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--ink-900)' }}>{DAY_FULL[i]}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>{dates[i].getDate()}/{dates[i].getMonth() + 1}</span>
                  {isToday && <Tag tone="pr">Today</Tag>}
                </div>
                {list.length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--ink-400)', padding: '4px 0 0' }}>No sessions.</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{list.map((s, j) => <SessionCard key={j} s={s} mobile />)}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, minHeight: 420 }}>
          {DAYS.map((d, i) => {
            const list = filterSessions(weekSessions[i] || []);
            const isToday = isCurrentWeek && i === TODAY_INDEX;
            return (
              <div key={d} style={{
                background: isToday ? 'var(--accent-soft)' : 'var(--ink-50)',
                border: '1px solid ' + (isToday ? 'var(--accent)' : 'var(--ink-100)'),
                borderRadius: 10,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid ' + (isToday ? 'var(--accent)' : 'var(--ink-100)') }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: isToday ? 'var(--accent-ink)' : 'var(--ink-600)' }}>{d}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isToday ? 'var(--accent-ink)' : 'var(--ink-400)', fontFeatureSettings: '"tnum" 1' }}>{dates[i].getDate()}</span>
                </div>
                {list.length === 0
                  ? <div style={{ fontSize: 11, color: 'var(--ink-400)', textAlign: 'center', padding: '14px 0' }}>—</div>
                  : list.map((s, j) => <SessionCard key={j} s={s} />)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const navBtn = {
  width: 34, height: 34, borderRadius: 7,
  border: '1px solid var(--ink-150)', background: 'var(--ink-0)',
  color: 'var(--ink-600)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

Object.assign(window, { TrainerSchedule });
