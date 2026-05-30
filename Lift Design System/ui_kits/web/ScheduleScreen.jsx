/* global React, Icon, Label, Tag, Button, Chip, useIsMobile */
const { useState: useStateSC, useMemo: useMemoSC } = React;

/* ============================================================
   Schedule — weekly calendar + coach program
   ============================================================ */

// Mock: trainee is enrolled in a coach program
const coachProgram = {
  name: 'Strength block — w3',
  coach: 'Coach Eli K.',
  startDate: 'Mar 3',
  endDate: 'May 26',
  week: 3,
  totalWeeks: 12,
  daysPerWeek: 4,
  description: 'Heavy compounds Mon/Thu, accessory volume Tue/Sat.',
};

// Mock schedule for the current + upcoming days
// (Today = Wed Mar 19, 2026)
const scheduleData = [
  // This week — Mon Mar 17 → Sun Mar 23
  { date: 'Mar 17', day: 'Mon', routine: { id: 'r2', name: 'Pull day A',  tag: 'pull' }, source: 'coach', status: 'completed', duration: '54m' },
  { date: 'Mar 18', day: 'Tue', routine: null, status: 'rest' },
  { date: 'Mar 19', day: 'Wed', routine: { id: 'r1', name: 'Push day A',  tag: 'push' }, source: 'coach', status: 'today',     duration: '32m so far' },
  { date: 'Mar 20', day: 'Thu', routine: { id: 'r3', name: 'Leg day',     tag: 'legs' }, source: 'coach', status: 'planned' },
  { date: 'Mar 21', day: 'Fri', routine: null, status: 'rest' },
  { date: 'Mar 22', day: 'Sat', routine: { id: 'r4', name: 'Accessory volume', tag: 'upper' }, source: 'coach', status: 'planned' },
  { date: 'Mar 23', day: 'Sun', routine: null, status: 'rest' },

  // Next week — preview
  { date: 'Mar 24', day: 'Mon', routine: { id: 'r2', name: 'Pull day A',  tag: 'pull' }, source: 'coach', status: 'planned', _week: 'next' },
  { date: 'Mar 25', day: 'Tue', routine: null, status: 'rest', _week: 'next' },
  { date: 'Mar 26', day: 'Wed', routine: { id: 'r1', name: 'Push day A',  tag: 'push' }, source: 'coach', status: 'planned', _week: 'next' },
  { date: 'Mar 27', day: 'Thu', routine: { id: 'r3', name: 'Leg day',     tag: 'legs' }, source: 'coach', status: 'planned', _week: 'next' },
  { date: 'Mar 28', day: 'Fri', routine: { id: 'r5', name: 'Upper body — quick', tag: 'upper' }, source: 'self', status: 'planned', _week: 'next' },
  { date: 'Mar 29', day: 'Sat', routine: null, status: 'rest', _week: 'next' },
  { date: 'Mar 30', day: 'Sun', routine: null, status: 'rest', _week: 'next' },
];

function tagDotSC(t) {
  return ({
    push: 'var(--accent)',
    pull: 'var(--ok)',
    legs: 'var(--warn)',
    upper: '#7c5dff',
    lower: '#1a8a8a',
    full: 'var(--ink-600)',
  })[t] || 'var(--ink-400)';
}

function statusBadge(status) {
  return ({
    'completed': { label: 'Done',    tone: 'ok' },
    'today':     { label: 'Today',   tone: 'pr' },
    'planned':   null,
    'missed':    { label: 'Missed',  tone: 'warn' },
    'rest':      null,
  })[status];
}

function DayCard({ day, mobile, onStart }) {
  const [hover, setHover] = useStateSC(false);
  const isToday = day.status === 'today';
  const isRest = day.status === 'rest';
  const isCompleted = day.status === 'completed';
  const badge = statusBadge(day.status);
  const isCoach = day.source === 'coach';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: isToday ? 'var(--ink-0)' : (isCompleted ? 'var(--ink-50)' : 'var(--ink-0)'),
        border: '1px solid ' + (isToday ? 'var(--accent)' : (hover && day.routine ? 'var(--ink-150)' : 'var(--ink-100)')),
        borderRadius: 10,
        padding: mobile ? 14 : 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 130,
        position: 'relative',
        transition: 'border-color 120ms',
      }}
    >
      {/* Day header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: isToday ? 'var(--accent)' : 'var(--ink-400)',
            fontWeight: 500,
          }}>{day.day}</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 18,
            fontWeight: 600,
            color: isToday ? 'var(--accent)' : 'var(--ink-900)',
            lineHeight: 1.1,
            marginTop: 2,
            fontFeatureSettings: '"tnum" 1',
          }}>{day.date.split(' ')[1]}</div>
        </div>
        {badge && <Tag tone={badge.tone}>{badge.label}</Tag>}
      </div>

      {/* Body */}
      {day.routine ? (
        <>
          <div style={{ marginTop: 2 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: tagDotSC(day.routine.tag) }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--ink-400)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>{day.routine.tag}</span>
            </div>
            <div style={{
              fontSize: 14,
              fontWeight: 500,
              color: isCompleted ? 'var(--ink-600)' : 'var(--ink-900)',
              textDecoration: isCompleted ? 'line-through' : 'none',
              textDecorationColor: 'var(--ink-200)',
            }}>{day.routine.name}</div>
            {(day.duration || isCoach) && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                {day.duration && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>{day.duration}</span>
                )}
                {isCoach && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--ink-600)',
                    background: 'var(--ink-100)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    <Icon name="user" size={9} /> coach
                  </span>
                )}
              </div>
            )}
          </div>

          {isToday && (
            <Button
              variant="primary"
              size="sm"
              icon="play"
              onClick={() => onStart(day.routine)}
              style={{ marginTop: 'auto', justifyContent: 'center' }}
            >
              Resume
            </Button>
          )}
        </>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-400)',
          fontSize: 13,
        }}>
          Rest
        </div>
      )}
    </div>
  );
}

