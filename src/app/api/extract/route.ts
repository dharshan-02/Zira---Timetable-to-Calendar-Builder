// ─── /api/extract — Parse and extract events from timetable content ───
import { NextRequest, NextResponse } from 'next/server';
import { parseTextContent, parseMockTimetable, parseOCRContent } from '@/lib/parser';
import { extractEvents } from '@/lib/extractor';
import { detectClashes } from '@/lib/clashDetector';
import { getRun, updateRunStatus, updateRunEvents } from '@/lib/store';
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
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Extraction failed: ${error}` },
      { status: 500 }
    );
  }
}
