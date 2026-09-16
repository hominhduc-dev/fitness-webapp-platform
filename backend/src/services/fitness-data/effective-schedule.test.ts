import { describe, expect, it } from 'vitest'
import { buildSerializedScheduleEntriesForWeek as build } from './core'

type Input = Parameters<typeof build>[0]
const workouts: Input['workouts'] = [1, 2, 3].map((day) => ({ id: `day${day}`, name: `Day ${day}`, scheduledDay: day, exercises: [], isPersonal: false, kind: undefined, notes: undefined, programId: undefined, scheduledDate: undefined, weekIndex: 0, duration: 60 }))
const mondayLog: Input['logs'][number] = { id: 'log1', workout: workouts[0], startedAt: new Date('2026-09-14T12:00:00Z'), completedAt: new Date('2026-09-14T13:00:00Z'), plannedDate: '2026-09-14', exercises: [], comments: [], notes: undefined, programId: undefined, totalVolume: 0 }
function schedule(today: string, logs = [mondayLog], plans = workouts) {
  return build({ todayStart: new Date(`${today}T00:00:00Z`), weekStart: new Date('2026-09-14T00:00:00Z'), logs, workouts: plans })
}
describe('effective weekly schedule', () => {
  it('moves missed Day 2 to Wednesday and Day 3 to Thursday', () => {
    const entries = schedule('2026-09-16')
    expect(entries[1].workout).toBeNull()
    expect(entries[2].workout?.id).toBe('day2')
    expect(entries[3].workout?.id).toBe('day3')
  })
  it('keeps rolling an unfinished session forward', () => {
    expect(schedule('2026-09-17')[3].workout?.id).toBe('day2')
  })
  it('records completion on the actual day without duplicating the planned session', () => {
    const log = { ...mondayLog, id: 'log2', workout: workouts[1], plannedDate: '2026-09-15', startedAt: new Date('2026-09-16T12:00:00Z'), completedAt: new Date('2026-09-16T13:00:00Z') }
    const entries = schedule('2026-09-16', [log, mondayLog])
    expect(entries[2].isCompleted).toBe(true)
    expect(entries.filter((entry) => entry.workout?.id === 'day2')).toHaveLength(1)
    expect(entries[3].workout?.id).toBe('day3')
  })
  it('preserves a date-pinned workout', () => {
    const pinned = { ...workouts[0], id: 'fixed', scheduledDate: '2026-09-16' }
    const entries = schedule('2026-09-16', [mondayLog], [...workouts, pinned])
    expect(entries[2].workout?.id).toBe('fixed')
    expect(entries[3].workout?.id).toBe('day2')
  })
})
