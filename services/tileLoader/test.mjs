/**
 * Checks a running tile loading server (services/tileLoader/bunny/index.ts)
 * against what @dasl/tile-server and @dasl/tile-lexicon say it must do.
 *
 *   BASE_HOST=localhost deno run --allow-net --allow-env services/tileLoader/bunny/index.ts
 *   node services/tileLoader/test.mjs http://localhost:8080 localhost
 *   node services/tileLoader/test.mjs https://t.mu.social t.mu.social  # deployed
 *
 * First argument: scheme and port to reach it on (the host part is replaced
 * by load.<base> and tile origins); second: the base host. Locally (the
 * first argument on localhost or 127.0.0.1, or a base host on localhost)
 * requests go to this machine with the Host header set, so no DNS for the
 * made-up names is needed, and a run with BASE_HOST=t.mu.social checks mu's
 * own names without a request leaving it.
 */
import {randomBytes} from 'node:crypto'
import {readdirSync, readFileSync} from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const reach = new URL(process.argv[2] || 'http://localhost:8080')
const base = process.argv[3] || 'localhost'
const local = base.endsWith('localhost')
const onThisMachine =
  local || ['localhost', '127.0.0.1'].includes(reach.hostname)
const here = dirname(fileURLToPath(import.meta.url))
const modules = join(here, '..', '..', 'node_modules', '@dasl')
const {
  runtimeHeaders,
  deadHeaders,
  dockCSP,
  dockPath,
  wipeHeaders,
  wipePath,
  cidLabelDigest,
} = await import(join(modules, 'tile-lexicon', 'dist', 'index.js'))
const dockDir = join(modules, 'tile-server', 'dock')
const publicDir = join(modules, 'tile-server', 'public')

