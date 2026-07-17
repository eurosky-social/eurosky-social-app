import { type DecoConfig } from './config.ts'
import { type GrantClient } from './types.ts'

const GRANT_COLLECTION = 'social.mu.deco.grant'

type Session = { did: string; accessJwt: string; refreshJwt: string }

class PdsError extends Error {
  constructor(
    message: string,
    public status: number,
    public error?: string,
  ) {
    super(message)
  }
}

export async function grantRkey(subjectDid: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(subjectDid),
  )
  const hex = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
  return `sub-${hex}`
}

export function createGrantClient(config: DecoConfig): GrantClient {
  let session: Session | undefined
  let sessionPromise: Promise<Session> | undefined

  async function request<T>(
    method: string,
    body: unknown,
    token?: string,
  ): Promise<T> {
    const response = await fetch(
      `${config.issuerPdsUrl}/xrpc/${method}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      },
    )
    const json = await response.json().catch(() => ({})) as Record<
      string,
      unknown
    >
    if (!response.ok) {
      throw new PdsError(
        `${method} failed (${response.status}): ${
          String(json.message || json.error || '')
        }`,
        response.status,
        typeof json.error === 'string' ? json.error : undefined,
      )
    }
    return json as T
  }

  async function login(): Promise<Session> {
    const next = await request<Session>('com.atproto.server.createSession', {
      identifier: config.issuerIdentifier,
      password: config.issuerAppPassword,
    })
    if (next.did !== config.issuerDid) {
      throw new Error(
        `Decoration issuer login returned ${next.did}, expected ${config.issuerDid}`,
      )
    }
    session = next
    return next
  }

  function getSession(): Promise<Session> {
    if (session) return Promise.resolve(session)
    return (sessionPromise ??= login().finally(() => {
      sessionPromise = undefined
    }))
  }

  async function refresh(current: Session): Promise<Session> {
    try {
      const next = await request<Session>(
        'com.atproto.server.refreshSession',
        {},
        current.refreshJwt,
      )
      if (next.did !== config.issuerDid) throw new Error('Issuer DID changed')
      session = next
      return next
    } catch {
      session = undefined
      return login()
    }
  }

  async function authed<T>(method: string, body: unknown): Promise<T> {
    let current = await getSession()
    try {
      return await request<T>(method, body, current.accessJwt)
    } catch (error) {
      if (!(error instanceof PdsError) || error.status !== 401) throw error
      current = await refresh(current)
      return request<T>(method, body, current.accessJwt)
    }
  }

  return {
    async put(subjectDid) {
      const rkey = await grantRkey(subjectDid)
      const result = await authed<{ uri: string }>(
        'com.atproto.repo.putRecord',
        {
          repo: config.issuerDid,
          collection: GRANT_COLLECTION,
          rkey,
          validate: false,
          record: {
            $type: GRANT_COLLECTION,
            subject: subjectDid,
            createdAt: new Date().toISOString(),
          },
        },
      )
      return {
        rkey,
        uri: result.uri ||
          `at://${config.issuerDid}/${GRANT_COLLECTION}/${rkey}`,
      }
    },
    async remove(subjectDid, knownRkey) {
      const rkey = knownRkey || (await grantRkey(subjectDid))
      try {
        await authed('com.atproto.repo.deleteRecord', {
          repo: config.issuerDid,
          collection: GRANT_COLLECTION,
          rkey,
        })
      } catch (error) {
        if (
          error instanceof PdsError &&
          (error.error === 'RecordNotFound' || error.status === 404)
        ) {
          return
        }
        throw error
      }
    },
  }
}
