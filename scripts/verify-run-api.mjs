import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
const endpoint = `${baseUrl}/api/run`;
const maxSnapshotChars = 250_000;

async function postRaw(body) {
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

async function post(body) {
  return postRaw(JSON.stringify(body));
}

const malformed = await postRaw('{');
assert.equal(malformed.status, 400, 'malformed JSON should be a client error');
assert.match((await malformed.json()).error, /valid JSON/i);

for (const [label, body] of [
  ['non-object body', []],
  ['missing section', { sourceType: 'text' }],
  ['unsupported source', { section: 'A', sourceType: 'xml' }],
  ['invalid electives', { section: 'A', sourceType: 'text', electives: ['CS101', 12] }],
  ['long source reference', { section: 'A', sourceType: 'text', sourceRef: 'x'.repeat(2049) }],
  ['invalid source evidence', { section: 'A', sourceType: 'text', sourceEvidence: {} }],
  ['invalid snapshot', { section: 'A', sourceType: 'text', sourceSnapshot: 12 }],
]) {
  const response = await post(body);
  assert.equal(response.status, 400, `${label} should be rejected with HTTP 400`);
  assert.ok((await response.json()).error, `${label} should return a useful error`);
}

const missingRun = await fetch(`${endpoint}?id=run-that-does-not-exist`);
assert.equal(missingRun.status, 404, 'unknown run should return HTTP 404');

const sourceSnapshot = 's'.repeat(maxSnapshotChars + 17);
const createdResponse = await post({
  section: 'API contract check',
  sourceType: 'text',
  sourceSnapshot,
});
assert.equal(createdResponse.status, 200, 'valid run should be accepted');
const { run: created } = await createdResponse.json();
assert.ok(created?.id, 'created run should have an id');

const detailResponse = await fetch(`${endpoint}?id=${encodeURIComponent(created.id)}`);
assert.equal(detailResponse.status, 200, 'created run should reopen');
const { run: detail } = await detailResponse.json();
assert.equal(detail.sourceSnapshot.length, maxSnapshotChars, 'saved source should be bounded');
assert.equal(detail.sourceSnapshotTruncated, true, 'truncation should be signaled');

const historyResponse = await fetch(endpoint);
assert.equal(historyResponse.status, 200, 'history summary should load');
const { runs } = await historyResponse.json();
const summary = runs.find((item) => item.id === created.id);
assert.ok(summary, 'created run should appear in history');
assert.ok(!Object.hasOwn(summary, 'sourceSnapshot'), 'history list should not include full source text');
assert.ok(!Object.hasOwn(summary, 'extractedEvents'), 'history list should not include event payloads');
assert.equal(summary.sessionCount, 0, 'new run should report zero sessions');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = await readFile(path.join(root, 'public', 'samples', 'timetables', '01-computer-science-core-week.txt'), 'utf8');
const pipelineRunResponse = await post({ section: 'Approval contract check', sourceType: 'mock', sourceRef: 'api-contract-sample.txt' });
assert.equal(pipelineRunResponse.status, 200, 'pipeline run should be accepted');
const { run: pipelineRun } = await pipelineRunResponse.json();

const extractionResponse = await fetch(`${baseUrl}/api/extract`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ runId: pipelineRun.id, content, method: 'text' }),
});
assert.equal(extractionResponse.status, 200, 'pipeline extraction should succeed');
const extraction = await extractionResponse.json();
assert.equal(extraction.events.length, 5, 'sample pipeline should extract five sessions');

const proposalResponse = await fetch(`${baseUrl}/api/propose`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ runId: pipelineRun.id }),
});
assert.equal(proposalResponse.status, 200, 'calendar proposal should be created');
const { proposal } = await proposalResponse.json();

const approvalResponse = await fetch(`${baseUrl}/api/approve`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ proposalId: proposal.id }),
});
assert.equal(approvalResponse.status, 200, 'proposal should be approved');
const approval = await approvalResponse.json();
assert.equal(approval.status, 'completed', 'all calendar writes should verify');
assert.equal(approval.writtenCount, 5, 'all five events should be written');
assert.equal(approval.verification.verified, 5, 'all written events should be read back');

const duplicateApproval = await fetch(`${baseUrl}/api/approve`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ proposalId: proposal.id }),
});
assert.equal(duplicateApproval.status, 400, 'approved proposal should not be applied twice');

const calendarResponse = await fetch(`${baseUrl}/api/calendar`);
assert.equal(calendarResponse.status, 200, 'calendar should be readable after approval');
const calendar = await calendarResponse.json();
assert.equal(calendar.rawEvents.length, 5, 'calendar should contain all approved events');

console.log('PASS run API validation, snapshot bounds, history payload, extract/propose/approve, read-back, and duplicate-approval checks');
