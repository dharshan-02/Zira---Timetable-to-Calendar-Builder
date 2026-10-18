// ─── Verifier ──────────────────────────────────────────────────────────
// Reads events back from the calendar adapter INDEPENDENTLY
// and compares them against the approved proposal.
// This is separate from the action path — verification must not
// simply echo what the action claims to have done.

import { type CalendarEvent, type ExtractedEvent, type VerificationResult, type VerificationReport, type VerificationStatus } from './types';
import { readEvents } from './calendarAdapter';

/**
 * Verify calendar events by reading them back from the destination
 * and comparing against the approved proposal.
 */
export function verifyEvents(
  proposedEvents: ExtractedEvent[],
  runId: string
): VerificationReport {
  const eventIds = proposedEvents.map(e => e.id);
  const calendarEvents = readEvents(eventIds);

  const results: VerificationResult[] = [];

  for (const proposed of proposedEvents) {
    const actual = calendarEvents.get(proposed.id);
    const result = compareEvent(proposed, actual);
    results.push(result);
  }

  const verified = results.filter(r => r.status === 'verified').length;
  const mismatched = results.filter(r => r.status === 'mismatched').length;
  const pending = results.filter(r => r.status === 'pending').length;
  const failed = results.filter(r => r.status === 'failed').length;

  return {
    runId,
    totalEvents: proposedEvents.length,
    verified,
    mismatched,
    pending,
    failed,
    results,
    timestamp: new Date().toISOString(),
  };
}

function compareEvent(
  proposed: ExtractedEvent,
  actual: CalendarEvent | null
): VerificationResult {
  if (!actual) {
    return {
      eventId: proposed.id,
      status: 'failed',
      expected: {
        id: proposed.id,
        title: `${proposed.courseCode} — ${proposed.course}`,
        day: proposed.weekday,
        startTime: proposed.startTime,
        endTime: proposed.endTime,
        room: proposed.room,
      },
      actual: null,
      differences: ['Event not found in calendar — write may have failed'],
    };
  }

  const differences: string[] = [];

  // Compare key fields
  if (proposed.weekday !== actual.day) {
    differences.push(`Day: expected "${proposed.weekday}", got "${actual.day}"`);
  }
  if (proposed.startTime !== actual.startTime) {
    differences.push(`Start time: expected "${proposed.startTime}", got "${actual.startTime}"`);
  }
  if (proposed.endTime !== actual.endTime) {
    differences.push(`End time: expected "${proposed.endTime}", got "${actual.endTime}"`);
  }
  if (proposed.room !== actual.room) {
    differences.push(`Room: expected "${proposed.room}", got "${actual.room}"`);
  }
  if (proposed.recurrenceStart !== actual.recurrenceStart) {
    differences.push(`Recurrence start: expected "${proposed.recurrenceStart}", got "${actual.recurrenceStart}"`);
  }
  if (proposed.recurrenceEnd !== actual.recurrenceEnd) {
    differences.push(`Recurrence end: expected "${proposed.recurrenceEnd}", got "${actual.recurrenceEnd}"`);
  }
  if (proposed.contentHash !== actual.contentHash) {
    differences.push(`Content hash mismatch: expected "${proposed.contentHash}", got "${actual.contentHash}"`);
  }

  const status: VerificationStatus = differences.length === 0 ? 'verified' : 'mismatched';

  return {
    eventId: proposed.id,
    status,
    expected: {
      id: proposed.id,
      title: `${proposed.courseCode} — ${proposed.course}`,
      day: proposed.weekday,
      startTime: proposed.startTime,
      endTime: proposed.endTime,
      room: proposed.room,
      recurrenceStart: proposed.recurrenceStart,
      recurrenceEnd: proposed.recurrenceEnd,
      contentHash: proposed.contentHash,
    },
    actual: {
      id: actual.id,
      title: actual.title,
      day: actual.day,
      startTime: actual.startTime,
      endTime: actual.endTime,
      room: actual.room,
      recurrenceStart: actual.recurrenceStart,
      recurrenceEnd: actual.recurrenceEnd,
      contentHash: actual.contentHash,
    } as Partial<CalendarEvent>,
    differences,
  };
}