function CoachProgramCard({ mobile }) {
  const progressPct = (coachProgram.week / coachProgram.totalWeeks) * 100;
  return (
    <div style={{
      background: 'var(--ink-900)',
      color: 'var(--ink-0)',
      borderRadius: 12,
      padding: mobile ? '20px 18px' : '24px 28px',
      marginBottom: 28,
      display: 'grid',
      gridTemplateColumns: mobile ? '1fr' : '1.4fr 1fr',
      gap: mobile ? 18 : 28,
      alignItems: 'center',
    }}>
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#9a9a92',
          marginBottom: 8,
        }}>Your coach program</div>
        <h2 style={{
          fontFamily: 'var(--font-sans)',
          fontSize: mobile ? 22 : 26,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          margin: 0,
          color: 'var(--ink-0)',
        }}>{coachProgram.name}</h2>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: '#c9c9c2',
          marginTop: 6,
        }}>
          {coachProgram.coach} · {coachProgram.daysPerWeek} days/week · {coachProgram.startDate} → {coachProgram.endDate}
        </div>
        <p style={{ fontSize: 13, color: '#c9c9c2', lineHeight: 1.5, marginTop: 14, marginBottom: 16, maxWidth: 420 }}>
          {coachProgram.description}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" style={{ background: 'rgba(255,255,255,0.08)', color: '#fcfcfa', borderColor: 'rgba(255,255,255,0.12)' }}>
            View program
          </Button>
          <Button variant="ghost" size="sm" icon="message-square" style={{ color: '#fcfcfa' }}>
            Message coach
          </Button>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#9a9a92',
          }}>Week {coachProgram.week} of {coachProgram.totalWeeks}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fcfcfa', fontFeatureSettings: '"tnum" 1' }}>
            {Math.round(progressPct)}%
          </span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: progressPct + '%',
            background: 'var(--accent)',
          }} />
        </div>

        {/* Week dots */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${coachProgram.totalWeeks}, 1fr)`,
          gap: 4,
          marginTop: 16,
        }}>
          {Array.from({ length: coachProgram.totalWeeks }).map((_, i) => {
            const wk = i + 1;
            return (
              <div key={i} style={{
                height: 6,
                background: wk < coachProgram.week ? 'var(--accent)'
                  : wk === coachProgram.week ? 'var(--accent)'
                  : 'rgba(255,255,255,0.08)',
                opacity: wk === coachProgram.week ? 1 : (wk < coachProgram.week ? 0.5 : 1),
                borderRadius: 2,
              }} />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#8a8a82', letterSpacing: '0.08em', textTransform: 'uppercase' }}>w1</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#8a8a82', letterSpacing: '0.08em', textTransform: 'uppercase' }}>w{coachProgram.totalWeeks}</span>
        </div>
      </div>
    </div>
  );
}

function ScheduleScreen({ onStartRoutine }) {
  const [showSource, setShowSource] = useStateSC('all'); // 'all' | 'coach' | 'self'
  const mobile = useIsMobile();

  const thisWeek = scheduleData.filter(d => d._week !== 'next');
  const nextWeek = scheduleData.filter(d => d._week === 'next');

  const passesFilter = (d) => {
    if (showSource === 'all') return true;
    if (!d.routine) return showSource === 'all'; // hide rest days when filtering
    return d.source === showSource;
  };

  // Compute weekly stats
  const completedSets = thisWeek.filter(d => d.status === 'completed').length;
  const plannedSets = thisWeek.filter(d => d.routine).length;

  return (
    <div style={{ padding: mobile ? '20px 16px 32px' : '32px 40px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        alignItems: mobile ? 'flex-start' : 'baseline',
        flexDirection: mobile ? 'column' : 'row',
        gap: mobile ? 14 : 0,
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <Label style={{ marginBottom: 8 }}>This week · Mar 17 – Mar 23</Label>
          <h1 style={{ fontSize: mobile ? 28 : 36, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
            4 sessions planned.
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-400)', marginTop: 6 }}>
            {completedSets}/{plannedSets} done this week · {plannedSets - completedSets} to go
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Chip active={showSource === 'all'}  onClick={() => setShowSource('all')}>All</Chip>
          <Chip active={showSource === 'coach'} onClick={() => setShowSource('coach')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="user" size={11} />
              From coach
            </span>
          </Chip>
          <Chip active={showSource === 'self'} onClick={() => setShowSource('self')}>Mine</Chip>
        </div>
      </div>

      <CoachProgramCard mobile={mobile} />

      <Label style={{ marginBottom: 12 }}>This week</Label>
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(7, 1fr)',
        gap: mobile ? 10 : 8,
        marginBottom: 32,
      }}>
        {thisWeek.filter(passesFilter).map(d => (
          <DayCard key={d.date} day={d} mobile={mobile} onStart={onStartRoutine} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <Label>Next week · Mar 24 – Mar 30</Label>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          preview
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(7, 1fr)',
        gap: mobile ? 10 : 8,
        opacity: 0.7,
      }}>
        {nextWeek.filter(passesFilter).map(d => (
          <DayCard key={d.date} day={d} mobile={mobile} onStart={onStartRoutine} />
        ))}
      </div>

      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <Button variant="ghost" icon="calendar-days">View full plan</Button>
      </div>
    </div>
  );
}

Object.assign(window, { ScheduleScreen });
