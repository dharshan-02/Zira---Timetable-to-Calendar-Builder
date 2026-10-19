// ─── /api/run — Create and manage pipeline runs ───────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { type Run, type SourceEvidence, type StudentInput } from '@/lib/types';
import { generateRunId } from '@/lib/ids';
import { simpleHash } from '@/lib/ids';
import { createRun, getAllRuns, getProposal, getRun } from '@/lib/store';

const MAX_SNAPSHOT_CHARS = 250_000;

export async function POST(req: NextRequest) {
  try {
    let parsedBody: unknown;
    try {
      parsedBody = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must contain valid JSON.' }, { status: 400 });
    }
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return NextResponse.json({ error: 'Provide a schedule review request.' }, { status: 400 });
    }
    const body = parsedBody as Record<string, unknown>;

    const section = typeof body.section === 'string' ? body.section.trim() : '';
    const sourceType = typeof body.sourceType === 'string' ? body.sourceType : '';
    const sourceRef = typeof body.sourceRef === 'string' ? body.sourceRef.trim() : '';
    const scenarioId = typeof body.scenarioId === 'string' ? body.scenarioId : undefined;
    const sourceEvidence = body.sourceEvidence;
    const electives = body.electives ?? [];
    const sourceSnapshot = body.sourceSnapshot;

    if (!section || section.length > 80) {
      return NextResponse.json({ error: 'Enter a cohort or section (80 characters or fewer).' }, { status: 400 });
    }
    if (!['url', 'pdf', 'mock', 'text'].includes(sourceType)) {
      return NextResponse.json({ error: 'Choose a supported timetable source format.' }, { status: 400 });
    }
    if (!Array.isArray(electives) || electives.some((item: unknown) => typeof item !== 'string')) {
      return NextResponse.json({ error: 'Electives must be provided as a list of course codes.' }, { status: 400 });
    }
    if (sourceRef.length > 2048) {
      return NextResponse.json({ error: 'The source reference is too long.' }, { status: 400 });
    }
    if (sourceEvidence !== undefined && !isSourceEvidence(sourceEvidence)) {
      return NextResponse.json({ error: 'The source evidence fields are invalid.' }, { status: 400 });
    }
    if (sourceSnapshot !== undefined && typeof sourceSnapshot !== 'string') {
      return NextResponse.json({ error: 'The source snapshot must be text.' }, { status: 400 });
    }

    const input: StudentInput = {
      id: `input-${Date.now()}`,
      section,
      electives: electives.map((item: string) => item.trim()).filter(Boolean),
      sourceType: sourceType as StudentInput['sourceType'],
      sourceRef: sourceRef || 'manual-input',
      uploadedAt: new Date().toISOString(),
      sourceEvidence,
    };

    const run: Run = {
      id: generateRunId(),
      scenarioId: scenarioId || undefined,
      input,
      sourceSnapshot: sourceSnapshot?.slice(0, MAX_SNAPSHOT_CHARS),
      sourceSnapshotTruncated: sourceSnapshot ? sourceSnapshot.length > MAX_SNAPSHOT_CHARS : false,
      status: 'collecting',
      extractedEvents: [],
      clashes: [],
      unparsedRows: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inputHash: simpleHash(JSON.stringify({ input, sourceSnapshot })),
    };

    createRun(run);

    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to create run: ${error}` },
      { status: 500 }
    );
  }
}

function isSourceEvidence(value: unknown): value is SourceEvidence {
  if (!value || typeof value !== 'object') return false;
  const evidence = value as Partial<SourceEvidence>;
  return (evidence.sourceUrl === null || typeof evidence.sourceUrl === 'string')
    && typeof evidence.sourceName === 'string'
    && typeof evidence.contentType === 'string'
    && typeof evidence.fetchedAt === 'string';
}

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get('id');

  if (runId) {
    const run = getRun(runId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }
    return NextResponse.json({ run, proposal: run.proposalId ? getProposal(run.proposalId) : null });
  }

  const runs = getAllRuns().map((run) => {
    const summary: Partial<Run> = { ...run };
    delete summary.sourceSnapshot;
    const sessionCount = summary.extractedEvents?.length ?? 0;
    const clashCount = summary.clashes?.length ?? 0;
    const unparsedCount = summary.unparsedRows?.length ?? 0;
    delete summary.extractedEvents;
    delete summary.clashes;
    delete summary.unparsedRows;
    return {
      ...summary,
      sessionCount,
      clashCount,
      unparsedCount,
    };
  });
  return NextResponse.json({ runs });
}
