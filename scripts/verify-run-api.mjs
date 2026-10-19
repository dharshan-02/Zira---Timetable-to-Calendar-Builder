import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
const endpoint = `${baseUrl}/api/run`;
const maxSnapshotChars = 250_000;
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  if (process.env.AUTHORIZATION) headers.set('authorization', process.env.AUTHORIZATION);
  return originalFetch(input, { ...init, headers });
};

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

const privateSource = await fetch(`${baseUrl}/api/source`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url: 'http://127.0.0.1:3000/internal' }),
});
assert.equal(privateSource.status, 400, 'private-network source URLs should be rejected before connecting');

for (const url of ['', 'http://127.0.0.1:3000/']) {
  const response = await fetch(`${baseUrl}/api/discover`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }),
  });
  assert.ok(response.status === 400 || response.status === 422, `source discovery should reject empty/private portal URL ${url}`);
}

for (const url of [
  'http://[ff02::1]/', // IPv6 multicast
  'http://[2001:0::1]/', // special-purpose IPv6 protocol assignment
  'http://[3fff::1]/', // IPv6 documentation range
  'http://[::ffff:127.0.0.1]/', // IPv4-mapped loopback
]) {
  const response = await fetch(`${baseUrl}/api/source`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  assert.equal(response.status, 400, `non-public IPv6 source ${url} should be rejected before connecting`);
}

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
assert.ok(extraction.agentTrace?.some((step) => step.tool === 'timetable-parser'), 'agent should return a trace of tools used');
assert.equal(extraction.agentTrace?.at(-1)?.status, 'waiting', 'agent should wait for human approval before calendar writes');
const tracedRun = await fetch(`${endpoint}?id=${encodeURIComponent(pipelineRun.id)}`).then((response) => response.json());
assert.equal(tracedRun.run?.agentTrace?.at(-1)?.status, 'waiting', 'agent trace should persist with the saved run');

const proposalResponse = await fetch(`${baseUrl}/api/propose`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ runId: pipelineRun.id }),
});
assert.equal(proposalResponse.status, 200, 'calendar proposal should be created');
const { proposal } = await proposalResponse.json();
const calendarBeforeApproval = await fetch(`${baseUrl}/api/calendar`).then((response) => response.json());

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
const calendarAfterDuplicate = await fetch(`${baseUrl}/api/calendar`).then((response) => response.json());

const calendarResponse = await fetch(`${baseUrl}/api/calendar`);
assert.equal(calendarResponse.status, 200, 'calendar should be readable after approval');
const calendar = await calendarResponse.json();
const approvedEventIds = new Set([...proposal.newEvents, ...proposal.updatedEvents, ...proposal.unchangedEvents]);
assert.ok(approvedEventIds.size === 5, 'proposal should include five schedule entries');
assert.ok([...approvedEventIds].every((id) => calendar.rawEvents.some((event) => event.id === id)), 'calendar should contain every approved event');
const calendarCountAfterApproval = calendar.rawEvents.length;
assert.ok(calendarCountAfterApproval >= calendarBeforeApproval.rawEvents.length, 'approval should preserve pre-existing calendar entries');
assert.equal(calendarAfterDuplicate.rawEvents.length, calendarCountAfterApproval, 'duplicate approval must not create duplicate calendar entries');

const examRunResponse = await post({ section: 'Exam date validation', sourceType: 'text', sourceRef: 'exam-without-date.txt' });
assert.equal(examRunResponse.status, 200, 'exam-validation run should be accepted');
const { run: examRun } = await examRunResponse.json();
const examResponse = await fetch(`${baseUrl}/api/extract`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ runId: examRun.id, method: 'text', content: 'Course Code | Course Name | Day | Start Time | End Time | Room | Type\nCS901 | Final Exam | Monday | 09:00 | 11:00 | Hall-A | Exam' }),
});
assert.equal(examResponse.status, 200, 'date-less exam row should be reviewed, not crash extraction');
const examResult = await examResponse.json();
assert.equal(examResult.events.length, 0, 'date-less exam must not become a recurring class');
assert.match(examResult.unparsedRows[0]?.reason || '', /exam row has no explicit calendar date/i, 'date-less exam should have an explicit review reason');

