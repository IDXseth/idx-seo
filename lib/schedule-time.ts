// Scheduled runs are set in local wall-clock time for one time zone per
// deployment (default Arizona). Vercel's servers run in UTC, so the next run
// is worked out on the zone's own calendar and converted to a UTC instant.
// Pure functions only: imported by the Run page (client) as well as the server.

export const SCHEDULE_TIMEZONE = process.env.NEXT_PUBLIC_SCHEDULE_TIMEZONE || 'America/Phoenix'

// Short name shown next to schedule times in the UI.
export function scheduleTimezoneLabel(timeZone: string = SCHEDULE_TIMEZONE): string {
  if (timeZone === 'America/Phoenix') return 'Arizona time'
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value
    return name ?? timeZone
  } catch {
    return timeZone
  }
}

export interface ScheduleRule {
  frequency: string
  customDays?: number | null
  dayOfWeek?: number | null   // 0 = Sunday
  dayOfMonth?: number | null
  hour: number                // 0–23, local to the schedule's time zone
}

interface LocalParts { year: number; month: number; day: number; hour: number; minute: number; weekday: number }

// Wall-clock date and time of `date` in `timeZone`.
function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: weekdays.indexOf(get('weekday')),
  }
}

// The UTC instant when the clock in `timeZone` reads year-month-day hour:00.
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour)
  let instant = wallAsUtc
  // Two passes settle the zone's offset, including across DST changes.
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(instant), timeZone)
    const shownAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
    instant += wallAsUtc - shownAsUtc
  }
  return new Date(instant)
}

// Calendar arithmetic on a local date (no time zone involved).
function addDays(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// The next time a schedule should fire, strictly after `now`, at `hour` local
// time in `timeZone`. Called when a schedule is created or edited (so a daily
// 9am schedule made at 8am runs today) and right after it fires (moving it on
// to the following occurrence).
export function computeNextRunAt(rule: ScheduleRule, timeZone: string = SCHEDULE_TIMEZONE, now: Date = new Date()): Date {
  const today = localParts(now, timeZone)
  const at = (d: { year: number; month: number; day: number }) => zonedTimeToUtc(d.year, d.month, d.day, rule.hour, timeZone)
  const isFuture = (date: Date) => date.getTime() > now.getTime()
  const todayDate = { year: today.year, month: today.month, day: today.day }

  switch (rule.frequency) {
    case 'daily': {
      const candidate = at(todayDate)
      return isFuture(candidate) ? candidate : at(addDays(today.year, today.month, today.day, 1))
    }
    case 'weekly': {
      const target = rule.dayOfWeek ?? 1
      let diff = (target - today.weekday + 7) % 7
      let candidate = at(addDays(today.year, today.month, today.day, diff))
      if (!isFuture(candidate)) {
        diff += 7
        candidate = at(addDays(today.year, today.month, today.day, diff))
      }
      return candidate
    }
    case 'monthly': {
      const dom = rule.dayOfMonth ?? 1
      const thisMonth = { year: today.year, month: today.month, day: Math.min(dom, daysInMonth(today.year, today.month)) }
      const candidate = at(thisMonth)
      if (isFuture(candidate)) return candidate
      const nextMonth = today.month === 12 ? { year: today.year + 1, month: 1 } : { year: today.year, month: today.month + 1 }
      return at({ ...nextMonth, day: Math.min(dom, daysInMonth(nextMonth.year, nextMonth.month)) })
    }
    case 'custom':
    default: {
      const candidate = at(todayDate)
      return isFuture(candidate) ? candidate : at(addDays(today.year, today.month, today.day, rule.customDays ?? 7))
    }
  }
}

// "Mon, Nov 17, 9:00 AM" in the schedule's time zone, for showing next runs.
export function formatInScheduleZone(date: Date | string, timeZone: string = SCHEDULE_TIMEZONE): string {
  return new Date(date).toLocaleString('en-US', {
    timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
