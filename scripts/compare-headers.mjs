// Compares what Cloudflare Pages serves with public/_headers. Nothing else sees
// the served headers: `vite preview` does not read the file, and a Pages setting
// or a typo in a rule would otherwise show only to someone running curl. Run by
// the weekly `headers` workflow, and by hand: `node scripts/compare-headers.mjs`.
import { readFileSync } from 'node:fs';

const ORIGIN = process.env.CONSOLE_ORIGIN ?? 'https://console.aleksadragnic.com';
const BROWSER = 'Mozilla/5.0 (compatible; umapi-console header check)';

/** The rules of public/_headers: path pattern, then [name, value] or ['!', name]. */
function rules() {
  const parsed = [];
  for (const line of readFileSync('public/_headers', 'utf8').split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      parsed.push({ pattern: line.trim(), entries: [] });
      continue;
    }
    const entry = line.trim();
    const current = parsed.at(-1);
    if (entry.startsWith('!')) current.entries.push(['!', entry.slice(1).trim()]);
    else {
      const colon = entry.indexOf(':');
      current.entries.push([entry.slice(0, colon).trim(), entry.slice(colon + 1).trim()]);
    }
  }
  return parsed;
}

function matches(pattern, path) {
  const expression = new RegExp(
    `^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
  );
  return expression.test(path);
}

/** What the file says a path is served with, rules applied in order. */
function expectedFor(path) {
  const headers = new Map();
  for (const { pattern, entries } of rules()) {
    if (!matches(pattern, path)) continue;
    for (const [name, value] of entries) {
      if (name === '!') headers.delete(value.toLowerCase());
      else headers.set(name.toLowerCase(), value);
    }
  }
  return headers;
}

async function servedAsset() {
  const html = await (await fetch(`${ORIGIN}/`, { headers: { 'User-Agent': BROWSER } })).text();
  const asset = html.match(/\/assets\/[^"']+\.js/)?.[0];
  if (asset === undefined) throw new Error('The served page names no script under /assets/.');
  return asset;
}

const paths = ['/', '/users', '/og.png', await servedAsset()];
let differences = 0;
for (const path of paths) {
  const response = await fetch(`${ORIGIN}${path}`, { headers: { 'User-Agent': BROWSER } });
  for (const [name, value] of expectedFor(path)) {
    const served = response.headers.get(name);
    if (served !== value) {
      differences += 1;
      console.error(`${path}  ${name}\n  expected: ${value}\n  served:   ${served ?? '(absent)'}`);
    }
  }
  console.log(`${path}  ${response.status}  checked ${expectedFor(path).size} headers`);
}

if (differences > 0) {
  console.error(`${differences} served header(s) differ from public/_headers.`);
  process.exit(1);
}
console.log('Every checked header is served as public/_headers says.');
