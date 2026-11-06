import {type Client, type Un$Typed} from '@atproto/lex'

import {type app} from '#/lexicons'
import {ProfileLinksChangedError} from './legacy'
import {type ProfileLink} from './types'
import {createProfileLinkWriteState, writeProfileLinks} from './write'

jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/lib/xrpc-error', () => ({
  isRecordNotFoundError: (error: Error) => error.message === 'RecordNotFound',
  matchXrpcError: (error: Error) =>
    error.message === 'InvalidSwap' ? 'InvalidSwap' : undefined,
}))

const did = 'did:plc:alice' as const
const uri = (rkey: string) => `at://${did}/app.bsky.actor.link/${rkey}`
const original: ProfileLink = {
  uri: uri('3laaaaaaaaaaa'),
  cid: 'original-cid',
  url: 'https://example.com/',
  title: 'Original',
}
type LinkRecord = Un$Typed<app.bsky.actor.link.Main>
type Options = {repo: string; rkey: string; swapRecord?: string}

function setup(existing: ProfileLink[] = [original]) {
  const records = new Map(
    existing.map(link => [
      link.uri!,
      {
        cid: link.cid!,
        value: {url: link.url, title: link.title} as LinkRecord,
      },
    ]),
  )
  let version = 0
  const performPut = (
    _schema: unknown,
    value: LinkRecord,
    options: Options,
  ) => {
    const key = uri(options.rkey)
    if (options.swapRecord && options.swapRecord !== records.get(key)?.cid) {
      return Promise.reject(new Error('InvalidSwap'))
    }
    const cid = `written-cid-${++version}`
    records.set(key, {cid, value})
    return Promise.resolve({uri: key, cid})
  }
  const put = jest.fn(performPut)
  const get = jest.fn((_schema: unknown, options: Options) => {
    const key = uri(options.rkey)
    const record = records.get(key)
    return record
      ? Promise.resolve({uri: key, ...record})
      : Promise.reject(new Error('RecordNotFound'))
  })
  const client = {
    get,
    put,
    delete: jest.fn().mockResolvedValue(undefined),
  } as unknown as Client
  const state = createProfileLinkWriteState()
  const write = (links: ProfileLink[], baseline = existing) =>
    writeProfileLinks(client, did, links, baseline, state)
  return {write, records, put, get, state, performPut}
}

describe('confirmed link-write retries', () => {
  it('reuses an acknowledged rewrite after the profile save fails, with the original snapshot', async () => {
    const {write, put, get} = setup()
    const edited = {...original, title: 'Edited'}
    const first = await write([edited])
    /* No commit/clear: the subsequent profile write failed. */
    const retry = await write([edited])
    expect(retry.refs).toEqual(first.refs)
    expect(put).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledTimes(1)
    expect(original.cid).toBe('original-cid')
  })

  it('uses the last confirmed CID for further edits and for undoing a staged edit', async () => {
    const {write, put} = setup()
    const first = await write([{...original, title: 'First edit'}])
    const second = await write([{...original, title: 'Second edit'}])
    expect(put.mock.calls[1][2].swapRecord).toBe(first.refs[0].cid)
    const reverted = await write([original])
    expect(put.mock.calls[2][2].swapRecord).toBe(second.refs[0].cid)
    expect(reverted.refs[0].cid).not.toBe(original.cid)
    expect((await write([original])).refs).toEqual(reverted.refs)
    expect(put).toHaveBeenCalledTimes(3)
  })

  it('rejects a different client’s newer CID rather than weakening CAS', async () => {
    const {write, put, records} = setup()
    const edited = {...original, title: 'Edited'}
    await write([edited])
    records.set(original.uri!, {
      cid: 'another-client-cid',
      value: {url: original.url, title: 'Another client'} as LinkRecord,
    })
    await expect(write([edited])).rejects.toBeInstanceOf(
      ProfileLinksChangedError,
    )
    expect(put).toHaveBeenCalledTimes(1)
    expect(records.get(original.uri!)?.cid).toBe('another-client-cid')
  })

  it('turns an initial CAS conflict into the typed reloadable conflict', async () => {
    const {write, records} = setup()
    records.set(original.uri!, {
      cid: 'concurrent-cid',
      value: {url: original.url} as LinkRecord,
    })
    await expect(
      write([{...original, title: 'Edited'}]),
    ).rejects.toBeInstanceOf(ProfileLinksChangedError)
    expect(records.get(original.uri!)?.cid).toBe('concurrent-cid')
  })

  it('rejects a concurrently deleted staged record', async () => {
    const {write, records} = setup()
    const edited = {...original, title: 'Edited'}
    await write([edited])
    records.delete(original.uri!)
    await expect(write([edited])).rejects.toBeInstanceOf(
      ProfileLinksChangedError,
    )
  })

  it('waits for in-flight siblings before failing, then reuses their successful writes', async () => {
    const other = {
      ...original,
      uri: uri('3lbbbbbbbbbbb'),
      cid: 'other-cid',
      url: 'https://other.example/',
    }
    const {write, put, performPut} = setup([original, other])
    let release = () => {}
    const pending = new Promise<void>(resolve => {
      release = resolve
    })
    put.mockImplementationOnce((...args) =>
      pending.then(() => performPut(...args)),
    )
    put.mockRejectedValueOnce(new Error('Sibling offline'))
    const edits = [
      {...original, title: 'A'},
      {...other, title: 'B'},
    ]
    const attempt = write(edits)
    let settled = false
    void attempt.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)
    release()
    await expect(attempt).rejects.toThrow('Sibling offline')
    const retry = await write(edits)
    expect(retry.refs).toHaveLength(2)
    expect(
      put.mock.calls.filter(call => call[2].rkey === '3laaaaaaaaaaa'),
    ).toHaveLength(1)
    expect(
      put.mock.calls.filter(call => call[2].rkey === '3lbbbbbbbbbbb'),
    ).toHaveLength(2)
  })

  it('reuses new drafts too, and clears both retry maps only after commit', async () => {
    const {write, state, put} = setup([])
    const draft = {url: 'https://new.example/'}
    const first = await write([draft])
    expect((await write([draft])).refs).toEqual(first.refs)
    expect(put).toHaveBeenCalledTimes(1)
    expect(state.staged.size).toBe(1)
    first.clearDraftKeys()
    expect(state.staged.size).toBe(0)
    expect(state.draftKeys.size).toBe(0)
    expect((await write([draft])).refs[0].uri).not.toBe(first.refs[0].uri)
  })
})
