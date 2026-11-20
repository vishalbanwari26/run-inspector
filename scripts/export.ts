// Writes every run from Postgres to fixtures/snapshot.json for the static demo.
import { writeFileSync } from 'node:fs';
import { loadRuns } from '@/data/live';

const runs = await loadRuns();
writeFileSync('fixtures/snapshot.json', JSON.stringify(runs, null, 1));
console.log(`exported ${runs.length} run(s)`);
process.exit(0);
