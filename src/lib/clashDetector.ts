// ─── Clash Detector ────────────────────────────────────────────────────
// Compares time intervals explicitly. Identifies overlaps among all events.
// Never silently drops conflicting events.

import { type ExtractedEvent, type Clash } from './types';
import { generateClashId } from './ids';

export interface ClashDetectionResult {
  clashes: Clash[];
  totalComparisons: number;
  evidence: string[];
}

/**
 * Detect all time clashes among a set of extracted events.
 * Compares every pair of events on the same day.
 * Returns all clashes with evidence — never drops events.
 */
export function detectClashes(events: ExtractedEvent[]): ClashDetectionResult {
  const clashes: Clash[] = [];
  const evidence: string[] = [];
  let totalComparisons = 0;

  // Group events by day for efficient comparison
  const byDay = new Map<string, ExtractedEvent[]>();
  for (const event of events) {
    const day = event.weekday;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(event);
  }

  // Compare all pairs within each day
  for (const [day, dayEvents] of byDay) {
    for (let i = 0; i < dayEvents.length; i++) {
      for (let j = i + 1; j < dayEvents.length; j++) {
        totalComparisons++;
        const a = dayEvents[i];
        const b = dayEvents[j];

        const overlap = findOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
        if (overlap) {
          const clash: Clash = {
            id: generateClashId(),
            eventA: a.id,
            eventB: b.id,
            eventALabel: `${a.courseCode} (${a.type}${a.isElective ? ', elective' : ''})`,
            eventBLabel: `${b.courseCode} (${b.type}${b.isElective ? ', elective' : ''})`,
            day,
            overlapStart: overlap.start,
            overlapEnd: overlap.end,
            reason: buildClashReason(a, b, overlap),
            evidence: buildClashEvidence(a, b, overlap),
          };
          clashes.push(clash);
          evidence.push(
            `CLASH: ${a.courseCode} (${a.startTime}-${a.endTime}) overlaps with ` +
            `${b.courseCode} (${b.startTime}-${b.endTime}) on ${day} ` +
            `[overlap: ${overlap.start}-${overlap.end}]`
          );
        }
      }
    }
  }

  // Also check exam date clashes
  const examEvents = events.filter(e => e.examDate);
  for (let i = 0; i < examEvents.length; i++) {
    for (let j = i + 1; j < examEvents.length; j++) {
      totalComparisons++;
      const a = examEvents[i];
      const b = examEvents[j];

      if (a.examDate === b.examDate) {
        const overlap = findOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
        if (overlap) {
          const clash: Clash = {
            id: generateClashId(),
            eventA: a.id,
            eventB: b.id,
            eventALabel: `${a.courseCode} Exam`,
            eventBLabel: `${b.courseCode} Exam`,
            day: `Exam Day (${a.examDate})`,
            overlapStart: overlap.start,
            overlapEnd: overlap.end,
            reason: `Exam time clash on ${a.examDate}`,
            evidence: `${a.courseCode} exam (${a.startTime}-${a.endTime}) conflicts with ${b.courseCode} exam (${b.startTime}-${b.endTime}) on ${a.examDate}`,
          };
          clashes.push(clash);
          evidence.push(
            `EXAM CLASH: ${a.courseCode} and ${b.courseCode} exams overlap on ${a.examDate}`
          );
        }
      }
    }
  }

  if (clashes.length === 0) {
    evidence.push('No clashes detected among all events.');
  }

  return { clashes, totalComparisons, evidence };
}

interface Overlap {
  start: string;
  end: string;
  durationMinutes: number;
}

/**
 * Check if two time intervals overlap.
 * Returns the overlap interval if they do, null otherwise.
 */
function findOverlap(
  startA: string, endA: string,
  startB: string, endB: string
): Overlap | null {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);

  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);

  if (overlapStart < overlapEnd) {
    return {
      start: minutesToTime(overlapStart),
      end: minutesToTime(overlapEnd),
      durationMinutes: overlapEnd - overlapStart,
    };
  }

  return null;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function buildClashReason(a: ExtractedEvent, b: ExtractedEvent, overlap: Overlap): string {
  const parts: string[] = [];

  if (a.isElective && b.type === 'lab') {
    parts.push(`Elective "${a.courseCode}" clashes with core lab "${b.courseCode}"`);
  } else if (b.isElective && a.type === 'lab') {
    parts.push(`Elective "${b.courseCode}" clashes with core lab "${a.courseCode}"`);
  } else if (a.isElective && b.isElective) {
    parts.push(`Two electives clash: "${a.courseCode}" and "${b.courseCode}"`);
  } else {
    parts.push(`"${a.courseCode}" (${a.type}) overlaps with "${b.courseCode}" (${b.type})`);
  }

  parts.push(`Overlap: ${overlap.durationMinutes} minutes (${overlap.start} – ${overlap.end})`);

  return parts.join('. ');
}

function buildClashEvidence(a: ExtractedEvent, b: ExtractedEvent, overlap: Overlap): string {
  return [
    `Event A: [${a.id}] ${a.courseCode} ${a.weekday} ${a.startTime}-${a.endTime} (Row ${a.sourceRow} of ${a.sourceFile})`,
    `Event B: [${b.id}] ${b.courseCode} ${b.weekday} ${b.startTime}-${b.endTime} (Row ${b.sourceRow} of ${b.sourceFile})`,
    `Overlap: ${overlap.start}-${overlap.end} (${overlap.durationMinutes} min)`,
  ].join('\n');
}
