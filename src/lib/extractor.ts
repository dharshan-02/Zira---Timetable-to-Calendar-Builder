// ─── Event Extractor ───────────────────────────────────────────────────
// Converts parsed rows into structured ExtractedEvent objects.
// Separate from parser so that verification reads raw data independently.

import { type ExtractedEvent, type EventType, type UnparsedRow } from './types';
import { generateEventId, generateContentHash } from './ids';
import { EXPLICIT_TIME_RANGE_PATTERN, INFERRED_TIME_RANGE_PATTERN, type ParsedRow, type ParseResult } from './parser';

export interface ExtractionResult {
  events: ExtractedEvent[];
  unparsedRows: UnparsedRow[];
  sourceFile: string;
  extractedAt: string;
  totalRows: number;
  successfulExtractions: number;
  evidence: string[];
}

const DAYS_MAP: Record<string, string> = {
  'mon': 'Monday', 'monday': 'Monday',
  'tue': 'Tuesday', 'tuesday': 'Tuesday',
  'wed': 'Wednesday', 'wednesday': 'Wednesday',
  'thu': 'Thursday', 'thursday': 'Thursday',
  'fri': 'Friday', 'friday': 'Friday',
  'sat': 'Saturday', 'saturday': 'Saturday',
  'sun': 'Sunday', 'sunday': 'Sunday',
  'mondays': 'Monday', 'tuesdays': 'Tuesday', 'wednesdays': 'Wednesday',
  'thursdays': 'Thursday', 'fridays': 'Friday', 'saturdays': 'Saturday', 'sundays': 'Sunday',
};

const TYPE_KEYWORDS: Record<string, EventType> = {
  'lab': 'lab',
  'laboratory': 'lab',
  'practical': 'lab',
  'lecture': 'lecture',
  'lec': 'lecture',
  'tutorial': 'tutorial',
  'tut': 'tutorial',
  'exam': 'exam',
  'midterm': 'exam',
  'endsem': 'exam',
  'final': 'exam',
  'quiz': 'exam',
};

/**
 * Extract structured events from parsed rows.
 * Records evidence for each extraction decision.
 */
export function extractEvents(
  parseResult: ParseResult,
  electives: string[],
  semesterStart: string = '2026-08-01',
  semesterEnd: string = '2026-11-30'
): ExtractionResult {
  const events: ExtractedEvent[] = [];
  const unparsedRows: UnparsedRow[] = [...parseResult.unparsedRows];
  const evidence: string[] = [];

  const dataRows = parseResult.rows.filter(r => !r.isHeader);

  const sessionCounters = new Map<string, number>();

  for (const row of dataRows) {
    if (row.confidence === 'unreadable') {
      unparsedRows.push({
        rowNumber: row.rowNumber,
        rawContent: row.rawContent,
        sourceFile: row.sourceFile,
        reason: `Unreadable: ${row.parseNotes.join('; ')}`,
        sourceExcerpt: row.sourceExcerpt,
      });
      evidence.push(`Row ${row.rowNumber}: Marked as unreadable — ${row.parseNotes.join('; ')}`);
      continue;
    }

    try {
      const event = extractSingleEvent(row, electives, semesterStart, semesterEnd, sessionCounters);
      if (event) {
        events.push(event);
        evidence.push(`Row ${row.rowNumber}: Extracted ${event.courseCode} ${event.weekday} ${event.startTime}-${event.endTime} [confidence: ${event.confidence}]`);
      } else {
        unparsedRows.push({
          rowNumber: row.rowNumber,
          rawContent: row.rawContent,
          sourceFile: row.sourceFile,
          reason: 'Could not extract required fields (course code, day, time)',
          sourceExcerpt: row.sourceExcerpt,
        });
        evidence.push(`Row ${row.rowNumber}: Failed to extract — missing required fields`);
      }
    } catch (err) {
      unparsedRows.push({
        rowNumber: row.rowNumber,
        rawContent: row.rawContent,
        sourceFile: row.sourceFile,
        reason: `Extraction error: ${err instanceof Error ? err.message : String(err)}`,
        sourceExcerpt: row.sourceExcerpt,
      });
      evidence.push(`Row ${row.rowNumber}: Error during extraction — ${err}`);
    }
  }

  return {
    events,
    unparsedRows,
    sourceFile: parseResult.sourceFile,
    extractedAt: new Date().toISOString(),
    totalRows: dataRows.length,
    successfulExtractions: events.length,
    evidence,
  };
}

