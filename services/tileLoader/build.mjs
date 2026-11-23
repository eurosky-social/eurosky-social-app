/**
 * Generates services/tileLoader/bunny/index.ts: the tile loading server as a
 * single Bunny Edge Script, with the loader runtime (@dasl/tile-server's
 * public/ files) and the tile-origin policy (@dasl/tile-lexicon) inlined, so
 * the script can be pasted into the Bunny dashboard as is.
 *
 *   node services/tileLoader/build.mjs
 *
 * Run it again whenever @dasl/tile-server or @dasl/tile-lexicon is bumped:
 * the runtime served here has to be the one the app's @dasl/tile-loader
 * expects. And when the hosts in src/config/brand.json change: no tile's
 * CID is a tile origin on their sites. `--check` exits non-zero if the
 * committed script is stale.
 */
import {createHash} from 'node:crypto'
import {readdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
// The packages export no package.json, so they are read from node_modules.
const modules = join(here, '..', '..', 'node_modules', '@dasl')
const pkg = name =>
  JSON.parse(readFileSync(join(modules, name, 'package.json'), 'utf8'))
const serverDir = join(modules, 'tile-server')
const serverPkg = pkg('tile-server')
const lexiconPkg = pkg('tile-lexicon')
const {
  runtimeHeaders,
  deadHeaders,
  dockHeaders,
  dockPath,
  wipeHeaders,
  wipePath,
} = await import('@dasl/tile-lexicon')
const {tileHostHeaders} = await import('@dasl/tile-host')
const hostPkg = pkg('tile-host')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
}
const TYPES_CSS = {...TYPES, '.css': 'text/css; charset=utf-8'}
function readFiles(dir) {
  const files = {}
  for (const name of readdirSync(dir).sort()) {
    const type = TYPES_CSS[name.slice(name.lastIndexOf('.'))]
    if (!type) throw new Error(`no content type for ${name}`)
    const body = readFileSync(join(dir, name), 'utf8')
    files[name] = {
      type,
      etag: `"${createHash('sha256').update(body).digest('hex').slice(0, 16)}"`,
      body,
    }
  }
  return files
}
const files = readFiles(join(serverDir, 'public'))
const hostFiles = readFiles(join(modules, 'tile-host', 'public'))
// The dock: its files, and its headers for an origin filled in at run time.
const dockFiles = readFiles(join(serverDir, 'dock'))
const DOCK_ORIGIN = 'https://tile-origin.invalid'
// frame-src is filled in at run time, from the base host.
const hostHeaders = tileHostHeaders({frameSrc: '__FRAME_SRC__'})
// Whether a tile's CID can name a tile origin: only where the runtime holds
// such an origin to the one tile it names, as @dasl/tile-server's does from
// 4.0 on. Its worker reads its own name for the CID, its shuttle registers
// that worker apart, and its dock says so to the loader (cid: true in its
// ready message). Built from an older one, the script takes none.
const cidOrigins =
  files['worker.js'].body.includes('const NAMED_BY = cidLabelDigest(') &&
  files['shuttle.js'].body.includes("CID_NAMED ? 'worker.js?cid'") &&
  dockFiles['dock.js'].body.includes(
    'payload: { generation: GENERATION, cid: true }',
  )
// The hosts of mu's own pages, whose sites take no CID for a tile origin
// (the template adds mu.social whatever this says).
const brand = JSON.parse(
  readFileSync(join(here, '..', '..', 'src', 'config', 'brand.json'), 'utf8'),
)
const appHosts = brand.hosts
if (
  !Array.isArray(appHosts) ||
  !appHosts.every(host => typeof host === 'string')
) {
  throw new Error('src/config/brand.json has no list of hosts')
}

const template = readFileSync(join(here, 'template.ts'), 'utf8')
const out = template
  .replace(
    '__VERSIONS__',
    `@dasl/tile-server ${serverPkg.version}, @dasl/tile-lexicon ${lexiconPkg.version}, @dasl/tile-host ${hostPkg.version}`,
  )
  .replace('__RUNTIME_HEADERS__', JSON.stringify(runtimeHeaders, null, 2))
  .replace('__DEAD_HEADERS__', JSON.stringify(deadHeaders, null, 2))
  .replace('__FILES__', () => JSON.stringify(files, null, 2))
  .replace('__WIPE_PATH__', wipePath)
  .replace('__WIPE_HEADERS__', JSON.stringify(wipeHeaders, null, 2))
  .replace('__DOCK_PATH__', dockPath)
  .replace('__DOCK_ORIGIN__', DOCK_ORIGIN)
  .replace('__DOCK_HEADERS__', JSON.stringify(dockHeaders(DOCK_ORIGIN), null, 2))
  .replace('__DOCK_FILES__', () => JSON.stringify(dockFiles, null, 2))
  .replace('__HOST_HEADERS__', JSON.stringify(hostHeaders, null, 2))
  .replace('__HOST_FILES__', () => JSON.stringify(hostFiles, null, 2))
  .replace('__CID_ORIGINS__', String(cidOrigins))
  .replace('__APP_HOSTS__', JSON.stringify(appHosts))

const target = join(here, 'bunny', 'index.ts')
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== out) {
    console.error(
      'services/tileLoader/bunny/index.ts is stale: run node services/tileLoader/build.mjs',
    )
    process.exit(1)
  }
  console.log('up to date')
} else {
  writeFileSync(target, out)
  const cids = cidOrigins
    ? `tiles' CIDs are tile origins, but not on the sites of ${[...new Set(['mu.social', ...appHosts])].join(', ')}`
    : "tiles' CIDs are not tile origins: the runtime holds none to its tile"
  console.log(
    `wrote ${target} (${Object.keys(files).join(', ')}; ${serverPkg.version}; ${cids})`,
  )
}
