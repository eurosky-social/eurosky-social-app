/**
 * EUROSKY: mu uses no cookies, so the web app deletes any it finds. The point
 * is tiles (src/features/tiles): they run on `<random>.t.mu.social`, which
 * shares a site with the app, so a tile's script can set a cookie for
 * `Domain=mu.social`. One set from script is always visible to script here,
 * which is what lets the app expire it. Sessions and everything else the app
 * keeps live in storage, which this does not touch.
 *
 * Returns the `document.cookie` assignments that expire every cookie in
 * `cookies`: a cookie can only be deleted by naming the domain and path it
 * was set with, which script cannot read, so each name is expired host-only
 * and for the host and each of its parent domains, on `/` and on every prefix
 * of the current path.
 */
export function cookieExpiries(
  cookies: string,
  hostname: string,
  pathname: string,
): string[] {
  const names = new Set(
    cookies
      .split(';')
      .map(pair => pair.split('=')[0].trim())
      .filter(Boolean),
  )
  if (!names.size) return []

  const labels = hostname.split('.')
  const domains: (string | undefined)[] = [undefined]
  // An IP address or a bare name (localhost) has no parent domains to try.
  if (labels.length > 1 && !/^[\d.]+$/.test(hostname)) {
    for (let i = 0; i <= labels.length - 2; i++) {
      domains.push(labels.slice(i).join('.'))
    }
  }

  const paths = ['/']
  let prefix = ''
  for (const segment of pathname.split('/').filter(Boolean)) {
    prefix += `/${segment}`
    paths.push(prefix)
  }

  const out: string[] = []
  for (const name of names) {
    for (const domain of domains) {
      for (const path of paths) {
        out.push(
          `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=${path}` +
            (domain ? `; Domain=${domain}` : ''),
        )
      }
    }
  }
  return out
}

/** Deletes every cookie script can see. Does nothing off the web. */
export function scrubCookies() {
  if (typeof document === 'undefined' || typeof location === 'undefined') return
  try {
    for (const expiry of cookieExpiries(
      document.cookie,
      location.hostname,
      location.pathname,
    )) {
      document.cookie = expiry
    }
  } catch {
    // A sandboxed or cookie-less context: nothing to scrub.
  }
}

/**
 * Scrubs now, whenever the page comes back into view, and every minute while
 * it is open (a tile can be running the whole time). Returns the undo.
 */
export function keepCookiesScrubbed(): () => void {
  if (typeof document === 'undefined') return () => {}
  scrubCookies()
  const onVisible = () => {
    if (document.visibilityState === 'visible') scrubCookies()
  }
  document.addEventListener('visibilitychange', onVisible)
  const timer = setInterval(scrubCookies, 60e3)
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(timer)
  }
}
