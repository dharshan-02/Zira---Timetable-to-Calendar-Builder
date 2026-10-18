// ─── Stable IDs & Hashing ──────────────────────────────────────────────
export type StableEventId = string; // deterministic from source + course + day + time

// ─── Input Types ───────────────────────────────────────────────────────
export interface StudentInput {
  id: string;
  section: string;
  electives: string[];
  sourceType: 'url' | 'pdf' | 'mock';
  sourceRef: string; // URL or filename
  uploadedAt: string; // ISO timestamp
}

// ─── Extracted Event ───────────────────────────────────────────────────
export type EventType = 'lecture' | 'lab' | 'tutorial' | 'exam' | 'unknown';

export interface ExtractedEvent {
  id: StableEventId;
  course: string;
  courseCode: string;
  type: EventType;
  weekday: string; // 'Monday', 'Tuesday', etc.
  startTime: string; // 'HH:mm'
  endTime: string; // 'HH:mm'
  room: string;
  instructor: string;
  isElective: boolean;
  // Recurrence
  recurrenceStart: string; // ISO date
  recurrenceEnd: string; // ISO date
  // Exam-specific
  examDate?: string; // ISO date for one-off exams
  // Source evidence
  sourceRow: number;
  sourceExcerpt: string;
  sourceFile: string;
  // Confidence
  confidence: 'high' | 'medium' | 'low' | 'unreadable';
  uncertainFields: string[];
  needsReview: boolean;
  // Versioning
  contentHash: string;
}

// ─── Clash ─────────────────────────────────────────────────────────────
export interface Clash {
  id: string;
  eventA: StableEventId;
  eventB: StableEventId;
  eventALabel: string;
  eventBLabel: string;
  day: string;
  overlapStart: string;
  overlapEnd: string;
  reason: string;
  evidence: string;
}

// ─── Calendar Event (written to mock calendar) ─────────────────────────
export interface CalendarEvent {
  id: StableEventId;
  title: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string;
  instructor: string;
  recurrenceStart: string;
  recurrenceEnd: string;
  examDate?: string;
  type: EventType;
  isElective: boolean;
  sourceEventId: StableEventId;
  createdAt: string;
  updatedAt: string;
  contentHash: string;
}

// ─── Proposal ──────────────────────────────────────────────────────────
export interface Proposal {
  id: string;
  runId: string;
  destination: string;
  totalEvents: number;
  newEvents: StableEventId[];
  updatedEvents: StableEventId[];
  unchangedEvents: StableEventId[];
  removedEvents: StableEventId[];
  clashes: Clash[];
  events: ExtractedEvent[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
}

// ─── Verification ──────────────────────────────────────────────────────
export type VerificationStatus = 'verified' | 'mismatched' | 'pending' | 'failed';

export interface VerificationResult {
  eventId: StableEventId;
  status: VerificationStatus;
  expected: Partial<CalendarEvent>;
  actual: Partial<CalendarEvent> | null;
  differences: string[];
}

export interface VerificationReport {
  runId: string;
  totalEvents: number;
  verified: number;
  mismatched: number;
  pending: number;
  failed: number;
  results: VerificationResult[];
  timestamp: string;
}

// ─── Run History ───────────────────────────────────────────────────────
export type RunStatus = 'collecting' | 'extracting' | 'reviewing' | 'approving' | 'executing' | 'verifying' | 'completed' | 'failed';

export interface Run {
  id: string;
  scenarioId?: string;
  input: StudentInput;
  status: RunStatus;
  extractedEvents: ExtractedEvent[];
  clashes: Clash[];
  unparsedRows: UnparsedRow[];
  proposalId?: string;
  verificationReport?: VerificationReport;
  createdAt: string;
  updatedAt: string;
  inputHash: string;
}

// ─── Unparsed Rows ─────────────────────────────────────────────────────
export interface UnparsedRow {
  rowNumber: number;
  rawContent: string;
  sourceFile: string;
  reason: string;
  sourceExcerpt: string;
}

// ─── Scenario ──────────────────────────────────────────────────────────
export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  expectedResult: string;
  input: StudentInput;
  fixtureFile: string;
}

export interface ScenarioResult {
  scenarioId: string;
  runId: string;
  expected: string;
  actual: string;
  passed: boolean;
  evidence: string;
  timestamp: string;
}
