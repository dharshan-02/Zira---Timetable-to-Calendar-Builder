// ─── /api/extract — Parse and extract events from timetable content ───
import { NextRequest, NextResponse } from 'next/server';
import { parseTextContent, parseMockTimetable, parseOCRContent } from '@/lib/parser';
import { extractEvents } from '@/lib/extractor';
import { detectClashes } from '@/lib/clashDetector';
import { getRun, updateRunStatus, updateRunEvents, updateRunAgentTrace } from '@/lib/store';
import { getScenarioFixture } from '@/lib/scenarios';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { runId, content, sourceFile, method, scenarioId } = body;

    if (!runId) {
      return NextResponse.json({ error: 'Missing runId' }, { status: 400 });
    }

    const run = getRun(runId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // If it's a scenario, use the fixture content
    let timetableContent = content;
    if (scenarioId && !content) {
      timetableContent = getScenarioFixture(scenarioId);
    }

    if (!timetableContent) {
      return NextResponse.json({ error: 'No timetable content provided' }, { status: 400 });
    }

    updateRunStatus(runId, 'extracting');

    // Parse based on method
    const fileName = sourceFile || run.input.sourceRef || 'input.txt';
    let parseResult;
    switch (method || 'text') {
      case 'ocr':
        parseResult = parseOCRContent(timetableContent, fileName);
        break;
      case 'mock':
        parseResult = parseMockTimetable(timetableContent, fileName);
        break;
      default:
        parseResult = parseTextContent(timetableContent, fileName);
    }
    if (run.input.sourceType === 'pdf') parseResult.method = 'pdf-text';

    // Extract events
    const extractionResult = extractEvents(
      parseResult,
      run.input.electives,
    );

    // Detect clashes
    const clashResult = detectClashes(extractionResult.events);

    // Update run
    updateRunEvents(
      runId,
      extractionResult.events,
      clashResult.clashes,
      extractionResult.unparsedRows
    );
    updateRunStatus(runId, 'reviewing');

    const uncertainCount = extractionResult.events.filter((event) => event.needsReview || event.confidence === 'low' || event.confidence === 'unreadable').length;
    const agentTrace = [
      { step: 'Plan extraction', status: 'complete' as const, tool: 'parser-selector', detail: `Selected ${parseResult.method} parsing for ${run.input.sourceType} input.` },
      { step: 'Extract timetable rows', status: extractionResult.unparsedRows.length || uncertainCount ? 'review' as const : 'complete' as const, tool: 'timetable-parser', detail: `${extractionResult.successfulExtractions} events extracted from ${parseResult.totalRawRows} rows; ${extractionResult.unparsedRows.length} rows unparsed; ${uncertainCount} events need review.` },
      { step: 'Check clashes', status: clashResult.clashes.length ? 'review' as const : 'complete' as const, tool: 'interval-clash-audit', detail: `${clashResult.clashes.length} overlap(s) found across ${clashResult.totalComparisons} comparisons. Conflicting events remain in the result.` },
      { step: 'Prepare calendar change', status: 'waiting' as const, tool: 'proposal-builder', detail: 'A change preview is ready. Waiting for a person to inspect and approve before calendar writes.' },
    ];
    updateRunAgentTrace(runId, agentTrace);

    return NextResponse.json({
      events: extractionResult.events,
      clashes: clashResult.clashes,
      unparsedRows: extractionResult.unparsedRows,
      evidence: extractionResult.evidence,
      clashEvidence: clashResult.evidence,
      parseMethod: parseResult.method,
      totalRows: parseResult.totalRawRows,
      successfulExtractions: extractionResult.successfulExtractions,
      totalComparisons: clashResult.totalComparisons,
      agentTrace,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Extraction failed: ${error}` },
      { status: 500 }
    );
  }
}
