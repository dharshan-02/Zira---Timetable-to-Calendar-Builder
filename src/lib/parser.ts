// ─── Timetable Parser ──────────────────────────────────────────────────
// Parses raw text/PDF content into structured rows.
// Keeps parsing separate from extraction so verification doesn't
// repeat extraction assumptions.

import { type UnparsedRow } from './types';

export interface ParsedRow {
  rowNumber: number;
  rawContent: string;
  columns: string[];
  sourceFile: string;
  sourceExcerpt: string;
  isHeader: boolean;
  confidence: 'high' | 'medium' | 'low' | 'unreadable';
  parseNotes: string[];
}

export interface ParseResult {
  rows: ParsedRow[];
  unparsedRows: UnparsedRow[];
  sourceFile: string;
  parsedAt: string;
  totalRawRows: number;
  method: 'text' | 'pdf-text' | 'ocr' | 'mock';
}

// Time pattern: HH:MM or H:MM, with optional AM/PM
const TIME_PATTERN = /\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/;

// Day pattern
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
              'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_PATTERN = new RegExp(`\\b(${DAYS.join('|')})\\b`, 'i');

// Course code pattern: 2-4 uppercase letters followed by digits (e.g. CS101, MATH201)
const COURSE_CODE_PATTERN = /\b[A-Z]{2,4}\d{2,4}\b/;

/**
 * Parse text content (from PDF extraction or direct input) into structured rows.
 */
export function parseTextContent(content: string, sourceFile: string): ParseResult {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rows: ParsedRow[] = [];
  const unparsedRows: UnparsedRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rowNumber = i + 1;

    // Skip obviously empty or separator lines
    if (line.match(/^[-=_\s]+$/) || line.length < 3) continue;

    // Check if this looks like a header
    const isHeader = detectHeader(line);
    if (isHeader) {
      rows.push({
        rowNumber,
        rawContent: line,
        columns: splitColumns(line),
        sourceFile,
        sourceExcerpt: line,
        isHeader: true,
        confidence: 'high',
        parseNotes: ['Detected as header row'],
      });
      continue;
    }

    // Try to parse as a timetable row
    const columns = splitColumns(line);
    const hasTime = TIME_PATTERN.test(line);
    const hasDay = DAY_PATTERN.test(line);
    const hasCourseCode = COURSE_CODE_PATTERN.test(line);

    let confidence: 'high' | 'medium' | 'low' | 'unreadable' = 'unreadable';
    const parseNotes: string[] = [];

    if (hasCourseCode && hasDay && hasTime) {
      confidence = 'high';
      parseNotes.push('Contains course code, day, and time');
    } else if ((hasCourseCode || hasDay) && hasTime) {
      confidence = 'medium';
      if (!hasCourseCode) parseNotes.push('Missing course code');
      if (!hasDay) parseNotes.push('Missing day');
    } else if (hasCourseCode || hasTime) {
      confidence = 'low';
      parseNotes.push('Partial match — may be continuation or fragment');
    } else {
      // Truly unreadable
      unparsedRows.push({
        rowNumber,
        rawContent: line,
        sourceFile,
        reason: detectUnparsedReason(line),
        sourceExcerpt: line,
      });
      continue;
    }

    rows.push({
      rowNumber,
      rawContent: line,
      columns,
      sourceFile,
      sourceExcerpt: line.slice(0, 200),
      isHeader: false,
      confidence,
      parseNotes,
    });
  }

  return {
    rows,
    unparsedRows,
    sourceFile,
    parsedAt: new Date().toISOString(),
    totalRawRows: lines.length,
    method: 'text',
  };
}

/**
 * Parse mock/fixture timetable (tab or pipe-delimited).
 */
export function parseMockTimetable(content: string, sourceFile: string): ParseResult {
  const result = parseTextContent(content, sourceFile);
  result.method = 'mock';
  return result;
}

/**
 * Simulate OCR result with intentional degradation for TC4.
 */
export function parseOCRContent(content: string, sourceFile: string): ParseResult {
  const result = parseTextContent(content, sourceFile);
  result.method = 'ocr';

  // Mark any rows already flagged as low confidence as unreadable for OCR
  for (const row of result.rows) {
    if (row.confidence === 'low') {
      row.confidence = 'unreadable';
      row.parseNotes.push('OCR confidence too low for reliable extraction');
    }
  }

  return result;
}

function splitColumns(line: string): string[] {
  // Try pipe-delimited first
  if (line.includes('|')) {
    return line.split('|').map(c => c.trim()).filter(c => c.length > 0);
  }
  // Try tab-delimited
  if (line.includes('\t')) {
    return line.split('\t').map(c => c.trim()).filter(c => c.length > 0);
  }
  // Fall back to multi-space splitting
  return line.split(/\s{2,}/).map(c => c.trim()).filter(c => c.length > 0);
}

function detectHeader(line: string): boolean {
  const headerTerms = ['course', 'code', 'subject', 'day', 'time', 'room', 'instructor',
                        'slot', 'faculty', 'venue', 'period', 'section'];
  const lower = line.toLowerCase();
  const matches = headerTerms.filter(t => lower.includes(t));
  return matches.length >= 2;
}

function detectUnparsedReason(line: string): string {
  if (line.length < 5) return 'Row too short to contain timetable data';
  if (/^[^a-zA-Z0-9]*$/.test(line)) return 'Row contains no alphanumeric characters';
  if (/[^\x20-\x7E]/.test(line) && line.length < 20) return 'Row contains garbled/non-ASCII characters (possible OCR artifact)';
  if (/[?#@$%&*]{3,}/.test(line)) return 'Row contains garbled characters — likely OCR scan artifact';
  return 'Row does not match expected timetable format (no course code, day, or time found)';
}