function extractSingleEvent(
  row: ParsedRow,
  electives: string[],
  semesterStart: string,
  semesterEnd: string,
  sessionCounters?: Map<string, number>
): ExtractedEvent | null {
  const text = row.rawContent;
  const cols = row.columns;

  // Prefer the course-code column when available. Some source PDFs include a
  // separate "COM | 100 LEVEL" programme column before the real course code.
  const codeMatch = cols
    .filter((column) => !/\blevel\b/i.test(column))
    .map((column) => column.match(/(?<![A-Z])([A-Z]{2,4})\s*(\d{2,4})\b/))
    .find((match) => match);
  const fallbackCodeMatch = codeMatch ?? text.match(/(?<![A-Z])([A-Z]{2,4})\s*(\d{2,4})\b/);
  if (!fallbackCodeMatch) return null;
  const courseCode = `${fallbackCodeMatch[1]}${fallbackCodeMatch[2]}`;

  // Extract day
  const dayMatch = text.match(/\b(Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
  const weekday = dayMatch ? normalizeDay(dayMatch[1]) : '';

  // Extract explicit time ranges first, including shared suffixes such as
  // "8-10am". Ranges without AM/PM are left for human review by the parser.
  const explicitRangeMatch = text.match(EXPLICIT_TIME_RANGE_PATTERN);
  const rangeMatch = explicitRangeMatch ?? text.match(INFERRED_TIME_RANGE_PATTERN);
  let startTime: string;
  let endTime: string;
  if (rangeMatch) {
    const startHour = Number(rangeMatch[1]);
    const endHour = Number(explicitRangeMatch ? rangeMatch[4] : rangeMatch[3]);
    const endMinute = explicitRangeMatch ? rangeMatch[5] : rangeMatch[4];
    let startPeriod = rangeMatch[3]?.toUpperCase();
    let endPeriod = explicitRangeMatch ? rangeMatch[6]?.toUpperCase() : undefined;

    // Many university PDFs omit AM/PM. Infer typical daytime slots while
    // retaining medium confidence so a person confirms them before approval.
    if (!startPeriod) {
      startPeriod = endPeriod
        ? (endHour === 12 && startHour < 12 ? 'AM' : startHour > endHour && endPeriod === 'PM' ? 'AM' : endPeriod)
        : (startHour === 12 || startHour <= 5 ? 'PM' : 'AM');
    }
    if (!endPeriod) {
      endPeriod = endHour === 12 ? 'PM' : endHour <= 5
        ? (startPeriod === 'AM' ? 'PM' : startPeriod)
        : startPeriod;
    }

    startTime = normalizeTime(`${rangeMatch[1]}:${rangeMatch[2] ?? '00'} ${startPeriod}`);
    endTime = normalizeTime(`${endHour}:${endMinute ?? '00'} ${endPeriod}`);
  } else {
    const timeMatches = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/g);
    if (!timeMatches || timeMatches.length < 1) return null;
    startTime = normalizeTime(timeMatches[0]);
    endTime = timeMatches.length >= 2 ? normalizeTime(timeMatches[1]) : addOneHour(startTime);
  }

  if (!weekday && !text.match(/exam|midterm|endsem|final/i)) return null;

  // Extract room
  const room = extractRoom(text, cols, courseCode);

  // Extract instructor
  const instructor = extractInstructor(cols);

  // Determine type
  const type = detectEventType(text);

  // Extract exam date
  const examDate = type === 'exam' ? extractExamDate(text) : undefined;

  // Course name (extract from columns or use code)
  const course = extractCourseName(cols, courseCode);

  // Check if elective
  const isElective = electives.some(e =>
    e.toLowerCase() === courseCode.toLowerCase() ||
    course.toLowerCase().includes(e.toLowerCase())
  );

  // Determine uncertain fields
  const uncertainFields: string[] = [];
  if (!room) uncertainFields.push('room');
  if (!instructor) uncertainFields.push('instructor');
  if (row.confidence === 'low') uncertainFields.push('courseCode');
  if (row.confidence !== 'high') uncertainFields.push('time');

  const sessionKey = `${courseCode}|${type}|${weekday || (examDate ? 'exam' : 'unknown')}`;
  const sessionIndex = sessionCounters ? (sessionCounters.get(sessionKey) || 0) : 0;
  if (sessionCounters) {
    sessionCounters.set(sessionKey, sessionIndex + 1);
  }

  const eventId = generateEventId(courseCode, type, weekday || (examDate ? 'exam' : 'unknown'), sessionIndex, examDate);

  const event: ExtractedEvent = {
    id: eventId,
    course,
    courseCode,
    type,
    weekday: weekday || (examDate ? 'Exam' : 'Unknown'),
    startTime,
    endTime,
    room: room || 'TBA',
    instructor: instructor || 'TBA',
    isElective,
    recurrenceStart: semesterStart,
    recurrenceEnd: semesterEnd,
    examDate,
    sourceRow: row.rowNumber,
    sourceExcerpt: row.sourceExcerpt,
    sourceFile: row.sourceFile,
    confidence: row.confidence === 'low' ? 'low' : uncertainFields.length > 1 ? 'medium' : 'high',
    uncertainFields,
    needsReview: row.confidence !== 'high' || uncertainFields.length > 0,
    contentHash: '',
  };

  event.contentHash = generateContentHash(event);
  return event;
}

function normalizeDay(day: string): string {
  return DAYS_MAP[day.toLowerCase()] || day;
}

function normalizeTime(time: string): string {
  const cleaned = time.trim().toUpperCase();

  // Already in 24h format?
  if (!cleaned.includes('AM') && !cleaned.includes('PM')) {
    return cleaned;
  }

  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
  if (!match) return cleaned;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3];

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${((h + 1) % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function extractRoom(text: string, cols: string[], courseCode: string): string {
  // Try pattern: room/hall/lab followed by identifier
  const roomMatch = text.match(/(?:Room|Hall|Lab|Rm|Studio|Moot|Workshop|Clinic)\s*[-:]?\s*([A-Z0-9][-A-Z0-9]+)/i);
  if (roomMatch) return roomMatch[0].trim();

  // Try pattern in columns: look for something like "A-101", "LH-301", "Lab-A12"
  for (const col of cols) {
    const trimmed = col.trim();
    if (trimmed.toUpperCase() === courseCode.toUpperCase()) continue;
    if (trimmed.toLowerCase().includes('lecture') || trimmed.toLowerCase().includes('lab')) continue;
    if (/^[A-Z]{1,4}[-\s]?\d{2,4}[A-Z]?$/i.test(trimmed) || /^(?:(?:LH|Lab|Hall|Room|Studio|Moot|Workshop|Clinic)[-\s]?[A-Z0-9]+|Skills Lab|City Clinic)$/i.test(trimmed)) {
      return trimmed;
    }
  }
  return '';
}

function extractInstructor(cols: string[]): string {
  // Look for "Dr.", "Prof.", or "Mr./Ms." patterns
  for (const col of cols) {
    if (/(?:Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s*\w+/i.test(col)) {
      return col.trim();
    }
  }
  // Last column might be instructor if it looks like a name
  if (cols.length >= 5) {
    const last = cols[cols.length - 1];
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(last.trim())) {
      return last.trim();
    }
  }
  return '';
}

function detectEventType(text: string): EventType {
  const lower = text.toLowerCase();
  for (const [keyword, type] of Object.entries(TYPE_KEYWORDS)) {
    if (lower.includes(keyword)) return type;
  }
  return 'lecture';
}

function extractExamDate(text: string): string | undefined {
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    return `${dateMatch[3]}-${month}-${day}`;
  }
  // Try YYYY-MM-DD
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  return undefined;
}

function extractCourseName(cols: string[], courseCode: string): string {
  // Look for the column after the course code that's long enough to be a name
  let foundCode = false;
  for (const col of cols) {
    const codeMatch = col.match(/(?<![A-Z])([A-Z]{2,4})\s*(\d{2,4})\b/);
    if (codeMatch && `${codeMatch[1]}${codeMatch[2]}`.toUpperCase() === courseCode.toUpperCase()) {
      foundCode = true;
      // If the column has more text after the code, that's the name
      const remaining = col
        .replace(codeMatch[0], '')
        .replace(/\/\s*[A-Z]{2,4}\s*\d{2,4}.*$/i, '')
        .replace(/^\s*[A-Z]?\s*/, '')
        .trim();
      if (remaining.length > 3) return remaining;
      continue;
    }
    if (foundCode && col.length > 3 && !/^\d/.test(col) && !col.match(/^\d{1,2}:\d{2}/)) {
      return col.trim();
    }
  }
  return courseCode;
}
