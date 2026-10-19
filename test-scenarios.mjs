const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  if (process.env.AUTHORIZATION) headers.set('authorization', process.env.AUTHORIZATION);
  return originalFetch(input, { ...init, headers });
};

async function testScenarios() {
  const scenarios = ['TC1', 'TC2', 'TC3', 'TC4'];
  const failures = [];
  const calendarBefore = await fetch(`${baseUrl}/api/calendar`).then((response) => response.json());
  for (const sc of scenarios) {
    console.log(`\n================ Executing ${sc} ================`);
    const res = await fetch(`${baseUrl}/api/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: sc }),
    });
    const data = await res.json();
    if (!res.ok || !data.result) {
      failures.push(`${sc}: ${data.error || `HTTP ${res.status}`}`);
      console.error(failures.at(-1));
      continue;
    }
    console.log(`Scenario: ${data.result.scenarioId}`);
    console.log(`Passed: ${data.result.passed}`);
    console.log(`Actual Output:\n${data.result.actual}`);
    if (!data.result.passed) failures.push(`${sc}: expected behavior did not pass`);
    if (!data.result.evidence || !JSON.parse(data.result.evidence).source) {
      failures.push(`${sc}: source fixture/input was not recorded with the result`);
    }
    if (!data.result.input || !data.result.expected || !data.result.actual || !data.result.timestamp) {
      failures.push(`${sc}: input, expected/actual result, or timestamp is missing from the visible report`);
    }
  }
  const calendarAfter = await fetch(`${baseUrl}/api/calendar`).then((response) => response.json());
  if (JSON.stringify(calendarBefore.rawEvents) !== JSON.stringify(calendarAfter.rawEvents)) {
    failures.push('Benchmark run changed the shared calendar without human approval');
  }
  if (failures.length) throw new Error(failures.join('\n'));
  console.log('\nAll four official scenarios passed.');
}

testScenarios().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
