import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  if (process.env.AUTHORIZATION) headers.set('authorization', process.env.AUTHORIZATION);
  return originalFetch(input, { ...init, headers });
};
const samples = [
  '01-computer-science-core-week.txt',
  '02-business-split-cohorts.txt',
  '03-engineering-lab-rotation.txt',
  '04-nursing-clinical-blocks.txt',
  '05-arts-seminar-week.txt',
  '06-data-science-project-studio.txt',
  '07-law-lecture-and-tutorial.txt',
  '08-architecture-studio-week.txt',
  '09-science-lecture-and-lab.txt',
  '10-mixed-electives-overlap-review.txt',
];
const issues = [];

async function checkExtraction(label, content, sourceType, sourceRef, sourceEvidence) {
  const runResponse = await fetch(`${baseUrl}/api/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ section: 'A', electives: [], sourceType, sourceRef, sourceSnapshot: content, sourceEvidence }),
  });
  const runData = await runResponse.json();
  if (!runResponse.ok) throw new Error(`${label}: run creation failed (${runResponse.status}): ${runData.error}`);

  const response = await fetch(`${baseUrl}/api/extract`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ runId: runData.run.id, content, sourceFile: sourceRef, method: 'text' }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${label}: extraction failed (${response.status}): ${data.error}`);
  if (!data.events?.length) throw new Error(`${label}: extraction returned no events`);
  const proposalResponse = await fetch(`${baseUrl}/api/propose`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ runId: runData.run.id }),
  });
  const proposalData = await proposalResponse.json();
  if (!proposalResponse.ok || proposalData.proposal?.totalEvents !== data.events.length) {
    throw new Error(`${label}: calendar proposal failed (${proposalData.error ?? proposalResponse.status})`);
  }
  const detailResponse = await fetch(`${baseUrl}/api/run?id=${encodeURIComponent(runData.run.id)}`);
  const detail = await detailResponse.json();
  if (!detailResponse.ok || detail.run?.sourceSnapshot !== content || detail.proposal?.id !== proposalData.proposal.id ||
      (sourceEvidence && detail.run?.input?.sourceEvidence?.sourceUrl !== sourceEvidence.sourceUrl)) {
    throw new Error(`${label}: saved source snapshot or proposal could not be reopened`);
  }
  return { events: data.events.length, unparsed: data.unparsedRows?.length ?? 0 };
}

for (const filename of samples) {
  try {
    const content = await readFile(path.join(root, 'public', 'samples', 'timetables', filename), 'utf8');
    const response = await fetch(`${baseUrl}/samples/timetables/${filename}`);
    if (!response.ok) throw new Error(`static sample is unavailable (${response.status})`);
    const result = await checkExtraction(filename, content, 'mock', filename);
    console.log(`PASS ${filename}: ${result.events} events, ${result.unparsed} unparsed`);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
    console.error(`FAIL ${filename}: ${issues.at(-1)}`);
  }
}

if (process.env.LIVE_SOURCE_TESTS === '1') {
try {
  const response = await fetch(`${baseUrl}/api/discover`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://gouni.edu.ng/lecture-time-table/' }),
  });
  const data = await response.json();
  if (!response.ok || !data.sourcePageUrl || !data.retrievedAt || !data.candidates?.length) {
    throw new Error(data.error ?? `Portal discovery returned no candidates (${response.status})`);
  }
  if (!data.candidates.some((candidate) => /\.pdf(?:$|[?#])/i.test(candidate.url))) {
    throw new Error('Portal discovery did not surface the linked timetable PDFs.');
  }
  console.log(`PASS portal discovery example: ${data.candidates.length} candidates ranked from ${data.sourcePageUrl} at ${data.retrievedAt}`);
} catch (error) {
  issues.push(error instanceof Error ? error.message : String(error));
  console.error(`FAIL portal discovery example: ${issues.at(-1)}`);
}
} else {
  console.log('SKIP live portal/source network checks (set LIVE_SOURCE_TESTS=1 to run them)');
}

try {
  const pasted = await readFile(path.join(root, 'public', 'samples', 'timetables', samples[0]), 'utf8');
  const result = await checkExtraction('pasted timetable', pasted, 'text', 'pasted-timetable.txt');
  console.log(`PASS pasted timetable: ${result.events} events, ${result.unparsed} unparsed`);
} catch (error) {
  issues.push(error instanceof Error ? error.message : String(error));
  console.error(`FAIL pasted timetable: ${issues.at(-1)}`);
}

try {
  const form = new FormData();
  const bytes = await readFile(path.join(root, 'public', 'samples', 'Godfrey-Okoye-University-FCIT-Lecture-Timetable-2026-2027.pdf'));
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), 'Godfrey-Okoye-University-FCIT-Lecture-Timetable-2026-2027.pdf');
  const response = await fetch(`${baseUrl}/api/source`, { method: 'POST', body: form });
  const data = await response.json();
  if (!response.ok || !data.content?.trim()) throw new Error(data.error ?? `PDF upload failed (${response.status})`);
  const result = await checkExtraction('PDF upload', data.content, 'pdf', data.sourceName);
  console.log(`PASS PDF upload: ${data.content.length} characters, ${result.events} events, ${result.unparsed} unparsed`);
} catch (error) {
  issues.push(error instanceof Error ? error.message : String(error));
  console.error(`FAIL PDF upload: ${issues.at(-1)}`);
}

