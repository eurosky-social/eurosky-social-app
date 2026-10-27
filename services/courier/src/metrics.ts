import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Registry,
} from '@prometheus-io/client'

export type Metrics = ReturnType<typeof createMetrics>

export function createMetrics({defaultMetrics}: {defaultMetrics: boolean}) {
  const registry = new Registry()
  if (defaultMetrics) collectDefaultMetrics({register: registry})
  const registers = [registry]
  return {
    registry,
    notifications: new Counter({
      name: 'courier_notifications_total',
      help: 'Notifications received from the AppView, by what happened to them',
      labelNames: ['outcome'] as const,
      registers,
    }),
    deliveries: new Counter({
      name: 'courier_deliveries_total',
      help: 'Sends to individual devices, by platform, kind (alert or silent) and result',
      labelNames: ['platform', 'kind', 'outcome'] as const,
      registers,
    }),
    registrations: new Counter({
      name: 'courier_registrations_total',
      help: 'Device token registrations, by platform',
      labelNames: ['platform'] as const,
      registers,
    }),
    tokensPruned: new Counter({
      name: 'courier_tokens_pruned_total',
      help: 'Device registrations removed after Apple or Google rejected the token',
      labelNames: ['platform'] as const,
      registers,
    }),
    queueDepth: new Gauge({
      name: 'courier_send_queue_depth',
      help: 'Sends waiting or in flight',
      registers,
    }),
  }
}
