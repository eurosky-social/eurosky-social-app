const {execFileSync} = require('node:child_process')
const path = require('node:path')

/**
 * Run at the bundler boundary, not just in release wrappers: GUI Xcode archives,
 * direct Gradle builds and EAS updates can all bypass those wrappers. Lingui
 * strips English defaults in production, so stale catalogs expose hashed IDs.
 */
function prepareReleaseI18n(mode) {
  if (mode !== 'production') return

  try {
    execFileSync('pnpm', ['intl:build'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
    })
  } catch (cause) {
    throw new Error(
      'Release stopped: could not extract and compile translations. Ensure pnpm is on the build PATH and fix any intl:build errors before retrying.',
      {cause},
    )
  }
}

module.exports = {prepareReleaseI18n}
