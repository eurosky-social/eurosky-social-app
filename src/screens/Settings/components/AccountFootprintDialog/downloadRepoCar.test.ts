import {downloadRepoCar} from './downloadRepoCar'

function streamOf(chunks: number[]) {
  let pulled = 0
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled === chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(new Uint8Array(chunks[pulled++]).fill(pulled))
    },
    cancel() {
      cancelled = true
    },
  })
  return {
    body,
    get pulled() {
      return pulled
    },
    get cancelled() {
      return cancelled
    },
  }
}

const args = {pdsUrl: 'https://pds.example.com', did: 'did:plc:abc'}

describe('downloadRepoCar', () => {
  it('requests getRepo on the PDS and joins the chunks', async () => {
    const stream = streamOf([3, 2])
    const fetch = jest.fn(() =>
      Promise.resolve({ok: true, status: 200, body: stream.body}),
    )

    const car = await downloadRepoCar(fetch, {...args, maxBytes: 10})

    expect(fetch).toHaveBeenCalledWith(
      'https://pds.example.com/xrpc/com.atproto.sync.getRepo?did=did%3Aplc%3Aabc',
      {signal: undefined},
    )
    expect(car).toEqual(new Uint8Array([1, 1, 1, 2, 2]))
  })

  it('stops reading and returns null once the repo passes the cap', async () => {
    const stream = streamOf([4, 4, 4, 4])
    const fetch = () =>
      Promise.resolve({ok: true, status: 200, body: stream.body})

    expect(await downloadRepoCar(fetch, {...args, maxBytes: 6})).toBeNull()
    expect(stream.cancelled).toBe(true)
    expect(stream.pulled).toBeLessThan(4)
  })

  it('throws on an error response', async () => {
    const fetch = () => Promise.resolve({ok: false, status: 400, body: null})

    await expect(downloadRepoCar(fetch, args)).rejects.toThrow('400')
  })

  it('passes the abort signal to fetch', async () => {
    const stream = streamOf([1])
    const fetch = jest.fn(() =>
      Promise.resolve({ok: true, status: 200, body: stream.body}),
    )
    const {signal} = new AbortController()

    await downloadRepoCar(fetch, {...args, signal})

    expect(fetch).toHaveBeenCalledWith(expect.any(String), {signal})
  })
})