/** GET/HEAD a path on a named host; locally the name only goes in Host. */
function request(host, path, {method = 'GET', headers = {}} = {}) {
  const lib = reach.protocol === 'https:' ? https : http
  const port = reach.port ? `:${reach.port}` : ''
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        host: onThisMachine ? '127.0.0.1' : host,
        port: reach.port || (reach.protocol === 'https:' ? 443 : 80),
        servername: host,
        path,
        method,
        headers: {host: `${host}${port}`, ...headers},
        // As a browser reads them: an answer's expiries can be 16 kB.
        maxHeaderSize: 1024 * 1024,
      },
      res => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        )
      },
    )
    req.on('error', reject)
    req.end()
  })
}

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures++
}
/** Something the CDN in front decides, not the script: never a failure. */
function note(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'note'} ${name}${detail ? `  (${detail})` : ''}`)
}
const hasAll = (got, want) =>
  Object.entries(want)
    .filter(([k, v]) => got[k] !== v)
    .map(([k]) => k)
/** Only the files are served: not the names every object answers to. */
async function onlyFiles(host, dir) {
  for (const name of ['constructor', 'toString', 'hasOwnProperty']) {
    const res = await request(host, `${dir}${name}`)
    const miss = hasAll(res.headers, deadHeaders)
    check(
      `${dir}${name} on ${host} is not a file`,
      res.status === 404 && miss.length === 0,
      `${res.status} ${miss.join(', ')}`,
    )
  }
}

const a = await request(`load.${base}`, '/.well-known/web-tiles/?x=1')
const b = await request(`load.${base}`, '/.well-known/web-tiles/?x=1')
const locA = new URL(a.headers.location || 'http://invalid/')
const locB = new URL(b.headers.location || 'http://invalid/')
const label = locA.hostname.slice(0, -(base.length + 1))
check('load.<base> answers 303', a.status === 303, String(a.status))
check(
  'to a 20-letter origin under the base',
  /^[a-z]{20}$/.test(label),
  locA.host,
)
check(
  'keeping path and query',
  locA.pathname + locA.search === '/.well-known/web-tiles/?x=1',
  locA.pathname + locA.search,
)
check(
  'over https (http only on localhost)',
  locA.protocol === (local ? 'http:' : 'https:'),
  locA.protocol,
)
check('a different origin each time', locA.hostname !== locB.hostname)
// Bunny rewrites a script's Cache-Control to no-cache, which also keeps the
// redirect out of caches; "a different origin each time" is the real check.
check(
  'redirect is not stored',
  /no-store|no-cache/.test(a.headers['cache-control'] || ''),
  a.headers['cache-control'],
)

const origin = locA.hostname
const index = await request(origin, '/.well-known/web-tiles/')
check(
  'runtime page is served on a tile origin',
  index.status === 200 &&
    index.body === readFileSync(join(publicDir, 'index.html'), 'utf8'),
  String(index.status),
)
check(
  'as HTML',
  /^text\/html/.test(index.headers['content-type'] || ''),
  index.headers['content-type'],
)
const missing = hasAll(index.headers, runtimeHeaders)
check(
  'with every runtime policy header',
  missing.length === 0,
  missing.join(', '),
)
for (const name of readdirSync(publicDir).filter(n => n.endsWith('.js'))) {
  const res = await request(origin, `/.well-known/web-tiles/${name}`)
  check(
    `${name} is byte-identical to @dasl/tile-server's`,
    res.status === 200 &&
      res.body === readFileSync(join(publicDir, name), 'utf8') &&
      /^text\/javascript/.test(res.headers['content-type'] || '') &&
      hasAll(res.headers, runtimeHeaders).length === 0,
    `${res.status} ${res.headers['content-type']}`,
  )
}
const worker = await request(origin, '/.well-known/web-tiles/worker.js')
check(
  'worker may take scope /',
  worker.headers['service-worker-allowed'] === '/',
)
const etag = worker.headers.etag
const again = await request(origin, '/.well-known/web-tiles/worker.js', {
  headers: {'if-none-match': etag},
})
// Bunny does not hand If-None-Match to the script, so deployed this is a 200.
note(
  'revalidation answers 304',
  again.status === 304 && again.body === '',
  String(again.status),
)
const head = await request(origin, '/.well-known/web-tiles/', {method: 'HEAD'})
check(
  'HEAD has no body',
  head.status === 200 && head.body === '',
  String(head.status),
)

for (const path of [
  '/',
  '/index.html',
  '/.well-known/web-tiles/nope.js',
  '/.well-known/web-tiles/../x',
  // The host page's places: the page is the base host's alone.
  '/.well-known/web-tiles/host/',
  '/.well-known/web-tiles/host/host.js',
  '/host/',
]) {
  const res = await request(origin, path)
  const miss = hasAll(res.headers, deadHeaders)
  check(
    `${path} on a tile origin is a dead end`,
    res.status === 404 && miss.length === 0,
    `${res.status} ${miss.join(', ')}`,
  )
}
const post = await request(origin, '/.well-known/web-tiles/', {method: 'POST'})
check(
  'POST to the runtime is refused',
  post.status === 405,
  String(post.status),
)
await onlyFiles(origin, '/.well-known/web-tiles/')

for (const host of [
  `www.${base}`,
  `abc.${base}`,
  `${'a'.repeat(21)}.${base}`,
  `${'a'.repeat(19)}1.${base}`,
  `x.${origin}`,
]) {
  // A name the wildcard does not cover fails at DNS or TLS: no runtime either.
  const res = await request(host, '/.well-known/web-tiles/').catch(e => ({
    status: 404,
    body: '',
    unreachable: e.code || e.message,
  }))
  if (res.unreachable) {
    check(`${host} is not a tile origin: unreachable`, true, res.unreachable)
    continue
  }
  check(
    `${host} is not a tile origin: no runtime`,
    res.status === 404 && !res.body.includes('shuttle'),
    String(res.status),
  )
}

