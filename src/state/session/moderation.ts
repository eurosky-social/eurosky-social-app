import {Client} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'
import {api} from '@bsky/sdk'

import {EUROSKY_LABELER_DID, IS_TEST_USER} from '#/lib/constants'
import {com} from '#/lexicons'
import {account as accountStorage} from '#/storage'
import {
  configureAdditionalModerationAuthorities,
  configureGlobalAppLabelers,
} from './additional-moderation-authorities'
import {type SessionAccount} from './types'

/** The moderation surface of a session bundle. */
type ModerationSession = {appviewClient: Client; chatClient: Client}

/**
 * Cache an account's subscribed labeler DIDs. Called on every preferences
 * fetch, so the cache is eventually consistent with the server.
 */
export function saveLabelers(did: string, value: string[]) {
  accountStorage.set([did, 'labelers'], value)
}

/**
 * Read the cached labeler DIDs for an account, or `undefined` if none have
 * been cached yet (first session on this device) or the entry is unreadable.
 */
export function readLabelers(did: string): string[] | undefined {
  try {
    return accountStorage.get([did, 'labelers'])
  } catch {
    /* a corrupt entry fails JSON.parse inside Storage.get; treat as no cache */
    return undefined
  }
}

/**
 * Apply an account's labeler subscriptions without duplicating the globally
 * redacted app moderation authorities.
 *
 * App labelers already flow through the global `Client.appLabelers`, which lex
 * emits with a `;redact` suffix. Listing them per-instance would add a second,
 * non-redacting entry for the same authority:
 * lex collects the two lists into a `Set` keyed on the suffixed string, so
 * neither dedupes against the other.
 *
 * Appview and chat both take subscriptions. The PDS suppresses labelers because
 * repo and identity requests do not hydrate moderated content (see clients.ts).
 */
export function applyLabelersToClient(
  client: Client,
  subscribedDids: string[],
) {
  client.setLabelers(
    subscribedDids.filter(
      did => !Client.appLabelers.includes(did as DidString),
    ) as DidString[],
  )
}

export function configureModerationForGuest() {
  switchToDefaultAppLabelers()
  configureAdditionalModerationAuthorities()
}

/**
 * Configure global app labelers and the account's cached labeler
 * subscriptions. Fully synchronous so session setup can apply labeler headers
 * in the same tick, before any request goes out.
 */
export function configureModerationForAccount(
  bundle: ModerationSession,
  account: SessionAccount,
) {
  switchToDefaultAppLabelers()
  configureAdditionalModerationAuthorities()
  if (IS_TEST_USER(account.handle)) {
    // Test accounts may briefly use the production authority while this resolves.
    void trySwitchToTestAppLabeler(bundle.appviewClient)
  }

  const labelerDids = readLabelers(account.did)
  if (labelerDids) {
    applyLabelersToClient(bundle.appviewClient, labelerDids)
    applyLabelersToClient(bundle.chatClient, labelerDids)
  } else {
    // If there are no headers in the storage, we'll not send them on the initial requests.
    // If we wanted to fix this, we could block on the preferences query here.
  }
}

function switchToDefaultAppLabelers() {
  configureGlobalAppLabelers([api.moderation.did, EUROSKY_LABELER_DID])
}

/** Resolve and install the test environment's moderation authority. */
async function trySwitchToTestAppLabeler(client: Client) {
  const did = (
    await client
      .call(com.atproto.identity.resolveHandle, {
        handle: 'mod-authority.test',
      })
      .catch(_ => undefined)
  )?.did
  if (did) {
    console.warn('USING TEST ENV MODERATION')
    configureGlobalAppLabelers([did])
  }
}
