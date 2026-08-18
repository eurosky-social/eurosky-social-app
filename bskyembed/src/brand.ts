import config from '../../src/config/brand.json'

const appHost = config.hosts[0]

/** Brand and service values shared by the standalone embed application. */
export const BRAND = {
  name: config.name,
  appHost,
  appUrl: `https://${appHost}`,
  publicApi: config.services.publicApi,
  embedService: config.services.embed,
  ogCardService: config.services.ogCard,
} as const

/** Accept first-party links while retaining compatibility with bsky.app URLs. */
export function isSupportedAppHost(hostname: string) {
  return hostname === BRAND.appHost || hostname === 'bsky.app'
}

export function isSupportedAppUrl(url: string) {
  return (
    url.startsWith(BRAND.appUrl) ||
    url.startsWith('https://bsky.app') ||
    url.startsWith('https://go.bsky.app')
  )
}