// The page native WebViews run a tile in, on the base host itself: at its
// place, beside the dock and the runtime, and at /host/, where the builds
// installed before it moved open it.
const hostDir = join(modules, 'tile-host', 'public')
const HOST_PATH = '/.well-known/web-tiles/host/'
const page = await request(base, HOST_PATH).catch(e => ({
  unreachable: e.code || e.message,
}))
if (page.unreachable) {
  check(`https://${base}${HOST_PATH} is reachable`, false, page.unreachable)
} else {
  for (const at of [HOST_PATH, '/host/']) {
    const here = await request(base, at)
    check(
      `host page is served on the base host at ${at}`,
      here.status === 200 &&
        here.body === readFileSync(join(hostDir, 'index.html'), 'utf8'),
      String(here.status),
    )
    const csp = here.headers['content-security-policy'] || ''
    check(
      "it may frame this server's dock, on the loading host, and nothing else",
      new RegExp(
        `frame-src https://load\\.${base.replace(/\./g, '\\.')} http://load\\.${base.replace(/\./g, '\\.')}:\\*(;|$)`,
      ).test(csp) && /default-src 'none'/.test(csp),
      csp.match(/frame-src[^;]*/)?.[0] ?? 'no frame-src',
    )
    const hostJs = await request(base, `${at}host.js`)
    check(
      `${at}host.js is byte-identical to @dasl/tile-host's`,
      hostJs.status === 200 &&
        hostJs.body === readFileSync(join(hostDir, 'host.js'), 'utf8'),
      String(hostJs.status),
    )
    const bare = await request(base, `${at.slice(0, -1)}?tile=x`)
    check(
      `${at.slice(0, -1)} redirects to ${at}, keeping the query`,
      bare.status === 308 && bare.headers.location === `${at}?tile=x`,
      `${bare.status} ${bare.headers.location}`,
    )
    await onlyFiles(base, at)
  }
  const root = await request(base, '/')
  const shuttleOnBase = await request(base, '/.well-known/web-tiles/')
  check(
    'nothing else on the base host, and never the runtime',
    root.status === 404 && shuttleOnBase.status === 404,
    `${root.status} ${shuttleOnBase.status}`,
  )
  // Nor anything of the runtime's or the dock's through the page's place.
  for (const path of [
    `${HOST_PATH}../worker.js`,
    `${HOST_PATH}worker.js`,
    `${HOST_PATH}dock/dock.js`,
    `${HOST_PATH}%2e%2e/worker.js`,
  ]) {
    const res = await request(base, path)
    check(
      `${path} on the base host is no file of the runtime's or the dock's`,
      res.status === 404 && !res.headers['service-worker-allowed'],
      String(res.status),
    )
  }
  // The name asked for is the one that counts: a client does not get another
  // believed by sending a forwarding header of its own.
  for (const header of ['x-forwarded-host', 'cdn-host']) {
    const res = await request(base, '/.well-known/web-tiles/worker.js', {
      headers: {[header]: origin},
    })
    check(
      `${header} from a client does not make the base host a tile origin`,
      res.status === 404,
      String(res.status),
    )
  }
}

// Cookies: none set unasked; any that arrive are expired, for our scopes only.
const plain = [a, index, worker].some(r => r.headers['set-cookie'])
check('no cookie is ever set unasked', !plain)
const withCookie = await request(origin, '/.well-known/web-tiles/', {
  headers: {cookie: 'tossed=1; other=2'},
})
const set = withCookie.headers['set-cookie'] || []
const domain = base.replace(/:\d+$/, '')
const expires = name =>
  set.some(
    c =>
      c.startsWith(`${name}=;`) && /Max-Age=0/i.test(c) && !/Domain=/i.test(c),
  ) &&
  set.some(
    c =>
      c.startsWith(`${name}=;`) &&
      /Max-Age=0/i.test(c) &&
      new RegExp(`Domain=${domain.replace(/\./g, '\\.')}$`, 'i').test(c),
  )
