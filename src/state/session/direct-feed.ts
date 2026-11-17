import {type Agent} from '@atproto/lex'

import {createLexClient} from '#/lib/lexClient'
import {com} from '#/lexicons'

const METHOD = 'app.bsky.feed.getFeed'
const TOKEN_TTL_SECONDS = 300

/**
 * Bypass the PDS's special getFeed handler, but keep every other request on
 * the session. Tokens and in-flight minting are bundle-local. Enabled by the
 * EXPO_PUBLIC_DIRECT_FEED_READS build flag.
 */
export function withDirectFeed(
  agent: Agent,
  appView: {url: string; did: string},
  fetcher: typeof fetch,
): Agent {
  const pdsClient = createLexClient(agent, {appLabelers: null})
  let cached: {token: string; expiresAt: number} | undefined
  let pending: Promise<string> | undefined

  async function getToken(): Promise<string> {
    if (cached && cached.expiresAt > Date.now() + 30_000) {
      return cached.token
    }
    if (!pending) {
      const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
      pending = pdsClient
        .call(com.atproto.server.getServiceAuth, {
          aud: appView.did,
          lxm: METHOD,
          exp,
        })
        .then(({token}) => {
          cached = {token, expiresAt: exp * 1000}
          return token
        })
        .finally(() => {
          pending = undefined
        })
    }
    return pending
  }

  return {
    get did() {
      return agent.did
    },
    async fetchHandler(path, init) {
      const headers = new Headers(init.headers)
      if (
        !agent.did ||
        (init.method ?? 'GET') !== 'GET' ||
        path.split('?')[0] !== `/xrpc/${METHOD}` ||
        headers.get('atproto-proxy') !== `${appView.did}#bsky_appview`
      ) {
        return agent.fetchHandler(path, init)
      }

      init.signal?.throwIfAborted()
      const token = await getToken()
      init.signal?.throwIfAborted()
      headers.delete('atproto-proxy')
      headers.delete('dpop')
      headers.set('authorization', `Bearer ${token}`)
      const response = await fetcher(new URL(path, appView.url), {
        ...init,
        headers,
        credentials: 'omit',
      })
      if (response.status === 401) {
        cached = undefined
      }
      return response
    },
  }
}
