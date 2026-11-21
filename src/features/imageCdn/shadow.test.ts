import {describe, expect, it, jest} from '@jest/globals'

import {createImageCdnShadow} from './shadow'

const TARGET = 'https://cdn.example.com'
const avatar = (cid: string) =>
  `https://cdn.bsky.app/img/avatar/plain/did:plc:abc/${cid}@jpeg`

function setup(percentage = 100, random = () => 0) {
  const shadowFetch = jest.fn(
    (_input: Parameters<typeof fetch>[0], _init?: RequestInit) =>
      Promise.resolve(new Response('img')),
  )
  const shadow = createImageCdnShadow({
    config: {percentage, target: TARGET},
    random,
    shadowFetch: shadowFetch as unknown as typeof fetch,
  })!
  return {shadow, shadowFetch}
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('image CDN shadow', () => {
  it('samples by percentage', () => {
    expect(setup(10, () => 0.05).shadow.sample()).toBe(true)
    expect(setup(10, () => 0.5).shadow.sample()).toBe(false)
  })

  it('loads each image once from the target', async () => {
    const {shadow, shadowFetch} = setup()
    shadow.copy(
      JSON.stringify({
        avatar: avatar('a'),
        banner: 'https://cdn.bsky.app/img/banner/plain/did:plc:abc/b@jpeg',
        other: avatar('a'),
      }),
    )
    shadow.copy(JSON.stringify({avatar: avatar('a')}))
    await flush()
    expect(shadowFetch.mock.calls.map(c => c[0])).toEqual([
      `${TARGET}/img/avatar/plain/did:plc:abc/a@jpeg`,
      `${TARGET}/img/banner/plain/did:plc:abc/b@jpeg`,
    ])
  })

  it('skips full-size images and other hosts', async () => {
    const {shadow, shadowFetch} = setup()
    shadow.copy(
      JSON.stringify({
        fullsize:
          'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:x/c@jpeg',
        avatar: 'https://other.example/img/avatar/plain/did:plc:x/d@jpeg',
      }),
    )
    await flush()
    expect(shadowFetch).not.toHaveBeenCalled()
  })

  it('limits parallel loads', async () => {
    const {shadow, shadowFetch} = setup()
    shadowFetch.mockImplementation(() => new Promise<Response>(() => {}))
    shadow.copy(
      JSON.stringify(
        Array.from({length: 10}, (_, i) => ({avatar: avatar(`${i}`)})),
      ),
    )
    await flush()
    expect(shadowFetch).toHaveBeenCalledTimes(4)
  })
})