const ran = withCookie.headers['x-tile-cookies-expired']
if (set.length === 0 && ran) {
  // The script answered with the expiries and the CDN removed them: Bunny's
  // "Strip Response Cookies" (pull zone, Caching), on by default.
  note(
    'cookies that arrive are expired',
    false,
    `script expired ${ran}, but the CDN strips Set-Cookie: turn off "Strip Response Cookies" on the pull zone to let it through`,
  )
} else if (set.length === 0) {
  note(
    'cookies that arrive are expired',
    false,
    'the CDN does not hand request cookies to the script',
  )
} else {
  check(
    'cookies that arrive are expired, host-only and for the base host',
    expires('tossed') && expires('other'),
    `${set.length} Set-Cookie`,
  )
}
check(
  'and never for a domain above the base host',
  set.every(
    c => !/Domain=/i.test(c) || c.toLowerCase().endsWith(`domain=${domain}`),
  ),
)

// The dock: on the loading host, for one tile origin at a time.
const scheme = local ? 'http' : 'https'
const portPart = reach.port ? `:${reach.port}` : ''
const mint = await request(`load.${base}`, dockPath)
const minted = new URL(mint.headers.location || 'http://invalid/')
check('the dock, asked without a tile origin, answers 303', mint.status === 303, String(mint.status))
check(
  'to itself, with a 20-letter tile origin',
  minted.hostname === `load.${base}` &&
    minted.pathname === dockPath &&
    new RegExp(`^[a-z]{20}\\.${base.replace(/\./g, '\\.')}${portPart}$`).test(
      minted.searchParams.get('tile') || '',
    ),
  mint.headers.location,
)
const docked = minted.searchParams.get('tile')
const dockPage = await request(`load.${base}`, `${dockPath}?tile=${encodeURIComponent(docked)}`)
check(
  'the dock page is served for that origin',
  dockPage.status === 200 &&
    dockPage.body === readFileSync(join(dockDir, 'index.html'), 'utf8'),
  String(dockPage.status),
)
check(
  'with a policy that frames that origin\'s runtime and nothing else',
  dockPage.headers['content-security-policy'] === dockCSP(`${scheme}://${docked}`),
  dockPage.headers['content-security-policy'],
)
const dockJs = await request(`load.${base}`, `${dockPath}dock.js`)
check(
  'the dock script is served, byte for byte',
  dockJs.status === 200 &&
    dockJs.body === readFileSync(join(dockDir, 'dock.js'), 'utf8'),
  String(dockJs.status),
)
await onlyFiles(`load.${base}`, dockPath)
for (const bad of ['evil.example', base, `load.${base}`, `${docked.replace(/:\d+$/, '')}:1`, `x.${docked}`]) {
  const res = await request(`load.${base}`, `${dockPath}?tile=${encodeURIComponent(bad)}`)
  check(`does not dock ${bad}`, res.status === 400, String(res.status))
}
// A large jar. In Chromium a page's credentialless tiles share one, about
// 10.8 kB of 180 cookies, and every later tile on that page brings it: a jar
// a little larger than that gets the runtime and the dock as without it, and
// has every name expired for the base host, within what one answer takes
// (16 kB). In other browsers, and in the native WebView, a tile can make the
// jar much larger: see the README.
const jar = Array.from(
  {length: 180},
  (_, i) => `c${i}=${'x'.repeat(63 - String(i).length)}`,
).join('; ')
const bare = await request(origin, '/.well-known/web-tiles/worker.js')
const big = await request(origin, '/.well-known/web-tiles/worker.js', {
  headers: {cookie: jar},
})
check(
  `a Cookie of ${jar.length} bytes gets the same runtime`,
  big.status === 200 &&
    big.body === bare.body &&
    big.headers.etag === bare.headers.etag,
  `${big.status} ${big.headers.etag}`,
)
const bigDock = await request(
  `load.${base}`,
  `${dockPath}?tile=${encodeURIComponent(docked)}`,
  {headers: {cookie: jar}},
)
check(
  'and the same dock',
  bigDock.status === 200 && bigDock.body === dockPage.body,
  String(bigDock.status),
)
const sizeOf = list => list.reduce((n, c) => n + c.length, 0)
const bigSet = [big.headers['set-cookie'] || []].flat()
if (bigSet.length) {
  const forBase = bigSet.filter(c =>
    new RegExp(`; Domain=${domain.replace(/\./g, '\\.')}$`, 'i').test(c),
  )
  check(
    'every name in it expired for the base host, within 16 kB',
    forBase.length === 180 && sizeOf(bigSet) <= 16 * 1024,
    `${forBase.length} of ${bigSet.length} Set-Cookie for the base host, ${sizeOf(bigSet)} bytes`,
  )
} else {
  note(
    'every name in it expired',
    false,
    'no Set-Cookie came back (see "cookies that arrive are expired")',
  )
}
// Names cost more to expire than to send: as many short names as fit in
// 12 kB would need some 200 kB of expiries. What fits goes, the base host
// first, and the rest goes with the requests that follow.
const names = Array.from({length: 1500}, (_, i) => `n${i}=1`).join('; ')
const many = await request(origin, '/.well-known/web-tiles/', {
  headers: {cookie: names},
})
const manySet = [many.headers['set-cookie'] || []].flat()
check(
  `${names.length} bytes of short names get the runtime`,
  many.status === 200,
  String(many.status),
)
if (manySet.length) {
  check(
    'with as many expiries as fit in 16 kB, for the base host first',
    manySet.length > 150 &&
      sizeOf(manySet) <= 16 * 1024 &&
      manySet.every(c =>
        new RegExp(`; Domain=${domain.replace(/\./g, '\\.')}$`, 'i').test(c),
      ),
    `${manySet.length} Set-Cookie, ${sizeOf(manySet)} bytes`,
  )
}

