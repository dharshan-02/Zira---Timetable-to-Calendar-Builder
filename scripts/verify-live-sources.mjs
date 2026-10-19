import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['scripts/verify-timetable-samples.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, LIVE_SOURCE_TESTS: '1' },
});
process.exit(result.status ?? 1);
