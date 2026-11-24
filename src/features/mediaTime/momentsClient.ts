import {type Client} from '@atproto/lex'

import {createServiceClient} from '#/lib/lexClient'
import {MOMENTS_SERVICE_URL} from './config'

let client: Client | undefined

/** Unauthenticated client for the moments service (an AppView). */
export function getMomentsClient(): Client {
  client ??= createServiceClient(MOMENTS_SERVICE_URL)
  return client
}