// Tiles' CIDs (`<the CID of a tile's manifest>.<base>`): tile origins where
// the runtime served here holds such an origin to that one tile, and the
// base host is not on the site of mu's own pages; nowhere else, and never a
// name that only looks like one (see the README).
const runtimeFile = name => readFileSync(join(publicDir, name), 'utf8')
const binds =
  runtimeFile('worker.js').includes('const NAMED_BY = cidLabelDigest(') &&
  runtimeFile('shuttle.js').includes("CID_NAMED ? 'worker.js?cid'") &&
  readFileSync(join(dockDir, 'dock.js'), 'utf8').includes(
    'payload: { generation: GENERATION, cid: true }',
  )
// mu's own pages: on mu.social, and on the hosts in src/config/brand.json.
// A base host on the site of one of them, or that is no host name, takes no
// tile's CID for a tile origin.
const {hosts} = JSON.parse(
  readFileSync(join(here, '..', '..', 'src', 'config', 'brand.json'), 'utf8'),
)
const baseName = base.toLowerCase().replace(/:\d+$/, '').replace(/\.+$/, '')
const onMuSite =
  !/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(baseName) ||
  ['mu.social', ...hosts].some(host => {
    const site = host.toLowerCase().split('.').slice(-2).join('.')
    return baseName === site || baseName.endsWith(`.${site}`)
  })
const takesCids = binds && !onMuSite
console.log(
  `# tiles' CIDs are ${takesCids ? '' : 'not '}tile origins under ${base}: ${
    !binds
      ? 'the runtime served here holds none to its tile'
      : onMuSite
        ? "it is on the site of mu's own pages"
        : 'it is on a site of its own'
  }`,
)
const B32 = 'abcdefghijklmnopqrstuvwxyz234567'
function b32(bytes) {
  let out = ''
  let bits = 0
  let value = 0
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      out += B32[(value >> bits) & 31]
    }
    value &= (1 << bits) - 1
  }
  return bits ? out + B32[(value << (5 - bits)) & 31] : out
}
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function b58(bytes) {
  let n = BigInt(`0x${Buffer.from(bytes).toString('hex')}`)
  let out = ''
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out
    n /= 58n
  }
  return out
}
const DIGEST = randomBytes(32)
const HEAD = [0x01, 0x71, 0x12, 0x20]
const cidOf = (codec = 0x71, hash = 0x12, digest = DIGEST, version = 0x01) =>
  `b${b32([version, codec, hash, digest.length, ...digest])}`
