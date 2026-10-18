// The production JavaScript, gzipped, held to a budget. A screen that grows
// the bundle past it needs a decision - route splitting, a lighter dependency -
// rather than a quiet regression. Measured at 122.8 kB in one chunk when the
// budget was set.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 140;
const ASSETS = 'dist/assets';

const chunks = readdirSync(ASSETS)
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({ name, kb: gzipSync(readFileSync(join(ASSETS, name))).length / 1024 }));
const total = chunks.reduce((sum, chunk) => sum + chunk.kb, 0);

for (const { name, kb } of chunks) console.log(`${name}  ${kb.toFixed(1)} kB gzipped`);
console.log(`total  ${total.toFixed(1)} kB of ${BUDGET_KB} kB`);

if (total > BUDGET_KB) {
  console.error(`The production JavaScript is over its budget of ${BUDGET_KB} kB gzipped.`);
  process.exit(1);
}
