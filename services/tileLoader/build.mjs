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
 * expects. `--check` exits non-zero if the committed script is stale.
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
const {runtimeHeaders, deadHeaders} = await import('@dasl/tile-lexicon')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
}
const files = {}
for (const name of readdirSync(join(serverDir, 'public')).sort()) {
  const type = TYPES[name.slice(name.lastIndexOf('.'))]
  if (!type) throw new Error(`no content type for runtime file ${name}`)
  const body = readFileSync(join(serverDir, 'public', name), 'utf8')
  files[name] = {
    type,
    etag: `"${createHash('sha256').update(body).digest('hex').slice(0, 16)}"`,
    body,
  }
}

const template = readFileSync(join(here, 'template.ts'), 'utf8')
const out = template
  .replace(
    '__VERSIONS__',
    `@dasl/tile-server ${serverPkg.version}, @dasl/tile-lexicon ${lexiconPkg.version}`,
  )
  .replace('__RUNTIME_HEADERS__', JSON.stringify(runtimeHeaders, null, 2))
  .replace('__DEAD_HEADERS__', JSON.stringify(deadHeaders, null, 2))
  .replace('__FILES__', () => JSON.stringify(files, null, 2))

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
  console.log(
    `wrote ${target} (${Object.keys(files).join(', ')}; ${serverPkg.version})`,
  )
}
