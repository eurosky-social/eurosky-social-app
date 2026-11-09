import {Platform} from 'react-native'
import {type Client} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'

import {BLUESKY_PROXY_HEADER, PUBLIC_STAGING_APPVIEW_DID} from '#/lib/constants'
import {isNetworkError} from '#/lib/strings/errors'
import {getAppViewProxyService} from '#/features/appView/config'
import {app} from '#/lexicons'
import {device} from '#/storage'

/**
 * The app id the push service delivers to; on iOS also the APNs topic.
 */
export const PUSH_APP_ID = 'social.mu.app'

/**
 * The AppView an account's pushes come from: the one its session talks to,
 * which follows the content service chosen in Settings > Network services.
 * Accounts on Bluesky's staging service use Bluesky's staging AppView.
 */
export function pushAppViewDid(accountService: string | undefined): DidString {
  if (accountService?.includes('staging')) {
    return PUBLIC_STAGING_APPVIEW_DID
  }
  const proxyService = getAppViewProxyService(BLUESKY_PROXY_HEADER.get())
  return proxyService.split('#')[0] as DidString
}

/**
 * The AppView this device's token was last registered with for `did`.
 */
export function registeredPushAppView(did: string): DidString | undefined {
  return device.get(['pushAppViews'])?.[did] as DidString | undefined
}

function setRegisteredPushAppView(
  did: string,
  appViewDid: DidString | undefined,
) {
  const {[did]: _, ...others} = device.get(['pushAppViews']) ?? {}
  device.set(
    ['pushAppViews'],
    appViewDid ? {...others, [did]: appViewDid} : others,
  )
}

/**
 * Registers the device's token for the account with its AppView. When the
 * token was last registered with a different AppView (the user switched
 * content service, or a build changed the default), it is unregistered there
 * first, so the AppView the user left stops pushing to this device.
 */
export async function registerPushWithAppView({
  client,
  account,
  token,
  ageRestricted,
}: {
  client: Client
  account: {did: string; service?: string}
  token: string
  ageRestricted: boolean
}): Promise<void> {
  const appViewDid = pushAppViewDid(account.service)
  const previous = registeredPushAppView(account.did)
  let previousCleared = true
  if (previous && previous !== appViewDid) {
    try {
      await unregisterPushWithAppView({client, appViewDid: previous, token})
    } catch (error) {
      /*
       * Offline: keep the old record so the next registration tries again.
       * Any other refusal will not change on a retry, so it is left behind.
       */
      if (isNetworkError(error)) previousCleared = false
    }
  }

  await client.call(
    app.bsky.notification.registerPush,
    {
      serviceDid: appViewDid,
      platform: Platform.OS,
      token,
      appId: PUSH_APP_ID,
      ageRestricted,
    },
    {service: `${appViewDid}#bsky_notif`},
  )
  if (previousCleared) setRegisteredPushAppView(account.did, appViewDid)
}

/**
 * Unregisters the device's token for an account that is signing out, at the
 * AppView it was registered with.
 */
export async function unregisterPushForAccount({
  client,
  account,
  token,
}: {
  client: Client
  account: {did: string; service: string}
  token: string
}): Promise<void> {
  const appViewDid =
    registeredPushAppView(account.did) ?? pushAppViewDid(account.service)
  await unregisterPushWithAppView({client, appViewDid, token})
  setRegisteredPushAppView(account.did, undefined)
}

function unregisterPushWithAppView({
  client,
  appViewDid,
  token,
}: {
  client: Client
  appViewDid: DidString
  token: string
}) {
  return client.call(
    app.bsky.notification.unregisterPush,
    {
      serviceDid: appViewDid,
      platform: Platform.OS,
      token,
      appId: PUSH_APP_ID,
    },
    {service: `${appViewDid}#bsky_notif`},
  )
}
