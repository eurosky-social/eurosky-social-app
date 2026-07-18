import { createCallerVerifier } from './auth.ts'
import { loadConfig } from './config.ts'
import { getDb } from './db.ts'
import { createGrantClient } from './grants.ts'
import { createMollieClient } from './mollie.ts'
import { createDecoService } from './service.ts'

export async function createApp() {
  const config = loadConfig()
  return createDecoService({
    config,
    db: await getDb(),
    mollie: createMollieClient(config),
    grants: createGrantClient(config),
    verifier: createCallerVerifier(config),
  })
}
