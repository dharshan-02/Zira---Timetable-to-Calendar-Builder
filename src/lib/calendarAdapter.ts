// ─── Mock Calendar Adapter ─────────────────────────────────────────────
// Writes events to persistent local demo storage, reads them back for audit,
// and generates standards-based .ics files. It does not connect to a vendor.
// No paid calendar API required.

import { type CalendarEvent, type ExtractedEvent } from './types';
import { loadRecords, saveRecords } from './persistence';

// ─── Persistent local calendar store ──────────────────────────────────
const calendarStore = new Map(loadRecords<CalendarEvent>('calendar-events.json').map((event) => [event.id, event]));

/**
 * Write events to the mock calendar.
 * Uses stable IDs for idempotent writes — same ID overwrites, not duplicates.
 */
export function writeEvents(events: ExtractedEvent[]): CalendarEvent[] {
  const written: CalendarEvent[] = [];
  const now = new Date().toISOString();

  for (const event of events) {
    const existing = calendarStore.get(event.id);
    const calEvent: CalendarEvent = {
      id: event.id,
      title: `${event.courseCode} — ${event.course}`,
      day: event.weekday,
      startTime: event.startTime,
      endTime: event.endTime,
      room: event.room,
      instructor: event.instructor,
      recurrenceStart: event.recurrenceStart,
      recurrenceEnd: event.recurrenceEnd,
      examDate: event.examDate,
      type: event.type,
      isElective: event.isElective,
      sourceEventId: event.id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      contentHash: event.contentHash,
    };
    calendarStore.set(event.id, calEvent);
    written.push(calEvent);
  }

  saveRecords('calendar-events.json', calendarStore.values());

  return written;
}

/**
 * Read events back from the mock calendar for verification.
 * Independent read-back — doesn't share state with the write path.
 */
export function readEvents(eventIds: string[]): Map<string, CalendarEvent | null> {
  const results = new Map<string, CalendarEvent | null>();
  for (const id of eventIds) {
    results.set(id, calendarStore.get(id) || null);
  }
  return results;
}

/**
 * Read all events from the calendar store.
 */
export function readAllEvents(): CalendarEvent[] {
  return Array.from(calendarStore.values());
}

/**
 * Delete events from the mock calendar (for test cleanup).
 */
export function deleteEvents(eventIds: string[]): void {
  for (const id of eventIds) {
    calendarStore.delete(id);
  }
  saveRecords('calendar-events.json', calendarStore.values());
}

/**
 * Clear the entire calendar (for test reset).
 */
export function clearCalendar(): void {
  calendarStore.clear();
  saveRecords('calendar-events.json', []);
}

/**
 * Compare existing calendar events with proposed events to determine
 * which are new, updated, or unchanged.
 */
export function diffEvents(proposed: ExtractedEvent[]): {
  newEvents: string[];
  updatedEvents: string[];
  unchangedEvents: string[];
} {
  const newEvents: string[] = [];
  const updatedEvents: string[] = [];
  const unchangedEvents: string[] = [];

  for (const event of proposed) {
    const existing = calendarStore.get(event.id);
    if (!existing) {
      newEvents.push(event.id);
    } else if (existing.contentHash !== event.contentHash) {
      updatedEvents.push(event.id);
    } else {
      unchangedEvents.push(event.id);
    }
  }

  return { newEvents, updatedEvents, unchangedEvents };
}

// ─── ICS Generation ────────────────────────────────────────────────────

const DAYS_ICAL: Record<string, string> = {
  'Monday': 'MO',
  'Tuesday': 'TU',
  'Wednesday': 'WE',
  'Thursday': 'TH',
  'Friday': 'FR',
  'Saturday': 'SA',
  'Sunday': 'SU',
};

/**
 * Generate an ICS file string from calendar events.
 * Uses RRULE for weekly recurrence.
 */
export function generateICS(events: CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Timetable Builder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Student Timetable',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@timetable-builder`);
    lines.push(`SUMMARY:${event.title}`);
    lines.push(`LOCATION:${event.room}`);
    lines.push(`DESCRIPTION:Instructor: ${event.instructor}\\nType: ${event.type}${event.isElective ? ' (Elective)' : ''}`);

    if (event.examDate) {
      // One-off exam event
      const dateStr = event.examDate.replace(/-/g, '');
      const startStr = event.startTime.replace(':', '');
      const endStr = event.endTime.replace(':', '');
      lines.push(`DTSTART:${dateStr}T${startStr}00`);
      lines.push(`DTEND:${dateStr}T${endStr}00`);
    } else {
      // Recurring weekly event
      const firstDate = getFirstOccurrence(event.day, event.recurrenceStart);
      const dateStr = firstDate.replace(/-/g, '');
      const startStr = event.startTime.replace(':', '');
      const endStr = event.endTime.replace(':', '');
      const untilDate = event.recurrenceEnd.replace(/-/g, '');
      const icalDay = DAYS_ICAL[event.day] || 'MO';

      lines.push(`DTSTART:${dateStr}T${startStr}00`);
      lines.push(`DTEND:${dateStr}T${endStr}00`);
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${icalDay};UNTIL=${untilDate}T235959Z`);
    }

    lines.push(`CREATED:${formatICSTimestamp(event.createdAt)}`);
    lines.push(`LAST-MODIFIED:${formatICSTimestamp(event.updatedAt)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function getFirstOccurrence(dayName: string, startDate: string): string {
  const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    .indexOf(dayName);
  if (dayIndex === -1) return startDate;

  const start = new Date(startDate);
  const currentDay = start.getDay();
  let diff = dayIndex - currentDay;
  if (diff < 0) diff += 7;

  start.setDate(start.getDate() + diff);
  return start.toISOString().split('T')[0];
}

function formatICSTimestamp(isoStr: string): string {
  try {
    return new Date(isoStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  } catch {
    return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }
}
