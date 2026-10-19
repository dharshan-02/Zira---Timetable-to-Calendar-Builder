// ─── /api/scenarios — Run test scenarios TC1-TC4 ──────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { SCENARIOS, getScenarioFixture, TC3_FIXTURE_ORIGINAL, TC3_FIXTURE_REVISED } from '@/lib/scenarios';
import { parseTextContent, parseOCRContent } from '@/lib/parser';
import { extractEvents } from '@/lib/extractor';
import { detectClashes } from '@/lib/clashDetector';
import { diffEvents } from '@/lib/calendarAdapter';
import { createRun, updateRunEvents, updateRunStatus, saveScenarioResult, getAllScenarioResults } from '@/lib/store';
import { generateRunId, simpleHash } from '@/lib/ids';
import type { Run, ScenarioResult } from '@/lib/types';

export async function GET() {
  return NextResponse.json({
    scenarios: SCENARIOS,
    results: getAllScenarioResults(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scenarioId } = body;

    if (!scenarioId) {
      return NextResponse.json({ error: 'Missing scenarioId' }, { status: 400 });
    }

    const scenario = SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    let result: ScenarioResult;

    switch (scenarioId) {
      case 'TC1':
        result = await runTC1(scenario);
        break;
      case 'TC2':
        result = await runTC2(scenario);
        break;
      case 'TC3':
        result = await runTC3(scenario);
        break;
      case 'TC4':
        result = await runTC4(scenario);
        break;
      default:
        return NextResponse.json({ error: 'Unknown scenario' }, { status: 400 });
    }

    saveScenarioResult(result);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: `Scenario failed: ${error}` },
      { status: 500 }
    );
  }
}

// ─── TC1: Weekly Timetable ─────────────────────────────────────────────
async function runTC1(scenario: typeof SCENARIOS[0]): Promise<ScenarioResult> {
  const content = getScenarioFixture('TC1');
  const run = createTestRun(scenario);

  const parseResult = parseTextContent(content, scenario.fixtureFile);
  const extraction = extractEvents(parseResult, []);
  const clashes = detectClashes(extraction.events);

  updateRunEvents(run.id, extraction.events, clashes.clashes, extraction.unparsedRows);
  updateRunStatus(run.id, 'reviewing');

  const allRoomsCorrect = extraction.events.every(e => e.room && e.room !== 'TBA');
  const hasRecurrence = extraction.events.every(e => e.recurrenceStart && e.recurrenceEnd);
  // Isolated simulated destination: expand each recurring event into four weekly
  // occurrences without writing to the shared demo calendar.
  const simulatedCalendar = extraction.events.flatMap((event) => Array.from({ length: 4 }, (_, week) => ({
    sourceEventId: event.id,
    code: event.courseCode,
    room: event.room,
    weekday: event.weekday,
    startTime: event.startTime,
    endTime: event.endTime,
    occurrence: week + 1,
  })));
  const simulationVerified = simulatedCalendar.length === extraction.events.length * 4 && simulatedCalendar.every((slot) => slot.room && slot.room !== 'TBA' && slot.startTime < slot.endTime);

  const actual = [
    `Parsed ${extraction.successfulExtractions} events from ${parseResult.totalRawRows} rows.`,
    `Unparsed rows: ${extraction.unparsedRows.length}.`,
    `Clashes detected: ${clashes.clashes.length}.`,
    `All rooms assigned: ${allRoomsCorrect ? 'Yes' : 'No'}.`,
    `Recurrence set: ${hasRecurrence ? 'Yes' : 'No'}.`,
    `Isolated calendar simulation: ${simulatedCalendar.length} weekly occurrences checked; shared calendar unchanged.`,
    'Real calendar changes: none; the live workflow waits for explicit human approval.',
    `Rooms: ${extraction.events.map(e => `${e.courseCode}→${e.room}`).join(', ')}.`,
  ].join('\n');

  const passed = extraction.successfulExtractions >= 8 && clashes.clashes.length === 0 && 
                 allRoomsCorrect && hasRecurrence && simulationVerified;

  return {
    scenarioId: 'TC1',
    runId: run.id,
    expected: scenario.expectedResult,
    input: content,
    actual,
    passed,
    evidence: JSON.stringify({
      source: { fixture: scenario.fixtureFile, input: content },
      events: extraction.events.map(e => ({ id: e.id, code: e.courseCode, day: e.weekday, time: `${e.startTime}-${e.endTime}`, room: e.room, type: e.type })),
      clashes: clashes.clashes,
      unparsed: extraction.unparsedRows,
    }, null, 2),
    timestamp: new Date().toISOString(),
  };
}

