import {type Client} from '@atproto/lex'
import {type OAuthSession} from '@atproto/oauth-client-browser'

import {BSKY_SERVICE} from '#/lib/constants'
import {logger} from '#/logger'
import {prefetchAgeAssuranceServerData} from '#/ageAssurance/data'
import {com} from '#/lexicons'
import {configureModerationForAccount} from './moderation'
import {describeOAuthError} from './oauth-logging'
import {getWebOAuthClient} from './oauth-web-client'
import {buildClientSurfaces, type OAuthSessionBundle} from './session-core'
import {type SessionAccount} from './types'

const OAUTH_RESTORE_TIMEOUT_MS = 10_000

/** Build the same client bundle used by password sessions over an OAuth core. */
export async function createOAuthSessionBundle(
  session: OAuthSession,
): Promise<{account: SessionAccount; bundle: OAuthSessionBundle}> {
  const bundle: OAuthSessionBundle = {
    session,
    ...buildClientSurfaces(session),
    service: new URL(session.serverMetadata.issuer),
  }
  const account = await oauthSessionToSessionAccountOrThrow(
    bundle.pdsClient,
    session,
  )

  configureModerationForAccount(bundle, account)
  await prefetchAgeAssuranceServerData({
    appviewClient: bundle.appviewClient,
    accountClient: bundle.pdsClient,
  })

  return {account, bundle}
}

export async function resumeOAuthSessionBundle(account: SessionAccount) {
  const client = getWebOAuthClient()
  let session: OAuthSession
  try {
    session = await withTimeout(
      client.restore(account.did),
      'OAuth session restore timed out',
    )
  } catch (e) {
    /*
     * No DID or raw error: this reaches the live Sentry transport. Raw OAuth
     * errors may carry request URLs or headers.
     */
    logger.error(
      'resumeOAuthSessionBundle: restore failed',
      describeOAuthError(e),
    )
    throw e
  }
  return createOAuthSessionBundle(session)
}

export async function oauthSessionToSessionAccountOrThrow(
  pdsClient: Client,
  session: OAuthSession,
): Promise<SessionAccount> {
  const account = await oauthSessionToSessionAccount(pdsClient, session)
  if (!account) {
    throw Error('Expected an active OAuth session')
  }
  return account
}

export async function oauthSessionToSessionAccount(
  pdsClient: Client,
  session: OAuthSession,
): Promise<SessionAccount | undefined> {
  try {
    const [data, tokenInfo] = await Promise.all([
      withTimeout(
        pdsClient.call(com.atproto.server.getSession, {}),
        'getSession timed out',
      ),
      withTimeout(session.getTokenInfo(false), 'getTokenInfo timed out'),
    ])
    const service = new URL(session.serverMetadata.issuer).toString()
    return {
      service,
      did: session.did,
      handle: data.handle,
      email: data.email,
      emailConfirmed: data.emailConfirmed,
      emailAuthFactor: data.emailAuthFactor,
      active: data.active,
      status: data.status,
      pdsUrl: tokenInfo.aud,
      isSelfHosted: !service.startsWith(BSKY_SERVICE),
      isOauthSession: true,
    }
  } catch (e) {
    logger.error(
      'oauthSessionToSessionAccount: snapshot failed',
      describeOAuthError(e),
    )
    return undefined
  }
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), OAUTH_RESTORE_TIMEOUT_MS),
    ),
  ])
}