const datedExamRunResponse = await post({ section: 'Exam date export', sourceType: 'text', sourceRef: 'dated-exam.txt' });
const { run: datedExamRun } = await datedExamRunResponse.json();
const datedExamResponse = await fetch(`${baseUrl}/api/extract`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ runId: datedExamRun.id, method: 'text', content: 'Course Code | Course Name | Exam Date | Start Time | End Time | Room | Type\nCS902 | Final Exam | 10/12/2026 | 09:00 | 11:00 | Hall-A | Exam' }),
});
const datedExam = await datedExamResponse.json();
assert.equal(datedExamResponse.status, 200, 'dated exam should extract');
assert.equal(datedExam.events.length, 1, 'dated exam should produce one event');
assert.equal(datedExam.events[0].examDate, '2026-12-10', 'exam date should normalize to ISO calendar date');
const datedExamProposalResponse = await fetch(`${baseUrl}/api/propose`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ runId: datedExamRun.id }),
});
const { proposal: datedExamProposal } = await datedExamProposalResponse.json();
const datedExamApprovalResponse = await fetch(`${baseUrl}/api/approve`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ proposalId: datedExamProposal.id }),
});
assert.equal(datedExamApprovalResponse.status, 200, 'dated exam can be approved');

for (const [format, contentType, signature] of [
  ['ics', 'text/calendar', 'BEGIN:VCALENDAR'],
  ['xlsx', 'spreadsheetml', 'PK'],
  ['docx', 'wordprocessingml', 'PK'],
  ['pdf', 'application/pdf', '%PDF-'],
]) {
  const response = await fetch(`${baseUrl}/api/calendar?format=${format}`);
  assert.equal(response.status, 200, `${format} export should succeed`);
  assert.match(response.headers.get('content-type') || '', new RegExp(contentType), `${format} content type should be correct`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (format === 'ics') {
    const calendarText = bytes.toString('utf8');
    for (const id of approvedEventIds) assert.ok(calendarText.includes(`${id}@timetable-builder`), `ICS should include approved event ${id}`);
    const examEvent = calendarText.split('BEGIN:VEVENT').find((block) => block.includes(`${datedExam.events[0].id}@timetable-builder`));
    assert.match(examEvent || '', /DTSTART:20261210T090000/, 'exam ICS entry should use its one-off date');
    assert.doesNotMatch(examEvent || '', /RRULE:/, 'exam ICS entry must not recur weekly');
  }
  assert.ok(bytes.subarray(0, signature.length).toString().includes(signature), `${format} export should have a valid file signature`);
  assert.match(response.headers.get('content-disposition') || '', /attachment; filename=/i, `${format} should download as an attachment`);
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    assert.equal(workbook.worksheets[0]?.getCell('A1').value, 'Course code', 'Excel workbook should have its timetable header');
    assert.ok((workbook.worksheets[0]?.rowCount ?? 0) >= 6, 'Excel workbook should contain approved calendar entries');
  }
  if (format === 'docx') {
    const archive = await JSZip.loadAsync(bytes);
    const documentXml = await archive.file('word/document.xml')?.async('text');
    assert.ok(documentXml?.includes('Weekline timetable'), 'Word document should contain the timetable title');
    assert.ok(documentXml?.includes('Course code'), 'Word document should contain timetable columns');
  }
  if (format === 'pdf') {
    const document = await PDFDocument.load(bytes);
    assert.ok(document.getPageCount() >= 1, 'PDF should be a readable document');
  }
}

console.log('PASS run API validation, snapshot bounds, history payload, human-approved write, read-back, duplicate approval, and ICS/XLSX/DOCX/PDF exports');
