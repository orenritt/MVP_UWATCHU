import {
  eachDayOfInterval,
  format,
  addHours,
  subHours,
  startOfWeek,
  addWeeks,
  isBefore,
} from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import type { Commitment } from './supabase'

export interface ReminderSlot {
  scheduledFor: Date
  periodId: string
  proofDeadline: Date
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return { hours, minutes }
}

/**
 * Sets time on a date in the user's timezone, returns UTC Date.
 * e.g. "09:00" in "America/New_York" on Jan 15 → Jan 15 14:00 UTC (EST)
 */
function setTimeInZone(date: Date, timeStr: string, timezone: string): Date {
  const { hours, minutes } = parseTime(timeStr)
  // Build a "wall clock" date in the target timezone
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const zonedWall = new Date(year, month, day, hours, minutes, 0, 0)
  // Convert from the user's local wall-clock time to UTC
  return fromZonedTime(zonedWall, timezone)
}

export function buildReminderSchedule(commitment: Commitment): ReminderSlot[] {
  const slots: ReminderSlot[] = []
  const { cadence, starts_at, ends_at, timezone } = commitment
  const tz = timezone || 'America/New_York'

  if (!starts_at || !ends_at) return slots

  const start = new Date(starts_at)
  const end = new Date(ends_at)

  if (cadence.type === 'daily' || cadence.type === 'abstinence') {
    eachDayOfInterval({ start, end }).forEach((day, i) => {
      slots.push({
        scheduledFor: setTimeInZone(day, cadence.reminder_time, tz),
        periodId: `day-${i}`,
        proofDeadline: setTimeInZone(day, cadence.proof_deadline_time, tz),
      })
    })
  }

  if (cadence.type === 'frequency') {
    eachDayOfInterval({ start, end })
      .filter((day) => {
        const dayName = format(day, 'EEEE').toLowerCase()
        return cadence.days?.includes(dayName)
      })
      .forEach((day, i) => {
        slots.push({
          scheduledFor: setTimeInZone(day, cadence.reminder_time, tz),
          periodId: `slot-${i}`,
          proofDeadline: setTimeInZone(day, cadence.proof_deadline_time, tz),
        })
      })
  }

  if (cadence.type === 'deadline') {
    // Weekly progress check-ins
    let weekStart = startOfWeek(start)
    let weekIndex = 0
    while (isBefore(weekStart, end)) {
      const reminderTime = setTimeInZone(weekStart, cadence.reminder_time, tz)
      if (isBefore(start, reminderTime) || start.getTime() === reminderTime.getTime()) {
        // Skip if before start
      }
      if (isBefore(reminderTime, end)) {
        slots.push({
          scheduledFor: reminderTime,
          periodId: `week-${weekIndex}`,
          proofDeadline: addHours(reminderTime, 24),
        })
      }
      weekStart = addWeeks(weekStart, 1)
      weekIndex++
    }

    // Final deadline slot
    slots.push({
      scheduledFor: subHours(end, 2),
      periodId: 'final',
      proofDeadline: end,
    })
  }

  return slots
}

export function getProofDeadline(
  commitment: Commitment,
  periodId: string
): Date {
  const schedule = buildReminderSchedule(commitment)
  const slot = schedule.find((s) => s.periodId === periodId)
  if (!slot) {
    // Fallback: proof_deadline_time today in user's timezone
    const tz = commitment.timezone || 'America/New_York'
    const now = new Date()
    return setTimeInZone(now, commitment.cadence.proof_deadline_time || '22:00', tz)
  }
  return slot.proofDeadline
}

export function daysRemaining(commitment: Commitment): number {
  if (!commitment.ends_at) return 0
  const now = new Date()
  const end = new Date(commitment.ends_at)
  const diff = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function calculateReEngagementDays(durationDays: number): {
  firstTouch: number
  secondTouch: number
} {
  const firstTouch = Math.min(Math.max(Math.floor(durationDays * 0.2), 3), 14)
  const secondTouch = Math.min(firstTouch * 2, 21)
  return { firstTouch, secondTouch }
}