if (process.env.LIVE_SOURCE_TESTS === '1') {
try {
  const response = await fetch(`${baseUrl}/api/source`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://gouni.edu.ng/wp-content/uploads/2026/10/FACIT-26-1.pdf' }),
  });
  const data = await response.json();
  if (!response.ok || !data.content?.trim()) throw new Error(data.error ?? `Public URL failed (${response.status})`);
  const evidence = { sourceUrl: data.sourceUrl, sourceName: data.title || data.sourceName, contentType: data.contentType, fetchedAt: data.fetchedAt };
  const result = await checkExtraction('public timetable URL', data.content, 'url', data.sourceUrl, evidence);
  console.log(`PASS public timetable URL: ${data.content.length} characters, ${result.events} events, ${result.unparsed} unparsed`);
} catch (error) {
  issues.push(error instanceof Error ? error.message : String(error));
  console.error(`FAIL public timetable URL: ${issues.at(-1)}`);
}
} else {
  console.log('SKIP live timetable URL retrieval (set LIVE_SOURCE_TESTS=1 to run it)');
}

if (process.env.LIVE_SOURCE_TESTS === '1') {

try {
  const response = await fetch(`${baseUrl}/api/source`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://gouni.edu.ng/wp-content/uploads/2026/06/FaCIT-3.pdf' }),
  });
  const source = await response.json();
  if (!response.ok || !source.content?.trim() || source.contentType !== 'application/pdf') {
    throw new Error(source.error ?? `Official exam timetable PDF intake failed (${response.status})`);
  }
  const evidence = { sourceUrl: source.sourceUrl, sourceName: source.title, contentType: source.contentType, fetchedAt: source.fetchedAt };
  const runResponse = await fetch(`${baseUrl}/api/run`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ section: 'A', electives: [], sourceType: 'url', sourceRef: source.sourceUrl, sourceEvidence: evidence, sourceSnapshot: source.content }),
  });
  const created = await runResponse.json();
  const reopened = await fetch(`${baseUrl}/api/run?id=${encodeURIComponent(created.run.id)}`).then((r) => r.json());
  if (!runResponse.ok || reopened.run?.input?.sourceEvidence?.sourceUrl !== source.sourceUrl || reopened.run?.sourceSnapshot !== source.content) {
    throw new Error('Official exam source URL and extraction snapshot were not retained on the saved review.');
  }
  console.log(`PASS official exam timetable source evidence: ${source.content.length} characters, URL and retrieval metadata retained`);
} catch (error) {
  issues.push(error instanceof Error ? error.message : String(error));
  console.error(`FAIL official exam timetable source: ${issues.at(-1)}`);
}
} else {
  console.log('SKIP live timetable and exam PDF URL retrievals (set LIVE_SOURCE_TESTS=1 to run them)');
}

if (issues.length) process.exitCode = 1;
else {
  try {
    const historyResponse = await fetch(`${baseUrl}/api/run`);
    const history = await historyResponse.json();
    const sampleSummary = history.runs?.find((run) => run.input.sourceRef === samples[0]);
    if (!historyResponse.ok || !sampleSummary?.sessionCount || 'sourceSnapshot' in sampleSummary || 'extractedEvents' in sampleSummary) {
      throw new Error('History summaries should include counts without returning source text or event payloads.');
    }
    const icsResponse = await fetch(`${baseUrl}/api/calendar?format=ics`);
    const ics = await icsResponse.text();
    if (!icsResponse.ok || !ics.startsWith('BEGIN:VCALENDAR') || !ics.includes('END:VCALENDAR')) {
      throw new Error('Calendar ICS export did not return a valid calendar document.');
    }
    console.log('PASS review history summaries and calendar export');
    console.log(`\nAll ${samples.length} sample timetables, source formats, proposal, history, and calendar export checks passed.`);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
    console.error(`FAIL review history/calendar: ${issues.at(-1)}`);
    process.exitCode = 1;
  }
}
