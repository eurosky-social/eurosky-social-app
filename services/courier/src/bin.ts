import {pino} from 'pino'

import {ApnsClient} from './apns.ts'
import {Courier} from './app.ts'
import {readConfig} from './config.ts'
import {PgStore} from './db.ts'
import {FcmClient} from './fcm.ts'

const logger = pino({level: process.env.LOG_LEVEL ?? 'info'})

async function main() {
  const config = readConfig()
  const store = new PgStore(config.databaseUrl)
  await store.migrate()
  const courier = new Courier({
    config,
    store,
    senders: {
      apns: config.apns ? new ApnsClient(config.apns) : undefined,
      fcm: config.fcm ? new FcmClient(config.fcm) : undefined,
    },
    logger,
    defaultMetrics: true,
  })
  const address = await courier.listen()
  logger.info(
    {
      address: `${address.address}:${address.port}`,
      httpVersion: config.httpVersion,
      apns: config.apns?.origin ?? 'off',
      fcm: config.fcm ? config.fcm.projectId : 'off',
    },
    'courier listening',
  )

  let stopping = false
  const stop = (signal: string) => {
    if (stopping) return
    stopping = true
    logger.info({signal}, 'shutting down')
    courier.close().then(
      () => process.exit(0),
      err => {
        logger.error({err}, 'shutdown failed')
        process.exit(1)
      },
    )
  }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}

main().catch(err => {
  logger.fatal({err}, 'courier failed to start')
  process.exit(1)
})
