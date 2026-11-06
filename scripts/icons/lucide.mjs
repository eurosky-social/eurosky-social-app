import fs from 'node:fs/promises'
import {createRequire} from 'node:module'
import path from 'node:path'

import svgpath from 'svgpath'
import {optimize} from 'svgo'

import svgoConfig from '../../svgo.config.mjs'

const require = createRequire(import.meta.url)
let pathKit

/** Uses the font compiler's geometry engine to outline strokes without changing their appearance. */
async function loadPathKit() {
  pathKit ??= (async () => {
    const nanoRequire = createRequire(
      require.resolve('react-native-nano-icons/package.json'),
    )
    const entry = nanoRequire.resolve('pathkit-wasm/bin/pathkit.js')
    const init = nanoRequire(entry)({
      wasmBinary: await fs.readFile(
        path.join(path.dirname(entry), 'pathkit.wasm'),
      ),
    })
    return typeof init?.ready === 'function' ? init.ready() : init
  })()
  return pathKit
}

/** Stabilizes SVG optimization so import and codegen checks agree byte for byte. */
export function optimizeIcon(svg) {
  for (let pass = 0; pass < 10; pass++) {
    const next = optimize(svg, svgoConfig).data
    if (next === svg) return svg
    svg = next
  }
  throw new Error('SVG optimization did not stabilize')
}

/** Resolves a pinned local SVG; generation never fetches artwork from the network. */
export function sourcePath(entry, repoRoot) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.icon)) {
    throw new Error(`Invalid Lucide icon slug: ${entry.icon}`)
  }
  if (!['outline', 'bold', 'filled'].includes(entry.variant)) {
    throw new Error(`Unsupported Lucide variant: ${entry.variant}`)
  }
  if (entry.source === 'custom') {
    return path.join(repoRoot, 'scripts/icons/custom', `${entry.icon}.svg`)
  }
  if (entry.source && entry.source !== 'lab') {
    throw new Error(`Unsupported Lucide source: ${entry.source}`)
  }
  if (entry.source === 'lab' && entry.variant === 'filled') {
    throw new Error('Filled Lab icons need an explicitly reviewed source')
  }
  const pkg =
    entry.source === 'lab'
      ? '@lucide/lab'
      : entry.variant === 'filled'
        ? '@filled-lucide/static'
        : 'lucide-static'
  const packageRoot = path.dirname(require.resolve(`${pkg}/package.json`))
  return path.join(packageRoot, 'icons', `${entry.icon}.svg`)
}

/** Converts Lucide's basic shapes into paths while retaining open stroke contours. */
function outlinePaths(svg) {
  const paths = []
  optimize(svg, {
    plugins: [
      {name: 'convertShapeToPath', params: {convertArcs: true}},
      {
        name: 'collectLucidePaths',
        fn() {
          return {
            element: {
              enter(node) {
                /* SVGO leaves rounded rectangles intact; preserve their exact arc radii. */
                if (node.name === 'rect') {
                  const {x = 0, y = 0, width, height, rx, ry} = node.attributes
                  const left = Number(x)
                  const top = Number(y)
                  const right = left + Number(width)
                  const bottom = top + Number(height)
                  const radiusX = Math.min(
                    Number(rx ?? ry ?? 0),
                    Number(width) / 2,
                  )
                  const radiusY = Math.min(
                    Number(ry ?? rx ?? 0),
                    Number(height) / 2,
                  )
                  paths.push(
                    `M${left + radiusX} ${top}H${right - radiusX}A${radiusX} ${radiusY} 0 0 1 ${right} ${top + radiusY}V${bottom - radiusY}A${radiusX} ${radiusY} 0 0 1 ${right - radiusX} ${bottom}H${left + radiusX}A${radiusX} ${radiusY} 0 0 1 ${left} ${bottom - radiusY}V${top + radiusY}A${radiusX} ${radiusY} 0 0 1 ${left + radiusX} ${top}Z`,
                  )
                  return
                }
                if (!['svg', 'path'].includes(node.name)) {
                  throw new Error(
                    `Unsupported Lucide source element: ${node.name}`,
                  )
                }
                if (node.attributes.transform)
                  throw new Error('Unexpected source transform')
                if (
                  node.name === 'svg' &&
                  node.attributes.viewBox !== '0 0 24 24'
                ) {
                  throw new Error('Lucide sources must use a 24x24 grid')
                }
                if (node.name === 'path') paths.push(node.attributes.d)
              },
            },
          }
        },
      },
    ],
  })
  if (!paths.length) throw new Error('Lucide source has no paths')
  return paths
}

/** Produces monochrome, even-odd geometry compatible with app SVGs and native fonts. */
export async function iconSvg(entry, repoRoot, {size = 24} = {}) {
  const svg = await fs.readFile(sourcePath(entry, repoRoot), 'utf8')
  let artwork
  if (entry.variant === 'filled') {
    const paths = [...svg.matchAll(/<path\s+d="([^"]+)"\s*\/?\s*>/g)]
    if (paths.length !== 1 || !svg.includes('fill-rule="evenodd"')) {
      throw new Error(`${entry.icon}: filled artwork must be one even-odd path`)
    }
    artwork = paths[0][1]
  } else {
    const PathKit = await loadPathKit()
    /* PathKit's stroker has a fixed tolerance in source units. Work at 64x so
     * small circles and curved strokes keep Lucide's shape at UI sizes. */
    const geometryScale = 64
    let combined
    try {
      for (const d of outlinePaths(svg)) {
        /* PathKit needs separators between adjacent SVG arc flags. */
        const parsed = svgpath(d).scale(geometryScale).unarc()
        if (parsed.err) throw new Error(`${entry.icon}: ${parsed.err}`)
        const stroked = PathKit.FromSVGString(
          parsed.segments.map(segment => segment.join(' ')).join(' '),
        )
        if (!stroked) throw new Error(`${entry.icon}: invalid path`)
        try {
          if (
            !stroked.stroke({
              width: (entry.variant === 'bold' ? 3 : 2) * geometryScale,
              cap: PathKit.StrokeCap.ROUND,
              join: PathKit.StrokeJoin.ROUND,
              miter_limit: 4,
            })
          )
            throw new Error(`${entry.icon}: could not outline stroke`)
          stroked.simplify()
          if (!combined) {
            combined = PathKit.NewPath(stroked)
          } else {
            const union = PathKit.MakeFromOp(
              combined,
              stroked,
              PathKit.PathOp.UNION,
            )
            if (!union)
              throw new Error(`${entry.icon}: could not merge strokes`)
            combined.delete()
            combined = union
          }
        } finally {
          stroked.delete()
        }
      }
      combined.simplify()
      combined.transform(
        1 / geometryScale,
        0,
        0,
        0,
        1 / geometryScale,
        0,
        0,
        0,
        1,
      )
      artwork = combined.toSVGString()
    } finally {
      combined?.delete()
    }
  }
  const backing = entry.whiteBacking
    ? '<path fill="#fff" d="M5 12a7 7 0 1 0 14 0 7 7 0 1 0-14 0Z"/>'
    : ''
  const mirror = entry.mirror ? ' translate(24 0) scale(-1 1)' : ''
  return optimizeIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="currentColor" fill-rule="evenodd"><g transform="scale(${size / 24})${mirror}">${backing}<path d="${artwork}"/></g></svg>`,
  )
}
