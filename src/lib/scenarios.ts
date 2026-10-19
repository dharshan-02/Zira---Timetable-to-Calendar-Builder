// ─── Test Scenario Fixtures ────────────────────────────────────────────
// Four mandatory demo scenarios with synthetic data.
// Each fixture contains the raw timetable content, input config,
// and expected outcomes.

import { type ScenarioDefinition, type StudentInput } from './types';

// ─── TC1: Weekly Timetable ─────────────────────────────────────────────
export const TC1_FIXTURE = `Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type
CS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
CS101 | Introduction to Programming | Wednesday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
CS101 | Introduction to Programming | Friday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
MATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
MATH201 | Linear Algebra | Wednesday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
MATH201 | Linear Algebra | Thursday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
PHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab
ENG101 | English Communication | Tuesday | 09:00 | 10:00 | LH-102 | Ms. Nair | Lecture
ENG101 | English Communication | Thursday | 09:00 | 10:00 | LH-102 | Ms. Nair | Lecture
CS101 | Programming Lab | Thursday | 14:00 | 16:00 | Lab-C05 | Dr. Sharma | Lab`;

export const TC1_INPUT: StudentInput = {
  id: 'input-tc1',
  section: 'A',
  electives: [],
  sourceType: 'mock',
  sourceRef: 'tc1-weekly-timetable.txt',
  uploadedAt: new Date().toISOString(),
};

// ─── TC2: Elective Clashes with Core Lab ───────────────────────────────
export const TC2_FIXTURE = `Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type
CS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
CS101 | Introduction to Programming | Wednesday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
MATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
MATH201 | Linear Algebra | Wednesday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
PHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab
EC201 | Digital Electronics | Tuesday | 14:30 | 16:00 | LH-404 | Prof. Iyer | Lecture
CS201 | Data Structures | Thursday | 09:00 | 10:00 | LH-301 | Dr. Kumar | Lecture
CS201 | Data Structures Lab | Thursday | 14:00 | 16:00 | Lab-C05 | Dr. Kumar | Lab
ME101 | Workshop Practice | Thursday | 15:00 | 17:00 | Workshop-B | Mr. Singh | Lab`;

export const TC2_INPUT: StudentInput = {
  id: 'input-tc2',
  section: 'A',
  electives: ['EC201', 'ME101'],
  sourceType: 'mock',
  sourceRef: 'tc2-elective-clash.txt',
  uploadedAt: new Date().toISOString(),
};

// ─── TC3: Rerun After Timetable Revision ───────────────────────────────
export const TC3_FIXTURE_ORIGINAL = `Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type
CS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
CS101 | Introduction to Programming | Wednesday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
MATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
MATH201 | Linear Algebra | Wednesday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
PHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab`;

export const TC3_FIXTURE_REVISED = `Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type
CS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
CS101 | Introduction to Programming | Wednesday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
MATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-210 | Prof. Gupta | Lecture
MATH201 | Linear Algebra | Wednesday | 11:00 | 12:00 | LH-210 | Prof. Gupta | Lecture
PHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab`;

export const TC3_INPUT: StudentInput = {
  id: 'input-tc3',
  section: 'A',
  electives: [],
  sourceType: 'mock',
  sourceRef: 'tc3-revision.txt',
  uploadedAt: new Date().toISOString(),
};

// ─── TC4: Unreadable Scanned Row ───────────────────────────────────────
export const TC4_FIXTURE = `Course Code | Course Name | Day | Start Time | End Time | Room | Instructor | Type
CS101 | Introduction to Programming | Monday | 09:00 | 10:00 | LH-301 | Dr. Sharma | Lecture
MATH201 | Linear Algebra | Monday | 10:00 | 11:00 | LH-205 | Prof. Gupta | Lecture
#@$%&* | ~~garbl3d t3xt~~ | M0nd@y | ??:?? | ??:?? | ??? | ??? | ???
PHY102 | Physics Lab | Tuesday | 14:00 | 16:00 | Lab-A12 | Dr. Reddy | Lab
|||partially visible text with smudges|||
ENG101 | English Communication | Tuesday | 09:00 | 10:00 | LH-102 | Ms. Nair | Lecture`;

// Supplemental demonstration: one genuine same-day exam clash and one control
// exam on a different date to guard against false positives across dates.
export const EXAM_FIXTURE = `Course Code | Course Name | Exam Date | Start Time | End Time | Room | Instructor | Type
CS101 | Introduction to Programming | 10/12/2026 | 09:00 | 11:00 | Hall-A | Dr. Sharma | Exam
MATH201 | Linear Algebra | 10/12/2026 | 10:30 | 12:00 | Hall-B | Prof. Gupta | Exam
PHY102 | Physics | 11/12/2026 | 09:00 | 11:00 | Hall-C | Dr. Reddy | Exam`;

export const TC4_INPUT: StudentInput = {
  id: 'input-tc4',
  section: 'A',
  electives: [],
  sourceType: 'mock',
  sourceRef: 'tc4-scanned-ocr.txt',
  uploadedAt: new Date().toISOString(),
};

// ─── All Scenarios ─────────────────────────────────────────────────────
export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'TC1',
    name: 'TC1 — Weekly Timetable',
    description: 'Parse a complete weekly timetable and create recurring calendar events with correct rooms.',
    expectedResult: 'All 10 rows parsed into recurring events. Each event has correct room assignment. No clashes expected.',
    input: TC1_INPUT,
    fixtureFile: 'tc1-weekly-timetable.txt',
  },
  {
    id: 'TC2',
    name: 'TC2 — Elective Clashes with Core Lab',
    description: 'Detect time clashes between elective courses and core lab sessions.',
    expectedResult: 'Clashes detected: EC201 (Tue 14:30-16:00) overlaps PHY102 Lab (Tue 14:00-16:00). ME101 (Thu 15:00-17:00) overlaps CS201 Lab (Thu 14:00-16:00). Neither conflicting event is silently dropped.',
    input: TC2_INPUT,
    fixtureFile: 'tc2-elective-clash.txt',
  },
  {
    id: 'TC3',
    name: 'TC3 — Rerun After Timetable Revision',
    description: 'After a timetable revision, only update changed events. Leave unchanged events untouched.',
    expectedResult: 'MATH201 Wednesday: time changed (10:00→11:00), room changed (LH-205→LH-210). MATH201 Monday: room changed (LH-205→LH-210). Other events unchanged — not duplicated or rewritten.',
    input: TC3_INPUT,
    fixtureFile: 'tc3-revision.txt',
  },
  {
    id: 'TC4',
    name: 'TC4 — Unreadable Scanned Row',
    description: 'Handle a scanned timetable with an unreadable/garbled row.',
    expectedResult: 'Garbled row (row 4) and partially visible row (row 6) listed as unparsed with source location and reason. Other readable rows extracted successfully.',
    input: TC4_INPUT,
    fixtureFile: 'tc4-scanned-ocr.txt',
  },
];

export function getScenarioFixture(scenarioId: string): string {
  switch (scenarioId) {
    case 'TC1': return TC1_FIXTURE;
    case 'TC2': return TC2_FIXTURE;
    case 'TC3': return TC3_FIXTURE_ORIGINAL;
    case 'TC4': return TC4_FIXTURE;
    default: return '';
  }
}

export function getTC3RevisedFixture(): string {
  return TC3_FIXTURE_REVISED;
}
