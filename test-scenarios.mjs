const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

async function testScenarios() {
  const scenarios = ['TC1', 'TC2', 'TC3', 'TC4'];
  const failures = [];
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
  }
  if (failures.length) throw new Error(failures.join('\n'));
  console.log('\nAll four official scenarios passed.');
}

testScenarios().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