// ─── TC2: Elective Clashes with Core Lab ───────────────────────────────
async function runTC2(scenario: typeof SCENARIOS[0]): Promise<ScenarioResult> {
  const content = getScenarioFixture('TC2');
  const run = createTestRun(scenario);

  const parseResult = parseTextContent(content, scenario.fixtureFile);
  const extraction = extractEvents(parseResult, ['EC201', 'ME101']);
  const clashes = detectClashes(extraction.events);

  updateRunEvents(run.id, extraction.events, clashes.clashes, extraction.unparsedRows);
  updateRunStatus(run.id, 'reviewing');

  // Check that clashing events are NOT dropped
  const allEventIds = extraction.events.map(e => e.id);
  const clashEventIds = new Set(clashes.clashes.flatMap(c => [c.eventA, c.eventB]));
  const allClashEventsPreserved = Array.from(clashEventIds).every(id => allEventIds.includes(id));

  const hasEC201Clash = clashes.clashes.some(c =>
    (c.eventALabel.includes('EC201') || c.eventBLabel.includes('EC201')) &&
    (c.eventALabel.includes('PHY102') || c.eventBLabel.includes('PHY102'))
  );
  const hasME101Clash = clashes.clashes.some(c =>
    (c.eventALabel.includes('ME101') || c.eventBLabel.includes('ME101')) &&
    (c.eventALabel.includes('CS201') || c.eventBLabel.includes('CS201'))
  );

  const actual = [
    `Parsed ${extraction.successfulExtractions} events.`,
    `Clashes detected: ${clashes.clashes.length}.`,
    `EC201 vs PHY102 clash: ${hasEC201Clash ? 'DETECTED' : 'NOT DETECTED'}.`,
    `ME101 vs CS201 Lab clash: ${hasME101Clash ? 'DETECTED' : 'NOT DETECTED'}.`,
    `All clash events preserved (not dropped): ${allClashEventsPreserved ? 'Yes' : 'No'}.`,
    `Clash details:`,
    ...clashes.clashes.map(c => `  • ${c.eventALabel} vs ${c.eventBLabel} on ${c.day} (${c.overlapStart}-${c.overlapEnd})`),
  ].join('\n');

  const passed = hasEC201Clash && hasME101Clash && allClashEventsPreserved;

  return {
    scenarioId: 'TC2',
    runId: run.id,
    expected: scenario.expectedResult,
    input: content,
    actual,
    passed,
    evidence: JSON.stringify({
      source: { fixture: scenario.fixtureFile, input: content },
      clashes: clashes.clashes,
      events: extraction.events.map(e => ({ id: e.id, code: e.courseCode, day: e.weekday, time: `${e.startTime}-${e.endTime}`, type: e.type, isElective: e.isElective })),
      preservedClashEvents: Array.from(clashEventIds),
    }, null, 2),
    timestamp: new Date().toISOString(),
  };
}

// ─── TC3: Rerun After Revision ─────────────────────────────────────────
async function runTC3(scenario: typeof SCENARIOS[0]): Promise<ScenarioResult> {
  // Step 1: Run original timetable
  const originalContent = TC3_FIXTURE_ORIGINAL;
  const run = createTestRun(scenario);

  const parse1 = parseTextContent(originalContent, 'tc3-original.txt');
  const extract1 = extractEvents(parse1, []);

  // Step 2: Run revised timetable
  const revisedContent = TC3_FIXTURE_REVISED;
  const parse2 = parseTextContent(revisedContent, 'tc3-revised.txt');
  const extract2 = extractEvents(parse2, []);

  // Step 3: Diff
  const diff = diffEvents(extract2.events, extract1.events.map((event) => ({ id: event.id, contentHash: event.contentHash })));

  // Exercise the update operation against a disposable map, never the shared calendar.
  const originalById = new Map(extract1.events.map((event) => [event.id, event]));
  const revisedById = new Map(extract2.events.map((event) => [event.id, event]));
  const isolatedCalendar = new Map(originalById);
  const updatedBefore = new Map(diff.updatedEvents.map((id) => [id, isolatedCalendar.get(id)?.contentHash]));
  for (const id of [...diff.newEvents, ...diff.updatedEvents]) {
    const revised = revisedById.get(id);
    if (revised) isolatedCalendar.set(id, revised);
  }
  const onlyChangedWereWritten = diff.updatedEvents.every((id) => updatedBefore.get(id) !== isolatedCalendar.get(id)?.contentHash) &&
    diff.unchangedEvents.every((id) => originalById.get(id)?.contentHash === isolatedCalendar.get(id)?.contentHash) &&
    isolatedCalendar.size === extract2.events.length;

  updateRunEvents(run.id, extract2.events, [], []);
  updateRunStatus(run.id, 'reviewing');

  const actual = [
    `Original: ${extract1.events.length} events.`,
    `Revised: ${extract2.events.length} events.`,
    `New events: ${diff.newEvents.length} (${diff.newEvents.join(', ') || 'none'}).`,
    `Updated events: ${diff.updatedEvents.length} (${diff.updatedEvents.join(', ') || 'none'}).`,
    `Unchanged events: ${diff.unchangedEvents.length} (${diff.unchangedEvents.join(', ') || 'none'}).`,
    `Isolated simulated calendar: wrote ${diff.updatedEvents.length} changed event(s); unchanged entries retained their original hashes.`,
    `Revised snapshot equals expected target: ${onlyChangedWereWritten ? 'Yes' : 'No'}. Shared calendar unchanged; real changes still require human approval.`,
    `Updated details:`,
    ...diff.updatedEvents.map(id => {
      const orig = extract1.events.find(e => e.id === id);
      const rev = extract2.events.find(e => e.id === id);
      return `  • ${id}: ${orig?.courseCode} — hash ${orig?.contentHash} → ${rev?.contentHash}`;
    }),
  ].join('\n');

  const passed = diff.unchangedEvents.length > 0 && 
                 diff.updatedEvents.length > 0 && 
                 diff.newEvents.length === 0 && onlyChangedWereWritten;

  return {
    scenarioId: 'TC3',
    runId: run.id,
    expected: scenario.expectedResult,
    input: `ORIGINAL TIMETABLE\n${originalContent}\n\nREVISED TIMETABLE\n${revisedContent}`,
    actual,
    passed,
    evidence: JSON.stringify({
      source: { originalFixture: 'tc3-original.txt', revisedFixture: 'tc3-revised.txt', originalInput: originalContent, revisedInput: revisedContent },
      diff,
      isolatedCalendarWrites: diff.updatedEvents,
      onlyChangedWereWritten,
      isolatedFinalCalendar: Array.from(isolatedCalendar.values()).map((event) => ({ id: event.id, code: event.courseCode, hash: event.contentHash, room: event.room, day: event.weekday, time: `${event.startTime}-${event.endTime}` })),
      originalEvents: extract1.events.map(e => ({ id: e.id, code: e.courseCode, hash: e.contentHash, room: e.room, time: `${e.startTime}-${e.endTime}` })),
      revisedEvents: extract2.events.map(e => ({ id: e.id, code: e.courseCode, hash: e.contentHash, room: e.room, time: `${e.startTime}-${e.endTime}` })),
    }, null, 2),
    timestamp: new Date().toISOString(),
  };
}

