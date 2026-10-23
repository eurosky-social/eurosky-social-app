import {type Un$Typed} from '@atproto/lex'

import {type app} from '#/lexicons'
import {ProfileLinksChangedError} from './legacy'
import {prepareProfileSave} from './profileSave'

type ProfileRecord = Un$Typed<app.bsky.actor.profile.Main>
const originalWebsite = 'https://old.example/' as const
const migratedRefs = [
  {
    uri: 'at://did:plc:alice/app.bsky.actor.link/3laaaaaaaaaaa' as const,
    cid: 'migrated-cid',
  },
]

function setup(linksDirty = false) {
  const onSuccess = jest.fn<Promise<void>, []>().mockResolvedValue(undefined)
  const updates = jest.fn((record: ProfileRecord): ProfileRecord => {
    if (record.website !== originalWebsite) throw new ProfileLinksChangedError()
    return {...record, website: undefined, links: migratedRefs}
  })
  const save = prepareProfileSave({
    fields: {displayName: '', description: 'New bio', pronouns: ''},
    links: {updates, onSuccess},
    linksDirty,
  })
  return {save, onSuccess, updates}
}

function apply(
  save: ReturnType<typeof prepareProfileSave>,
  record: ProfileRecord,
) {
  return typeof save.updates === 'function'
    ? save.updates(record)
    : {...record, ...save.updates}
}

describe('ordinary profile edits with links', () => {
  it('normalizes empty fields identically with and without a migration', () => {
    const fields = {displayName: '', description: '', pronouns: ''}
    const plain = prepareProfileSave({fields, linksDirty: false})
    const combined = prepareProfileSave({
      fields,
      linksDirty: true,
      links: {
        updates: record => ({
          ...record,
          links: migratedRefs,
          website: undefined,
        }),
        onSuccess: () => Promise.resolve(),
      },
    })
    const record = {
      displayName: 'Old name',
      description: 'Old bio',
      pronouns: 'they/them',
    }
    const empty = {
      displayName: undefined,
      description: undefined,
      pronouns: undefined,
    }
    expect(apply(plain, record)).toEqual(empty)
    expect(apply(combined, record)).toEqual({
      ...empty,
      links: migratedRefs,
      website: undefined,
    })
    expect(combined.fields).toEqual(plain.fields)
  })

  it('skips optional migration if links changed between preparation and the CAS callback', async () => {
    const {save, onSuccess} = setup()
    const latest: ProfileRecord = {
      website: 'https://changed.example/',
      links: [
        {
          uri: 'at://did:plc:alice/app.bsky.actor.link/3lbbbbbbbbbbb',
          cid: 'concurrent-cid',
        },
      ],
      avatar: undefined,
    }
    const result = apply(save, latest)
    expect(result).toEqual({
      ...latest,
      displayName: undefined,
      description: 'New bio',
      pronouns: undefined,
    })
    expect(latest).not.toHaveProperty('description')
    await save.onSuccess()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('does not cache or clean up staged links if a later CAS retry skips migration', async () => {
    const {save, onSuccess} = setup()
    expect(apply(save, {website: originalWebsite}).links).toEqual(migratedRefs)
    expect(apply(save, {website: 'https://changed.example/'}).website).toBe(
      'https://changed.example/',
    )
    await save.onSuccess()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('still rejects conflicts for explicitly edited links', async () => {
    const {save, onSuccess} = setup(true)
    expect(() => apply(save, {website: 'https://changed.example/'})).toThrow(
      ProfileLinksChangedError,
    )
    await save.onSuccess()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('only swallows the typed conflict, not unrelated profile errors', () => {
    const {save, updates} = setup()
    updates.mockImplementationOnce(() => {
      throw new Error('Unexpected failure')
    })
    expect(() => apply(save, {website: originalWebsite})).toThrow(
      'Unexpected failure',
    )
  })

  it('runs migration cache/cleanup after an applied save succeeds', async () => {
    const {save, onSuccess} = setup()
    expect(apply(save, {website: originalWebsite}).website).toBeUndefined()
    expect(onSuccess).not.toHaveBeenCalled()
    await save.onSuccess()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })
})
