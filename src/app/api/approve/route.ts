// ─── /api/approve — Approve a proposal and execute calendar writes ────
import { NextRequest, NextResponse } from 'next/server';
import { getProposal, approveProposal, updateRunStatus, updateRunVerification } from '@/lib/store';
import { writeEvents, generateICS } from '@/lib/calendarAdapter';
import { verifyEvents } from '@/lib/verifier';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { proposalId } = body;

    if (!proposalId) {
      return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 });
    }

    const proposal = getProposal(proposalId);
    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (proposal.status === 'approved') {
      return NextResponse.json({ error: 'Proposal already approved' }, { status: 400 });
    }

    // Step 1: Approve
    approveProposal(proposalId);
    updateRunStatus(proposal.runId, 'executing');

    // Step 2: Write events to mock calendar (idempotent via stable IDs)
    const writtenEvents = writeEvents(proposal.events);

    // Step 3: Verify by reading back independently
    updateRunStatus(proposal.runId, 'verifying');
    const verification = verifyEvents(proposal.events, proposal.runId);

    // Step 4: Generate ICS
    const icsContent = generateICS(writtenEvents);

    // Step 5: Update run with verification
    updateRunVerification(proposal.runId, verification);

    const allVerified = verification.verified === verification.totalEvents;
    updateRunStatus(proposal.runId, allVerified ? 'completed' : 'failed');

    return NextResponse.json({
      status: allVerified ? 'completed' : 'partially_failed',
      writtenCount: writtenEvents.length,
      verification,
      icsContent,
      proposal: getProposal(proposalId),
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Approval/execution failed: ${error}` },
      { status: 500 }
    );
  }
}