// ─── TC4: Unreadable Scanned Row ───────────────────────────────────────
async function runTC4(scenario: typeof SCENARIOS[0]): Promise<ScenarioResult> {
  const content = getScenarioFixture('TC4');
  const run = createTestRun(scenario);

  // Use OCR parser to simulate scanned document
  const parseResult = parseOCRContent(content, scenario.fixtureFile);
  const extraction = extractEvents(parseResult, []);

  updateRunEvents(run.id, extraction.events, [], extraction.unparsedRows);
  updateRunStatus(run.id, 'reviewing');

  const hasUnparsedRows = extraction.unparsedRows.length > 0;
  const unparsedHaveReasons = extraction.unparsedRows.every(r => r.reason && r.reason.length > 0);
  const unparsedHaveSource = extraction.unparsedRows.every(r => r.sourceFile && r.rowNumber > 0);
  const readableRowsParsed = extraction.events.length >= 3;

  const actual = [
    `Total rows in input: ${parseResult.totalRawRows}.`,
    `Successfully extracted: ${extraction.successfulExtractions} events.`,
    `Unparsed rows: ${extraction.unparsedRows.length}.`,
    `Each unparsed row has a reason: ${unparsedHaveReasons ? 'Yes' : 'No'}.`,
    `Each unparsed row has source location: ${unparsedHaveSource ? 'Yes' : 'No'}.`,
    `Unparsed row details:`,
    ...extraction.unparsedRows.map(r => `  • Row ${r.rowNumber}: "${r.rawContent.slice(0, 60)}..." — Reason: ${r.reason}`),
  ].join('\n');

  const passed = hasUnparsedRows && unparsedHaveReasons && unparsedHaveSource && readableRowsParsed;

  return {
    scenarioId: 'TC4',
    runId: run.id,
    expected: scenario.expectedResult,
    input: content,
    actual,
    passed,
    evidence: JSON.stringify({
      source: { fixture: scenario.fixtureFile, input: content },
      unparsedRows: extraction.unparsedRows,
      parsedEvents: extraction.events.map(e => ({ id: e.id, code: e.courseCode, day: e.weekday, confidence: e.confidence })),
      parseMethod: parseResult.method,
      note: 'Synthetic OCR-like text fixture; no image OCR engine was run.',
    }, null, 2),
    timestamp: new Date().toISOString(),
  };
}

function createTestRun(scenario: typeof SCENARIOS[0]): Run {
  const run: Run = {
    id: generateRunId(),
    scenarioId: scenario.id,
    input: { ...scenario.input, uploadedAt: new Date().toISOString() },
    status: 'collecting',
    extractedEvents: [],
    clashes: [],
    unparsedRows: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inputHash: simpleHash(JSON.stringify(scenario.input)),
  };
  return createRun(run);
}
