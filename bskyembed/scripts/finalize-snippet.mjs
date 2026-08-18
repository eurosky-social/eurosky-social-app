import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const generatedPath = path.join(root, 'dist/brand.generated.js')
const embedPath = path.join(root, 'dist/embed.js')

const stripUseStrict = value => value.replace(/^"use strict";\s*/, '')
const generated = stripUseStrict(fs.readFileSync(generatedPath, 'utf8'))
const embed = stripUseStrict(fs.readFileSync(embedPath, 'utf8'))
fs.writeFileSync(embedPath, `"use strict";\n${generated}\n${embed}`)
fs.rmSync(generatedPath)