const CID = cidOf()
// The same bytes written another way: the bits left over at the end set.
const twin = (cid, bits) =>
  cid.slice(0, -1) + B32[B32.indexOf(cid.at(-1)) | bits]
const dockFor = host =>
  request(
    `load.${base}`,
    `${dockPath}?tile=${encodeURIComponent(`${host}${portPart}`)}`,
  )
// The runtime's worker on a name. Deployed, a name that DNS or TLS does not
// take (one the wildcard does not cover, or no host name at all) gets no
// runtime either.
const workerOn = host =>
  request(host, '/.well-known/web-tiles/worker.js').catch(e => ({
    status: 404,
    headers: {},
    unreachable: e.code || e.message,
  }))
// Whether a name is the CID of a tile's manifest, said here, and held to
// @dasl/tile-lexicon's rule where the lexicon has one (4.0 on).
for (const [what, label, isCid] of [
  ["a tile's CID", CID, true],
  ['a CID of raw bytes', cidOf(0x55), false],
  ['a CID of another codec (dag-pb)', cidOf(0x70), false],
  ["a CID of BDASL's BLAKE3", cidOf(0x71, 0x1e), false],
  [
    'a CID of a hash of another length',
    cidOf(0x71, 0x12, DIGEST.subarray(0, 31)),
    false,
  ],
  ['a CIDv2', cidOf(0x71, 0x12, DIGEST, 0x02), false],
  [
    'a CIDv0, as a host has it',
    b58([0x12, 0x20, ...DIGEST]).toLowerCase(),
    false,
  ],
  ['another spelling of the same CID', twin(CID, 1), false],
  ['another, of the same', twin(CID, 3), false],
  [
    'the same CID in base58btc',
    `z${b58([...HEAD, ...DIGEST])}`.toLowerCase(),
    false,
  ],
  [
    'the same CID in base16',
    `f${Buffer.from([...HEAD, ...DIGEST]).toString('hex')}`,
    false,
  ],
  ["the same CID with base32hex's prefix", `v${CID.slice(1)}`, false],
  ['the same CID with padding', `${CID}=`, false],
  ['one character short', CID.slice(0, 58), false],
  ['one character long', `${CID}a`, false],
  ['with no multibase', CID.slice(1), false],
  ['with a length byte that is not 32', `bafyreiz${CID.slice(8)}`, false],
  ...Array.from({length: 20}, (_, i) => {
    const cid = cidOf(0x71, 0x12, randomBytes(32))
    return i % 2
      ? [`a tile's CID (${cid})`, cid, true]
      : [`another spelling of one (${twin(cid, 2)})`, twin(cid, 2), false]
  }),
]) {
  if (cidLabelDigest) {
    check(
      `${what} is ${isCid ? '' : 'not '}a CID by @dasl/tile-lexicon's rule too`,
      Boolean(cidLabelDigest(label)) === isCid,
    )
  }
  const takes = takesCids && isCid
  const host = `${label}.${base}`
  const res = await workerOn(host)
  check(
    `${what} is ${takes ? '' : 'not '}a tile origin`,
    takes
      ? res.status === 200 &&
          res.headers['service-worker-allowed'] === '/' &&
          res.body === runtimeFile('worker.js')
      : res.status === 404 && !res.headers['service-worker-allowed'],
    res.unreachable || String(res.status),
  )
  const asked = await dockFor(host)
  check(
    `and is ${takes ? '' : 'not '}docked`,
    takes
      ? asked.status === 200 &&
          asked.headers['content-security-policy'] ===
            dockCSP(`${scheme}://${host}${portPart}`)
      : asked.status === 400,
    String(asked.status),
  )
}
// One label directly under the base host, and nowhere else.
for (const host of [
  `x.${CID}.${base}`,
  `${CID}.x.${base}`,
  `${CID}.load.${base}`,
  `${CID}.elsewhere.example`,
  `${CID}.${base}.`,
  CID,
]) {
  const res = await workerOn(host)
  check(
    `${host} is not a tile origin${res.unreachable ? ': unreachable' : ''}`,
    res.status === 404 && !res.headers['service-worker-allowed'],
    res.unreachable || String(res.status),
  )
  const asked = await dockFor(host)
  check('and is not docked', asked.status === 400, String(asked.status))
}
// A name in capitals is the same name: a browser writes it in lower case,
// and a client of its own that does not gets the same answer.
for (const host of [
  `${CID}.${base}`.toUpperCase(),
  `${CID.slice(0, 30).toUpperCase()}${CID.slice(30)}.${base}`,
]) {
  const res = await workerOn(host)
  check(
    `${host} is ${takesCids ? '' : 'not '}a tile origin, as in lower case`,
    takesCids ? res.status === 200 : res.status === 404,
    res.unreachable || String(res.status),
  )
  const asked = await dockFor(host)
  check(
    `and is ${takesCids ? '' : 'not '}docked`,
    takesCids
      ? asked.status === 200 &&
          asked.headers['content-security-policy'] ===
            dockCSP(`${scheme}://${CID}.${base}${portPart}`)
      : asked.status === 400,
    String(asked.status),
  )
}
// Nothing else a request says makes a difference either.
const cidHost = `${CID}.${base}`
for (const header of ['x-forwarded-host', 'cdn-host']) {
  const res = await request(cidHost, '/.well-known/web-tiles/worker.js', {
    headers: {[header]: `${CID}.tiles.example`},
  })
  check(
    `${header} from a client does not change what ${cidHost} is`,
    takesCids ? res.status === 200 : res.status === 404,
    String(res.status),
  )
}
const twice = await request(
  `load.${base}`,
  `${dockPath}?tile=${encodeURIComponent(`${cidHost}${portPart}`)}&tile=${encodeURIComponent(docked)}`,
)
check('the dock asked for two origins docks neither', twice.status === 400)

