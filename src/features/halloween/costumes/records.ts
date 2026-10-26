import {
  type Client,
  getBlobCidString,
  isBlobRef,
  type LexMap,
} from '@atproto/lex'
import {type AtIdentifierString} from '@atproto/syntax'

import {until} from '#/lib/async/until'
import {SLINGSHOT_SERVICE} from '#/lib/constants'
import {isRecordNotFoundError, matchXrpcError} from '#/lib/xrpc-error'
import {type Costume, costumeSchema} from '#/features/halloween/costumes/model'
import {app, com} from '#/lexicons'

export const COSTUME_COLLECTION = 'social.mu.halloween.costume'

export type CostumeRecord = {
  $type: typeof COSTUME_COLLECTION
  costumeNumber: number
  createdAt: string
  updatedAt: string
  originalAvatar?: app.bsky.actor.profile.Main['avatar']
  avatar: NonNullable<app.bsky.actor.profile.Main['avatar']>
  drawing: Costume
  post?: string
}

/** Treat malformed public records as absent, not as permission to show candy. */
export function parseCostumeRecord(value: unknown): CostumeRecord | undefined {
  const record = value as Partial<CostumeRecord> | undefined
  if (
    record?.$type !== COSTUME_COLLECTION ||
    !Number.isSafeInteger(record.costumeNumber) ||
    record.costumeNumber! < 1 ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string' ||
    !isBlobRef(record.avatar) ||
    (record.originalAvatar !== undefined &&
      !isBlobRef(record.originalAvatar)) ||
    !costumeSchema.safeParse(record.drawing).success
  )
    return undefined
  return {
    ...record,
    drawing: costumeSchema.parse(record.drawing),
  } as CostumeRecord
}

/** Only an explicit boolean on the post record opts into candy presentation. */
export function isCostumePost(record: unknown): boolean {
  return (
    !!record &&
    typeof record === 'object' &&
    'isHalloweenCostume' in record &&
    record.isHalloweenCostume === true
  )
}

export async function readOwnCostume(client: Client) {
  try {
    const result = await client.call(com.atproto.repo.getRecord, {
      repo: client.assertDid,
      collection: COSTUME_COLLECTION,
      rkey: 'self',
    })
    const record = parseCostumeRecord(result.value)
    if (!record) throw new Error('Invalid costume record')
    return record
  } catch (error) {
    if (matchXrpcError(error, com.atproto.repo.getRecord) === 'RecordNotFound')
      return undefined
    throw error
  }
}

/** Custom collections must be read from the author's PDS, not the AppView. */
export async function fetchCostumeRecord(
  did: string,
): Promise<Pick<CostumeRecord, 'costumeNumber' | 'post'> | null> {
  const url = new URL('/xrpc/com.atproto.repo.getRecord', SLINGSHOT_SERVICE)
  url.searchParams.set('repo', did)
  url.searchParams.set('collection', COSTUME_COLLECTION)
  url.searchParams.set('rkey', 'self')
  const response = await fetch(url.toString(), {
    headers: {accept: 'application/json'},
  })
  if (response.status === 400 || response.status === 404) return null
  if (!response.ok) throw new Error('Could not load costume')
  const json = (await response.json()) as {value?: Record<string, unknown>}
  const value = json.value
  if (
    value?.$type !== COSTUME_COLLECTION ||
    typeof value.costumeNumber !== 'number' ||
    !Number.isSafeInteger(value.costumeNumber) ||
    value.costumeNumber < 1
  )
    return null
  const prefix = `at://${did}/app.bsky.feed.post/`
  const rkey =
    typeof value.post === 'string' && value.post.startsWith(prefix)
      ? value.post.slice(prefix.length)
      : ''
  const post =
    /^[A-Za-z0-9._~:-]{1,512}$/.test(rkey) && rkey !== '.' && rkey !== '..'
      ? (value.post as string)
      : undefined
  return {costumeNumber: value.costumeNumber, post}
}

