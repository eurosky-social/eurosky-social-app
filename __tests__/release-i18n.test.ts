/* eslint-disable import/no-nodejs-modules -- Build-pipeline tests intentionally use Node subprocesses and filesystem access. */
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')

/** Run outside Jest's development Babel/runtime so production fallbacks are absent. */
function runNode(script: string) {
  return execFileSync(process.execPath, ['-e', script], {
    cwd: root,
    env: {...process.env, NODE_ENV: 'production'},
    encoding: 'utf8',
  }).trim()
}

describe('release catalog verification', () => {
  it('checks the production IDs from the actual announcement, including the screenshot IDs', () => {
    const ids = JSON.parse(
      runNode(`
        const {announcementMessageIds} = require('./scripts/check-release-i18n.cjs')
        console.log(JSON.stringify([...announcementMessageIds()]))
      `),
    )
    expect(ids).toEqual(
      expect.arrayContaining(['3cV6IT', 'HdT3r4', 'hmIfWE', 'omHhYx']),
    )
    // Includes the error message and the previously existing dismiss button.
    expect(ids).toHaveLength(6)
  })

  it('rejects stale, empty, uncompiled and ID-only catalogs', () => {
    expect(
      runNode(`
        const {assertMessages} = require('./scripts/check-release-i18n.cjs')
        for (const messages of [{}, {id: []}, {id: 'Hello'}, {id: ['id']}]) {
          let rejected = false
          try { assertMessages('en', messages, ['id']) }
          catch { rejected = true }
          if (!rejected) process.exit(1)
        }
        console.log('ok')
      `),
    ).toBe('ok')
  })

  it('accepts compiled translations and English fallbacks, including ICU messages', () => {
    expect(
      runNode(`
        const {assertMessages} = require('./scripts/check-release-i18n.cjs')
        const messages = {
          title: ['Try Mu’s For You feed'],
          dismiss: ['Nein danke'],
          greeting: ['Hello ', ['name']],
        }
        assertMessages('de', messages, Object.keys(messages))
        console.log('ok')
      `),
    ).toBe('ok')
  })

  it('runs verification after extraction and compilation in CI and release builds', () => {
    const pkg = JSON.parse(
      readFileSync(path.join(root, 'package.json'), 'utf8'),
    ) as {scripts: Record<string, string>}
    expect(pkg.scripts['intl:build']).toBe(
      'pnpm intl:extract:all && pnpm intl:compile && pnpm intl:check',
    )
  })
})

describe('release translation preparation', () => {
  it('extracts new strings as well as compiling existing catalogs from the repo root', () => {
    const result = JSON.parse(
      runNode(`
        const childProcess = require('node:child_process')
        const calls = []
        childProcess.execFileSync = (...args) => calls.push(args)
        const {prepareReleaseI18n} = require('./scripts/prepare-release-i18n.cjs')
        prepareReleaseI18n('production')
        console.log(JSON.stringify(calls))
      `),
    )
    expect(result).toEqual([
      ['pnpm', ['intl:build'], {cwd: root, stdio: 'inherit'}],
    ])
  })

  it('does not run extraction during development', () => {
    expect(
      runNode(`
        const childProcess = require('node:child_process')
        childProcess.execFileSync = () => { throw new Error('must not run') }
        const {prepareReleaseI18n} = require('./scripts/prepare-release-i18n.cjs')
        prepareReleaseI18n('development')
        prepareReleaseI18n('test')
        console.log('ok')
      `),
    ).toBe('ok')
  })

  it('aborts bundling if translation preparation fails', () => {
    expect(
      runNode(`
        const childProcess = require('node:child_process')
        const failure = new Error('extraction failed')
        childProcess.execFileSync = () => { throw failure }
        const {prepareReleaseI18n} = require('./scripts/prepare-release-i18n.cjs')
        try {
          prepareReleaseI18n('production')
          process.exit(1)
        } catch (error) {
          if (error.cause !== failure) process.exit(2)
          console.log(error.message)
        }
      `),
    ).toContain('Release stopped: could not extract and compile translations.')
  })

  it('protects direct native/OTA and web builds, not only the release wrappers', () => {
    const metro = readFileSync(path.join(root, 'metro.config.ts'), 'utf8')
    const webpack = readFileSync(path.join(root, 'webpack.config.js'), 'utf8')
    expect(metro).toContain('prepareReleaseI18n(process.env.NODE_ENV)')
    expect(
      metro.indexOf('prepareReleaseI18n(process.env.NODE_ENV)'),
    ).toBeLessThan(metro.indexOf('const config = getSentryExpoConfig'))
    expect(webpack).toContain(
      'prepareReleaseI18n(env.mode || process.env.NODE_ENV)',
    )
    expect(
      webpack.indexOf('prepareReleaseI18n(env.mode || process.env.NODE_ENV)'),
    ).toBeLessThan(webpack.indexOf('await createExpoWebpackConfigAsync'))
  })
})