if (takesCids) {
  // A tile's CID gets what every tile origin gets, through the same code:
  // the runtime, whose worker holds it to that one tile (served too at the
  // address its shuttle registers it at), dead ends everywhere else, the
  // wipe for its own pages only, and the cookies that reach it expired.
  const apart = await request(cidHost, '/.well-known/web-tiles/worker.js?cid')
  check(
    "its worker at worker.js?cid is @dasl/tile-server's, which reads its name for the CID",
    apart.status === 200 &&
      apart.body === runtimeFile('worker.js') &&
      apart.headers['service-worker-allowed'] === '/' &&
      hasAll(apart.headers, runtimeHeaders).length === 0,
    String(apart.status),
  )
  for (const name of ['index.html', 'shuttle.js']) {
    const res = await request(cidHost, `/.well-known/web-tiles/${name}`)
    check(
      `its ${name} is @dasl/tile-server's, with every runtime policy header`,
      res.status === 200 &&
        res.body === runtimeFile(name) &&
        hasAll(res.headers, runtimeHeaders).length === 0,
      String(res.status),
    )
  }
  for (const path of [
    '/',
    '/index.html',
    '/.well-known/web-tiles/nope.js',
    '/.well-known/web-tiles/host/',
    '/host/',
  ]) {
    const res = await request(cidHost, path)
    const miss = hasAll(res.headers, deadHeaders)
    check(
      `${path} on it is a dead end`,
      res.status === 404 && miss.length === 0,
      `${res.status} ${miss.join(', ')}`,
    )
  }
  const cidPost = await request(cidHost, '/.well-known/web-tiles/', {
    method: 'POST',
  })
  check('POST to its runtime is refused', cidPost.status === 405)
  await onlyFiles(cidHost, '/.well-known/web-tiles/')
  const own = await request(cidHost, wipePath, {
    headers: {'sec-fetch-site': 'same-origin'},
  })
  check(
    'it answers the wipe with Clear-Site-Data, to a page of its own',
    own.status === 200 &&
      own.headers['clear-site-data'] === wipeHeaders['clear-site-data'],
    `${own.status} ${own.headers['clear-site-data']}`,
  )
  for (const from of [undefined, 'same-site', 'cross-site', 'none']) {
    const res = await request(cidHost, wipePath, {
      headers: from ? {'sec-fetch-site': from} : {},
    })
    check(
      `and to nothing else (Sec-Fetch-Site: ${from ?? 'not said'})`,
      res.status === 403 && !res.headers['clear-site-data'],
      `${res.status} ${res.headers['clear-site-data']}`,
    )
  }
  const jarred = await request(cidHost, '/.well-known/web-tiles/', {
    headers: {cookie: 'kept=1'},
  })
  const cidSet = [jarred.headers['set-cookie'] || []].flat()
  if (cidSet.length) {
    check(
      'cookies that reach it are expired, for the base host and host-only',
      cidSet.some(c => /; Domain=/i.test(c) && c.startsWith('kept=;')) &&
        cidSet.some(c => !/Domain=/i.test(c) && c.startsWith('kept=;')) &&
        cidSet.every(
          c =>
            !/Domain=/i.test(c) || c.toLowerCase().endsWith(`domain=${domain}`),
        ),
      `${cidSet.length} Set-Cookie`,
    )
  } else {
    note(
      'cookies that reach it are expired',
      false,
      'no Set-Cookie came back (see "cookies that arrive are expired")',
    )
  }
} else {
  // Where a tile's CID is no tile origin, nothing of one is served on it.
  for (const path of [
    '/.well-known/web-tiles/',
    '/.well-known/web-tiles/shuttle.js',
    '/.well-known/web-tiles/worker.js?cid',
  ]) {
    const res = await request(cidHost, path)
    check(
      `${path} on ${cidHost} is not served`,
      res.status === 404 && !res.headers['service-worker-allowed'],
      String(res.status),
    )
  }
  const res = await request(cidHost, wipePath, {
    headers: {'sec-fetch-site': 'same-origin'},
  })
  check(
    `${cidHost} clears nothing`,
    res.status === 404 && !res.headers['clear-site-data'],
    `${res.status} ${res.headers['clear-site-data']}`,
  )
}

