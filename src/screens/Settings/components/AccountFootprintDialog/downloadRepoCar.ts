/**
 * Repos above this are listed without counts. Counting holds several times the
 * CAR in memory: a 204MB repo peaked around 1.4GB of heap.
 */
export const MAX_REPO_CAR_BYTES = 20 * 1024 * 1024

type StreamingFetch = (
  url: string,
  init: {signal?: AbortSignal},
) => Promise<{
  ok: boolean
  status: number
  body: ReadableStream<Uint8Array> | null
}>

/**
 * Downloads the account's repo CAR, giving up once it passes `maxBytes`. PDSes
 * stream getRepo without a Content-Length, so the size is only known by reading.
 *
 * @returns the CAR bytes, or `null` if the repo is over the limit.
 */
export async function downloadRepoCar(
  fetch: StreamingFetch,
  {
    pdsUrl,
    did,
    maxBytes = MAX_REPO_CAR_BYTES,
    signal,
  }: {
    pdsUrl: string
    did: string
    maxBytes?: number
    signal?: AbortSignal
  },
): Promise<Uint8Array | null> {
  const url = new URL('/xrpc/com.atproto.sync.getRepo', pdsUrl)
  url.searchParams.set('did', did)
  const response = await fetch(url.href, {signal})
  if (!response.ok || !response.body) {
    throw new Error(`getRepo failed with status ${response.status}`)
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const {done, value} = await reader.read()
    if (done) break
    size += value.length
    if (size > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }

  const car = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    car.set(chunk, offset)
    offset += chunk.length
  }
  return car
}
