/**
 * Emits the static `newsroom-hosts.json` into the web build output.
 *
 * Runs at build time (chained off `build-web`). Extracts the feed URLs from
 * the newsroom publisher registry (src/features/newsrooms/publishers.ts) and
 * writes their registrable domains for the production RSS proxy
 * (services/rss/bunny/index.ts) to consume as its host allowlist. Adding a
 * publisher to the registry therefore propagates to the proxy on the next web
 * deploy, with no proxy-side change.
 */
/* eslint-disable import-x/no-nodejs-modules, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Node build script, not app source */
const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.join(__dirname, '..')

// Second-level TLDs where "last two labels" is a registry suffix, not a
// registrable domain. Coarse on purpose: the registry is small and curated.
const SECOND_LEVEL_TLDS = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'co.jp',
  'co.in',
  'com.br',
  'com.mx',
  'com.tr',
])

function registrableDomain(hostname) {
  const labels = hostname.toLowerCase().split('.')
  const lastTwo = labels.slice(-2).join('.')
  const take = SECOND_LEVEL_TLDS.has(lastTwo) ? 3 : 2
  return labels.slice(-take).join('.')
}

const registry = fs.readFileSync(
  path.join(projectRoot, 'src', 'features', 'newsrooms', 'publishers.ts'),
  'utf8',
)
// Match any `url: 'http...'` regardless of how prettier wraps the source
// entry; feed URLs are the only http(s) `url:` fields in the registry.
const feedUrls = [...registry.matchAll(/url: '(https?:[^']+)'/g)].map(m => m[1])
if (feedUrls.length === 0) {
  throw new Error('gen-newsroom-hosts: no feed URLs found in publishers.ts')
}

const hosts = [
  ...new Set(feedUrls.map(u => registrableDomain(new URL(u).hostname))),
].sort()

const outDir = path.join(projectRoot, 'web-build')
fs.mkdirSync(outDir, {recursive: true})
const outFile = path.join(outDir, 'newsroom-hosts.json')
fs.writeFileSync(outFile, JSON.stringify({hosts}, null, 2) + '\n')
console.log(`gen-newsroom-hosts: wrote ${hosts.length} hosts to ${outFile}`)
