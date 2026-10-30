import {readFileSync} from 'node:fs'

/**
 * Apple Push Notification service credentials. One token-based (.p8) key
 * signs for every app of the team, so the topic is picked per device from its
 * app id.
 */
export type ApnsConfig = {
  keyId: string
  teamId: string
  /**
   * PEM contents of the .p8 signing key.
   */
  privateKey: string
  /**
   * `https://api.push.apple.com` or `https://api.sandbox.push.apple.com`.
   * Development builds hold sandbox tokens, which production rejects.
   */
  origin: string
}

/**
 * Firebase Cloud Messaging (HTTP v1) credentials, taken from a Google service
 * account key file.
 */
export type FcmConfig = {
  projectId: string
  clientEmail: string
  privateKey: string
  tokenUri: string
  origin: string
}

export type Config = {
  host: string
  port: number
  /**
   * The AppView's courier client defaults to HTTP/2 without TLS (h2c). A
   * plain listener cannot serve both versions, so this has to match
   * `BSKY_COURIER_HTTP_VERSION` on the AppView and dataplane.
   */
  httpVersion: '1.1' | '2'
  /**
   * Accepted bearer tokens. More than one allows rotating the key without
   * restarting the AppView and the courier at the same moment.
   */
  apiKeys: string[]
  databaseUrl: string
  /**
   * App ids allowed to register tokens. For iOS the app id is also the APNs
   * topic, so it must be the app's bundle identifier.
   */
  appIds: string[]
  /**
   * Text shown instead of the AppView's copy for age-restricted accounts.
   */
  genericTitle: string
  genericMessage: string
  /**
   * How long Apple and Google keep trying to reach an offline device, and the
   * age past which a notification is dropped rather than sent.
   */
  ttlSeconds: number
  sendConcurrency: number
  /**
   * Queued sends (kept in Postgres) beyond which new batches are refused, so
   * a long Apple or Google outage backs up into the AppView's own retry queue
   * instead of growing this one without limit.
   */
  maxQueuedSends: number
  apns?: ApnsConfig
  fcm?: FcmConfig
}

type Env = Record<string, string | undefined>

/**
 * Builds the config from environment variables. Credentials are read from
 * files so multi-line keys never pass through an env file.
 */
export function readConfig(env: Env = process.env): Config {
  const httpVersion = env.COURIER_HTTP_VERSION ?? '1.1'
  if (httpVersion !== '1.1' && httpVersion !== '2') {
    throw new Error('COURIER_HTTP_VERSION must be "1.1" or "2"')
  }
  const apiKeys = list(env.COURIER_API_KEYS)
  if (apiKeys.length === 0) {
    throw new Error('COURIER_API_KEYS is required')
  }
  const config: Config = {
    host: env.COURIER_HOST ?? '127.0.0.1',
    port: int(env, 'COURIER_PORT', 2587),
    httpVersion,
    apiKeys,
    databaseUrl: required(env, 'COURIER_DATABASE_URL'),
    appIds: list(env.COURIER_APP_IDS ?? 'social.mu.app'),
    genericTitle: env.COURIER_GENERIC_TITLE ?? 'mu',
    genericMessage:
      env.COURIER_GENERIC_MESSAGE ?? 'You have a new notification',
    ttlSeconds: int(env, 'COURIER_TTL_SECONDS', 24 * 60 * 60),
    sendConcurrency: int(env, 'COURIER_SEND_CONCURRENCY', 64),
    maxQueuedSends: int(env, 'COURIER_MAX_QUEUED_SENDS', 100_000),
    apns: readApns(env),
    fcm: readFcm(env),
  }
  if (!config.apns && !config.fcm) {
    throw new Error(
      'configure COURIER_APNS_KEY_FILE, COURIER_FCM_SERVICE_ACCOUNT_FILE or both',
    )
  }
  return config
}

function readApns(env: Env): ApnsConfig | undefined {
  const keyFile = env.COURIER_APNS_KEY_FILE
  if (!keyFile) return undefined
  const environment = env.COURIER_APNS_ENVIRONMENT ?? 'production'
  if (environment !== 'production' && environment !== 'sandbox') {
    throw new Error(
      'COURIER_APNS_ENVIRONMENT must be "production" or "sandbox"',
    )
  }
  return {
    keyId: required(env, 'COURIER_APNS_KEY_ID'),
    teamId: required(env, 'COURIER_APNS_TEAM_ID'),
    privateKey: readFileSync(keyFile, 'utf8'),
    origin:
      environment === 'production'
        ? 'https://api.push.apple.com'
        : 'https://api.sandbox.push.apple.com',
  }
}

function readFcm(env: Env): FcmConfig | undefined {
  const file = env.COURIER_FCM_SERVICE_ACCOUNT_FILE
  if (!file) return undefined
  const account = JSON.parse(readFileSync(file, 'utf8')) as Record<
    string,
    unknown
  >
  const field = (name: string) => {
    const value = account[name]
    if (typeof value !== 'string' || value === '') {
      throw new Error(`${file} has no "${name}"`)
    }
    return value
  }
  return {
    projectId: field('project_id'),
    clientEmail: field('client_email'),
    privateKey: field('private_key'),
    tokenUri: field('token_uri'),
    origin: 'https://fcm.googleapis.com',
  }
}

function required(env: Env, name: string): string {
  const value = env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function int(env: Env, name: string, fallback: number): number {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return value
}

function list(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}