/** Read the head first: any concurrent repository write makes publication fail safely. */
export async function loadCostumeSource(client: Client) {
  const {cid: head} = await client.call(com.atproto.sync.getLatestCommit, {
    did: client.assertDid,
  })
  const [profile, costume] = await Promise.all([
    client
      .call(com.atproto.repo.getRecord, {
        repo: client.assertDid,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
      })
      .catch(error => {
        /* Some accounts never wrote a profile; publication creates one. */
        if (isRecordNotFoundError(error)) return undefined
        throw error
      }),
    readOwnCostume(client),
  ])
  const value: app.bsky.actor.profile.Main = profile
    ? (profile.value as app.bsky.actor.profile.Main)
    : {$type: 'app.bsky.actor.profile'}
  const wearingCostume =
    costume &&
    value.avatar &&
    getBlobCidString(value.avatar) === getBlobCidString(costume.avatar)
  return {
    head,
    profile: value,
    hasProfile: !!profile,
    costume,
    originalAvatar: wearingCostume ? costume.originalAvatar : value.avatar,
  }
}

export type CostumeSource = Awaited<ReturnType<typeof loadCostumeSource>>

/** The repo write is already committed; indexing lag must never turn it into a failed save. */
export async function waitForCostumeAvatar(
  client: Client,
  did: string,
  avatar: CostumeRecord['avatar'],
) {
  const cid = getBlobCidString(avatar)
  await until(
    5,
    1000,
    profile => !!profile?.avatar?.includes(cid),
    () =>
      client.call(app.bsky.actor.getProfile, {
        actor: did as AtIdentifierString,
      }),
  )
}

/** Fetch original bytes from the account's PDS; CDN thumbnails are not canvas-readable on web. */
export function originalAvatarUrl(
  did: string,
  source: CostumeSource,
  pdsUrl: string,
) {
  const avatar = source.originalAvatar
  if (!avatar) return undefined
  const url = new URL('/xrpc/com.atproto.sync.getBlob', pdsUrl)
  url.searchParams.set('did', did)
  url.searchParams.set('cid', getBlobCidString(avatar))
  return url.toString()
}

/** The drawing's source photo or published costume changed in another editor. */
export class CostumeConflictError extends Error {
  constructor() {
    super(
      'Your profile picture or costume has changed since you opened the studio.',
    )
    this.name = 'CostumeConflictError'
  }
}

/** Profile and counter change together; unrelated repo writes must not invalidate an editor draft. */
export async function publishCostume(
  client: Client,
  source: CostumeSource,
  drawing: Costume,
  avatar: CostumeRecord['avatar'],
) {
  const latest = await loadCostumeSource(client)
  const avatarCid = (blob: CostumeSource['profile']['avatar']) =>
    blob ? getBlobCidString(blob) : undefined
  if (
    avatarCid(latest.profile.avatar) !== avatarCid(source.profile.avatar) ||
    avatarCid(latest.originalAvatar) !== avatarCid(source.originalAvatar) ||
    latest.costume?.costumeNumber !== source.costume?.costumeNumber
  )
    throw new CostumeConflictError()

  const now = new Date().toISOString()
  if (latest.costume?.costumeNumber === Number.MAX_SAFE_INTEGER)
    throw new Error('Costume counter is full')
  const record: CostumeRecord = {
    $type: COSTUME_COLLECTION,
    costumeNumber: (latest.costume?.costumeNumber ?? 0) + 1,
    createdAt: latest.costume?.createdAt ?? now,
    updatedAt: now,
    ...(latest.originalAvatar ? {originalAvatar: latest.originalAvatar} : {}),
    avatar,
    drawing: costumeSchema.parse({...drawing, updatedAt: now}),
  }
  await client.call(com.atproto.repo.applyWrites, {
    repo: client.assertDid,
    swapCommit: latest.head,
    writes: [
      {
        $type: latest.hasProfile
          ? 'com.atproto.repo.applyWrites#update'
          : 'com.atproto.repo.applyWrites#create',
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
        value: {...latest.profile, avatar},
      },
      {
        $type: latest.costume
          ? 'com.atproto.repo.applyWrites#update'
          : 'com.atproto.repo.applyWrites#create',
        collection: COSTUME_COLLECTION,
        rkey: 'self',
        value: record as unknown as LexMap,
      },
    ],
  })
  return record
}
