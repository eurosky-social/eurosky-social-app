import {isBlueskyHostedUrl, toNiceHostingUrl} from '#/lib/strings/url-helpers'

/**
 * The account page lives on the authorization server, which is not always the
 * PDS: Bluesky accounts sit on `*.host.bsky.network` PDSes but are managed at
 * `bsky.social/account`. For OAuth sessions `service` is that server's issuer.
 */
export function pdsAccountLink({
  pdsUrl,
  service,
}: {
  pdsUrl?: string
  service?: string
}) {
  const accountServer = service || pdsUrl || ''
  const host = pdsUrl || service || ''
  return {
    host: toNiceHostingUrl(host),
    url: accountServer ? new URL('/account', accountServer).href : '',
    /** Bluesky's account page is known to exist; other hosts may not have one. */
    isBlueskyHosted: isBlueskyHostedUrl(host),
  }
}
