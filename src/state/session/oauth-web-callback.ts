/**
 * Web OAuth callback glue, kept out of App.web.tsx so that file gains only
 * an import + two call lines (minimal upstream merge surface).
 *
 * No dedicated callback route: redirect_uri is the site root, so the
 * provider returns the user to `/` with params, and we finish sign-in at
 * app startup here.
 */
import {logger} from '#/logger'
import {type SessionApiContext} from '#/state/session/types'
import {describeOAuthError} from './oauth-logging'
import {
  getWebOAuthClient,
  OAUTH_HANDLE_STEPUP_STATE,
  OAUTH_SIGNUP_STATE,
} from './oauth-web-client'

/**
 * The OAuth loopback spec requires an IP-based origin (127.0.0.1), not
 * "localhost". The auth server redirects to 127.0.0.1, but IndexedDB is
 * per-origin, so PKCE state stored under "localhost" is unreachable from
 * "127.0.0.1". Force the origin early so signIn() and the callback share
 * it. No-op in production. Call once at module load.
 */
export function maybeRedirectLoopbackHost(): void {
  if (typeof window === 'undefined') return
  if (window.location.hostname === 'localhost') {
    const url = new URL(window.location.href)
    url.hostname = '127.0.0.1'
    window.location.replace(url.href)
  }
}

/**
 * Read the OAuth callback params and remove them from the URL at once, before
 * any await. The authorization code is single-use: the startup effect can run
 * again while the exchange is in flight (its dependencies change when e.g. the
 * geolocation lookup lands), and a second run that still saw the params would
 * replay the code, which the PDS answers by revoking the session. Clearing the
 * URL also keeps a reload from retrying a spent code instead of resuming the
 * stored account.
 */
function takeOAuthCallbackParams(): URLSearchParams | null {
  if (typeof window === 'undefined') return null
  // Params arrive in the hash fragment (response_mode=fragment) or query.
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  const params = hash.has('state') ? hash : query
  if (!params.has('state') || !(params.has('code') || params.has('error'))) {
    return null
  }
  window.history.replaceState(null, '', window.location.pathname)
  return params
}

let pendingCallback: Promise<boolean> | undefined

/**
 * If the current URL is an OAuth callback, finish the flow and log the user
 * in. Returns true if it signed the user in (caller should stop its normal
 * resume path), false otherwise, including when the callback failed, so the
 * caller resumes the stored account instead. Idempotent per page load: later
 * calls share the first call's result.
 */
export function tryFinishWebOAuthSignIn(
  login: SessionApiContext['login'],
  startOnboarding: () => void,
): Promise<boolean> {
  if (!pendingCallback) {
    const params = takeOAuthCallbackParams()
    if (!params) return Promise.resolve(false)
    pendingCallback = finishWebOAuthSignIn(params, login, startOnboarding)
  }
  return pendingCallback
}

async function finishWebOAuthSignIn(
  params: URLSearchParams,
  login: SessionApiContext['login'],
  startOnboarding: () => void,
): Promise<boolean> {
  try {
    return await completeCallback(params, login, startOnboarding)
  } catch (e) {
    // No DID here: this reaches the live Sentry transport.
    logger.warn('oauth: sign-in callback failed', describeOAuthError(e))
    return false
  }
}

async function completeCallback(
  params: URLSearchParams,
  login: SessionApiContext['login'],
  startOnboarding: () => void,
): Promise<boolean> {
  const client = getWebOAuthClient()
  const result = await client.callback(params)
  if (result.session) {
    // A fresh signup (prompt=create) is created on the external PDS page, which
    // never runs our in-app signup wizard - so start onboarding here, the same
    // way that wizard does. Plain sign-ins carry no state and are untouched.
    //
    // Start it BEFORE login() so onboarding is already active the instant the
    // session appears. login() never touches onboarding state ('skip' only fires
    // on logout / account switch), and persisted onboarding defaults to 'Home'
    // (inactive) for a new account - so starting it AFTER login left a gap in
    // which the shell rendered the default home feed for ~1-2s before the wizard.
    //
    // We drive the in-memory onboarding reducer (startOnboarding) rather than
    // only writing persisted state. OnboardingProvider is mounted above the
    // session, so login() never remounts it, and on web persisted.write() does
    // not fire onUpdate listeners in the same tab (its cross-tab BroadcastChannel
    // never echoes back to the sender). A bare write would leave the onboarding
    // context stale and the wizard would not appear until a manual reload. The
    // reducer's 'start' action persists the step itself.
    if (result.state === OAUTH_SIGNUP_STATE) {
      startOnboarding()
    }
    // For a handle step-up the DID is unchanged, so login() replaces the
    // existing session in place with the upgraded (identity:handle) tokens.
    await login(
      {
        service: '',
        identifier: '',
        password: '',
        oauthSession: result.session,
      },
      'LoginForm',
    )
    if (result.state === OAUTH_HANDLE_STEPUP_STATE) {
      // The redirect lands at the site root; rewrite the path before the
      // navigator reads it so web linking resolves to account settings, where
      // the reopen flag reopens the change-handle dialog.
      window.history.replaceState(null, '', '/settings/account')
    }
    return true
  }
  return false
}
