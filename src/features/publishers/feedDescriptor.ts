import {PUBLISHERS} from './publishers'

/** Stable registry order also isolates each Following selection in the shared feed cache. */
export function publisherFeedDescriptor(
  mode: 'articles' | 'videos',
  dids?: readonly string[],
) {
  if (dids === undefined) return `publishers|${mode}` as const
  const sources = PUBLISHERS.filter(publisher =>
    dids.includes(publisher.did),
  ).map(publisher => publisher.did)
  return `publishers|${mode === 'videos' ? 'following-videos' : 'following'}|${sources.join(',')}` as const
}

export function publisherFeedSources(descriptor: string) {
  if (!descriptor.startsWith('publishers|following')) return undefined
  const selected = descriptor.split('|')[2]?.split(',') ?? []
  return PUBLISHERS.filter(publisher => selected.includes(publisher.did)).map(
    publisher => publisher.did,
  )
}
