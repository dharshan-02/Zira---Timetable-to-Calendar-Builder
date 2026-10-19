// ─── Application Store ─────────────────────────────────────────────────
// File-backed state for the single-instance demo/deployment. DATA_DIR can be
// mounted to persistent storage by the hosting platform.

import { type Run, type Proposal, type ScenarioResult, type ExtractedEvent, type Clash, type UnparsedRow, type VerificationReport, type RunStatus } from './types';
import { loadRecords, saveRecords } from './persistence';

// Global stores
const runs = new Map(loadRecords<Run>('runs.json').map((run) => [run.id, run]));
const proposals = new Map(loadRecords<Proposal>('proposals.json').map((proposal) => [proposal.id, proposal]));
const scenarioResults = new Map(loadRecords<ScenarioResult>('scenario-results.json').map((result) => [result.scenarioId, result]));

// ─── Run Operations ────────────────────────────────────────────────────

export function createRun(run: Run): Run {
  runs.set(run.id, { ...run });
  saveRecords('runs.json', runs.values());
  return run;
}

export function getRun(runId: string): Run | null {
  return runs.get(runId) || null;
}

export function updateRun(runId: string, updates: Partial<Run>): Run | null {
  const run = runs.get(runId);
  if (!run) return null;
  const updated = { ...run, ...updates, updatedAt: new Date().toISOString() };
  runs.set(runId, updated);
  saveRecords('runs.json', runs.values());
  return updated;
}

export function getAllRuns(): Run[] {
  return Array.from(runs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function updateRunStatus(runId: string, status: RunStatus): void {
  const run = runs.get(runId);
  if (run) {
    run.status = status;
    run.updatedAt = new Date().toISOString();
    saveRecords('runs.json', runs.values());
  }
}

export function updateRunEvents(
  runId: string,
  events: ExtractedEvent[],
  clashes: Clash[],
  unparsedRows: UnparsedRow[]
): void {
  const run = runs.get(runId);
  if (run) {
    run.extractedEvents = events;
    run.clashes = clashes;
    run.unparsedRows = unparsedRows;
    run.updatedAt = new Date().toISOString();
    saveRecords('runs.json', runs.values());
  }
}

export function updateRunAgentTrace(runId: string, agentTrace: Run['agentTrace']): void {
  const run = runs.get(runId);
  if (!run) return;
  run.agentTrace = agentTrace;
  run.updatedAt = new Date().toISOString();
  saveRecords('runs.json', runs.values());
}

export function updateRunVerification(runId: string, report: VerificationReport): void {
  const run = runs.get(runId);
  if (run) {
    run.verificationReport = report;
    run.updatedAt = new Date().toISOString();
    saveRecords('runs.json', runs.values());
  }
}

// ─── Proposal Operations ──────────────────────────────────────────────

export function createProposal(proposal: Proposal): Proposal {
  proposals.set(proposal.id, { ...proposal });
  saveRecords('proposals.json', proposals.values());
  // Link to run
  const run = runs.get(proposal.runId);
  if (run) {
    run.proposalId = proposal.id;
    run.updatedAt = new Date().toISOString();
    saveRecords('runs.json', runs.values());
  }
  return proposal;
}

export function getProposal(proposalId: string): Proposal | null {
  return proposals.get(proposalId) || null;
}

export function approveProposal(proposalId: string): Proposal | null {
  const proposal = proposals.get(proposalId);
  if (!proposal || proposal.status !== 'pending') return null;
  const approved: Proposal = { ...proposal, status: 'approved', approvedAt: new Date().toISOString() };
  const nextRecords = Array.from(proposals.values(), (item) => item.id === proposalId ? approved : item);
  // Persist the new state before mutating memory. If disk storage fails, the
  // pending proposal remains retryable in this process as well.
  saveRecords('proposals.json', nextRecords);
  proposals.set(proposalId, approved);
  return approved;
}

export function getAllProposals(): Proposal[] {
  return Array.from(proposals.values());
}

// ─── Scenario Result Operations ───────────────────────────────────────

export function saveScenarioResult(result: ScenarioResult): void {
  scenarioResults.set(result.scenarioId, result);
  saveRecords('scenario-results.json', scenarioResults.values());
}

export function getScenarioResult(scenarioId: string): ScenarioResult | null {
  return scenarioResults.get(scenarioId) || null;
}

export function getAllScenarioResults(): ScenarioResult[] {
  return Array.from(scenarioResults.values());
}

// ─── Reset (for tests) ────────────────────────────────────────────────

export function resetStore(): void {
  runs.clear();
  proposals.clear();
  scenarioResults.clear();
  saveRecords('runs.json', []);
  saveRecords('proposals.json', []);
  saveRecords('scenario-results.json', []);
}