// Wiping: a tile origin can be emptied, by a page of its own, and nothing
// else can.
const wipe = await request(origin, wipePath, {
  headers: {'sec-fetch-site': 'same-origin'},
})
check(
  'a tile origin answers the wipe with Clear-Site-Data, to a page of its own',
  wipe.status === 200 &&
    wipe.headers['clear-site-data'] === wipeHeaders['clear-site-data'],
  `${wipe.status} ${wipe.headers['clear-site-data']}`,
)
for (const from of [undefined, 'same-site', 'cross-site', 'none']) {
  const res = await request(origin, wipePath, {
    headers: from ? {'sec-fetch-site': from} : {},
  })
  check(
    `and to nothing else (Sec-Fetch-Site: ${from ?? 'not said'})`,
    res.status === 403 && !res.headers['clear-site-data'],
    `${res.status} ${res.headers['clear-site-data']}`,
  )
}
for (const host of [base, `load.${base}`]) {
  const res = await request(host, wipePath)
  check(
    `${host} clears nothing`,
    !res.headers['clear-site-data'],
    String(res.headers['clear-site-data']),
  )
}

const notOnTile = await request(origin, dockPath)
check('a tile origin has no dock', notOnTile.status === 404, String(notOnTile.status))

if (failures) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nall good')
