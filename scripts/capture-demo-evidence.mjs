import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ids = ['TC1', 'TC2', 'TC3', 'TC4'];
const results = [];
for (const scenarioId of ids) {
  const response = await fetch(`${baseUrl}/api/scenarios`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenarioId }),
  });
  const body = await response.json();
  if (!response.ok || !body.result) throw new Error(`${scenarioId} failed: ${body.error || response.status}`);
  results.push(body.result);
}
const out = [
  '# Official scenario evidence',
  '',
  `Captured: ${new Date().toISOString()}`,
  '',
  '> All four runs use synthetic fixtures because the provided brief names the organizer mock timetable page/PDF but contains no actual URL. These results show rule and tool behavior, not a run against the organizer source. TC1 and TC3 use isolated calendar simulations. The shared calendar was not changed by these benchmark runs. TC4 simulates OCR-like text damage; no image OCR engine ran.',
  '',
  ...results.flatMap((result) => [
    `## ${result.scenarioId}`,
    '',
    `**Result:** ${result.passed ? 'PASS · synthetic fixture assertion' : 'FAIL'}`,
    '',
    `**Run ID:** \`${result.runId}\`  `,
    `**Recorded at:** ${result.timestamp}`,
    '',
    '### Input',
    '',
    '```text',
    result.input,
    '```',
    '',
    '### Expected result',
    '',
    result.expected,
    '',
    '### Actual result',
    '',
    '```text',
    result.actual,
    '```',
    '',
    '### Evidence',
    '',
    '```json',
    result.evidence,
    '```',
    '',
  ]),
].join('\n');
await fs.writeFile(path.join(root, 'docs', 'DEMO-EVIDENCE.md'), out, 'utf8');
console.log(`Wrote ${results.length} scenario reports to docs/DEMO-EVIDENCE.md`);
for (const result of results) console.log(`${result.scenarioId}: ${result.passed ? 'PASS' : 'FAIL'} (${result.runId})`);
