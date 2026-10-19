// ─── Stable ID Generation & Content Hashing ────────────────────────────
// Generates deterministic IDs from source evidence so reruns don't duplicate.

import { type ExtractedEvent, type StableEventId } from './types';

/**
 * Generates a stable, deterministic event ID from its core identity fields.
 * Two events from the same source with the same course/day/time always
 * produce the same ID, enabling idempotent reruns.
 */
export function generateEventId(
  courseCode: string,
  type: string,
  weekday: string,
  sessionIndex: number = 0,
  examDate?: string
): StableEventId {
  const parts = [courseCode, type, weekday, sessionIndex.toString()];
  if (examDate) parts.push(examDate);
  const raw = parts.join('|').toLowerCase().trim();
  return `evt-${simpleHash(raw)}`;
}

/**
 * Generates a content hash for change detection.
 * Used to determine if an event has changed between timetable revisions.
 */
export function generateContentHash(event: Partial<ExtractedEvent>): string {
  const fields = [
    event.course,
    event.courseCode,
    event.type,
    event.weekday,
    event.startTime,
    event.endTime,
    event.room,
    event.instructor,
    event.recurrenceStart,
    event.recurrenceEnd,
    event.examDate,
  ];
  return `hash-${simpleHash(fields.join('|'))}`;
}

/**
 * Simple deterministic hash function (djb2 variant).
 * Not cryptographic — used only for stable IDs and change detection.
 */
export function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash).toString(36);
}

export function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function generateProposalId(): string {
  return `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function generateClashId(): string {
  return `clash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
