// ─── /api/propose — Create a proposal for calendar changes ─────────────
import { NextRequest, NextResponse } from 'next/server';
import { getRun, createProposal, updateRunStatus } from '@/lib/store';
import { diffEvents } from '@/lib/calendarAdapter';
import { generateProposalId } from '@/lib/ids';
import { type Proposal } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { runId } = body;

    if (!runId) {
      return NextResponse.json({ error: 'Missing runId' }, { status: 400 });
    }

    const run = getRun(runId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    if (run.extractedEvents.length === 0) {
      return NextResponse.json({ error: 'No extracted events to propose' }, { status: 400 });
    }

    updateRunStatus(runId, 'approving');

    // Diff against existing calendar to detect new/updated/unchanged
    const diff = diffEvents(run.extractedEvents);

    const proposal: Proposal = {
      id: generateProposalId(),
      runId,
      destination: 'Mock Calendar (Local)',
      totalEvents: run.extractedEvents.length,
      newEvents: diff.newEvents,
      updatedEvents: diff.updatedEvents,
      unchangedEvents: diff.unchangedEvents,
      removedEvents: [],
      clashes: run.clashes,
      events: run.extractedEvents,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    createProposal(proposal);

    return NextResponse.json({ proposal });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to create proposal: ${error}` },
      { status: 500 }
    );
  }
}
