// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path')
const {getSentryExpoConfig} = require('@sentry/react-native/metro')
const cfg = getSentryExpoConfig(__dirname)

// jose ships a Node build (imports node:buffer/node:crypto) and a browser build
// (Web Crypto). React Native has no Node core modules, so on native we resolve
// jose to its browser build. jose is only reachable via the web-only OAuth flow
// (src/state/session/oauth-web-client.ts), which never executes on native, so
// this is dead code there - the redirect just keeps the native bundle resolvable.
const joseBrowserEntry = path.resolve(
  path.dirname(require.resolve('jose')),
  '../../browser/index.js',
)

// inject `.e2e.ts` and `.e2e.tsx` into the sourceExts when running tests
cfg.resolver.sourceExts = process.env.RN_SRC_EXT
  ? process.env.RN_SRC_EXT.split(',').concat(cfg.resolver.sourceExts)
  : cfg.resolver.sourceExts

if (cfg.resolver.resolveRequest) {
  throw Error('Update this override because it is conflicting now.')
}

if (process.env.BSKY_PROFILE) {
  cfg.cacheVersion += ':PROFILE'
}

cfg.resolver.assetExts = [...cfg.resolver.assetExts, 'woff2']

cfg.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform !== 'web' &&
    (moduleName === 'jose' || moduleName.startsWith('jose/'))
  ) {
    return {type: 'sourceFile', filePath: joseBrowserEntry}
  }
  if (process.env.BSKY_PROFILE) {
    if (moduleName.endsWith('ReactNativeRenderer-prod')) {
      return context.resolveRequest(
        context,
        moduleName.replace('-prod', '-profiling'),
        platform,
      )
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

cfg.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
    inlineRequires: true,
  },
})

module.exports = cfg
