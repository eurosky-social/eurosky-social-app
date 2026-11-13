/**
 * Checks a running tile loading server (services/tileLoader/bunny/index.ts)
 * against what @dasl/tile-server and @dasl/tile-lexicon say it must do.
 *
 *   BASE_HOST=localhost deno run --allow-net --allow-env services/tileLoader/bunny/index.ts
 *   node services/tileLoader/test.mjs http://localhost:8080 localhost
 *   node services/tileLoader/test.mjs https://mu.social mu.social      # deployed
 *
 * First argument: scheme and port to reach it on (the host part is replaced
 * by load.<base> and tile origins); second: the base host. Requests go to
 * the address in the first argument with the Host header set, so no DNS for
 * the made-up names is needed locally.
 */
import {readdirSync, readFileSync} from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const reach = new URL(process.argv[2] || 'http://localhost:8080')
const base = process.argv[3] || 'localhost'
const local = base.endsWith('localhost')
const here = dirname(fileURLToPath(import.meta.url))
const modules = join(here, '..', '..', 'node_modules', '@dasl')
const {runtimeHeaders, deadHeaders} = await import(
  join(modules, 'tile-lexicon', 'dist', 'index.js')
)
const publicDir = join(modules, 'tile-server', 'public')

/** GET/HEAD a path on a named host; locally the name only goes in Host. */
function request(host, path, {method = 'GET', headers = {}} = {}) {
  const lib = reach.protocol === 'https:' ? https : http
  const port = reach.port ? `:${reach.port}` : ''
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        host: local ? '127.0.0.1' : host,
        port: reach.port || (reach.protocol === 'https:' ? 443 : 80),
        servername: host,
        path,
        method,
        headers: {host: `${host}${port}`, ...headers},
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
const hasAll = (got, want) =>
  Object.entries(want)
    .filter(([k, v]) => got[k] !== v)
    .map(([k]) => k)

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
check(
  'redirect is not cacheable',
  a.headers['cache-control'] === 'no-store',
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
check(
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

for (const host of [
  `www.${base}`,
  `abc.${base}`,
  `${'a'.repeat(21)}.${base}`,
  `${'a'.repeat(19)}1.${base}`,
  `x.${origin}`,
]) {
  const res = await request(host, '/.well-known/web-tiles/')
  check(
    `${host} is not a tile origin: no runtime`,
    res.status === 404 && !res.body.includes('shuttle'),
    String(res.status),
  )
}

if (failures) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nall good')
