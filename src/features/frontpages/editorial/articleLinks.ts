/** Compare article destinations without changing the URL that readers actually open. */
export function articleLinkKey(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return value
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.*|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid)$/i.test(key))
        url.searchParams.delete(key)
    }
    url.searchParams.sort()
    const host = url.hostname.replace(/^www\./, '')
    const path = url.pathname.replace(/\/+$/, '')
    return `${host}${url.port ? `:${url.port}` : ''}${path}${url.search}`
  } catch {
    return value
  }
}
