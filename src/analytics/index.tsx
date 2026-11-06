import {createContext, useContext, useMemo} from 'react'
import {Platform} from 'react-native'

import {Logger} from '#/logger'
import {features} from '#/analytics/features'
import {
  getAndMigrateDeviceId,
  getDeviceId,
  getSessionId,
} from '#/analytics/identifiers'
import {
  getMetadataForLogger,
  getNavigationMetadata,
  type MergeableMetadata,
  type Metadata,
  type MetricMetadata,
} from '#/analytics/metadata'
import {type Metrics, metrics} from '#/analytics/metrics'
import * as refParams from '#/analytics/misc/refParams'
import {plausible} from '#/analytics/plausible'
import {PLAUSIBLE_GOALS} from '#/analytics/plausible/shared'
import * as env from '#/env'
import {useGeolocationServiceResponse} from '#/geolocation/service'
import {device} from '#/storage'

export {Features} from '#/analytics/features'
export {type Metrics} from '#/analytics/metrics'
export * as utils from '#/analytics/utils'

type LoggerType = {
  debug: Logger['debug']
  info: Logger['info']
  log: Logger['log']
  warn: Logger['warn']
  error: Logger['error']
  /**
   * Clones the existing logger and overrides the `context` value. Existing
   * metadata is inherited.
   *
   * ```ts
   * const ax = useAnalytics()
   * const logger = ax.logger.useChild(ax.logger.Context.Notifications)
   * ```
   */
  useChild: (context: Exclude<Logger['context'], undefined>) => LoggerType
  Context: typeof Logger.Context
}
export type AnalyticsContextType = {
  metadata: Metadata
  logger: LoggerType
  metric: <E extends keyof Metrics>(
    event: E,
    payload: Metrics[E],
    metadata?: MergeableMetadata,
  ) => void
  features: typeof features
}
export type AnalyticsBaseContextType = Omit<AnalyticsContextType, 'features'>

function createLogger(
  context: Logger['context'],
  metadata: Record<string, unknown>,
): LoggerType {
  const logger = Logger.create(context, metadata)
  const currentLogger = () => {
    // Replace the snapshot so previously recorded entries stay unchanged.
    logger.ambientMetadata = {
      ...metadata,
      deviceId: metadata.deviceId ?? getDeviceId() ?? 'unknown',
      sessionId: getSessionId(),
    }
    return logger
  }
  return {
    debug: (...args) => currentLogger().debug(...args),
    info: (...args) => currentLogger().info(...args),
    log: (...args) => currentLogger().log(...args),
    warn: (...args) => currentLogger().warn(...args),
    error: (...args) => currentLogger().error(...args),
    useChild: (context: Exclude<Logger['context'], undefined>) => {
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      return useMemo(() => createLogger(context, metadata), [context, metadata])
    },
    Context: Logger.Context,
  }
}

const Context = createContext<AnalyticsContextType>({
  features,
  logger: createLogger(Logger.Context.Default, {}),
  /** Session IDs are captured when an event is emitted, not at render time. */
  metric: (event, payload, metadata: Partial<Metadata> = {}) => {
    const snapshot: MetricMetadata = {
      ...metadata,
      base: {
        ...metadata.base,
        deviceId: metadata.base?.deviceId ?? getDeviceId() ?? 'unknown',
        sessionId: getSessionId(),
      },
      navigation: getNavigationMetadata(),
    }
    if ('__meta' in snapshot) {
      delete snapshot.__meta
    }
    if (env.PLAUSIBLE_DOMAIN) {
      if (PLAUSIBLE_GOALS.has(event)) {
        plausible.track(event, payload, snapshot)
      }
    } else {
      metrics.track(event, payload, snapshot)
    }
  },
  metadata: {
    base: {
      deviceId: getDeviceId() ?? 'unknown',
      platform: Platform.OS,
      appVersion: env.APP_VERSION,
      bundleIdentifier: env.BUNDLE_IDENTIFIER,
      bundleDate: env.BUNDLE_DATE,
      referrerSrc: refParams.src,
      referrerUrl: refParams.url,
    },
    geolocation: device.get(['geolocationServiceResponse']) || {
      countryCode: '',
      regionCode: '',
      city: '',
    },
  },
})
Context.displayName = 'AnalyticsContext'

/**
 * Initialize the Plausible sink. No-op when no domain is configured, and safe
 * to call once at module load. On web this sets up the tracker (which then
 * auto-captures pageviews); on native it is a no-op.
 */
plausible.init()

/**
 * Ensures that deviceId is set and migrated from legacy storage. Handled on
 * startup in `App.<platform>.tsx`. This must be awaited prior to booting up.
 */
export const setupDeviceId = getAndMigrateDeviceId()

/**
 * Decorates the parent analytics context with additional metadata. Feature
 * settings are local and independent of account identity and analytics state.
 */
export function AnalyticsContext({
  children,
  metadata,
}: {
  children: React.ReactNode
  metadata?: MergeableMetadata
}) {
  if (metadata && !('__meta' in metadata)) {
    throw new Error(
      'Use the useMeta() helper when passing metadata to AnalyticsContext',
    )
  }
  const deviceId = getDeviceId() ?? 'unknown'
  // Only IP based, never GPS.
  const geolocation = useGeolocationServiceResponse()
  const parentContext = useContext(Context)
  const childContext = useMemo(() => {
    const combinedMetadata = {
      ...parentContext.metadata,
      ...metadata,
      base: {
        ...parentContext.metadata.base,
        deviceId,
      },
      geolocation,
    }
    const context: AnalyticsContextType = {
      ...parentContext,
      logger: createLogger(
        Logger.Context.Default,
        getMetadataForLogger(combinedMetadata),
      ),
      metadata: combinedMetadata,
      metric: (event, payload, extraMetadata) => {
        parentContext.metric(event, payload, {
          ...combinedMetadata,
          ...extraMetadata,
        })
      },
    }
    return context
  }, [parentContext, metadata, deviceId, geolocation])
  return <Context.Provider value={childContext}>{children}</Context.Provider>
}

/** Basic analytics context for metadata, metrics and logging. */
export function useAnalyticsBase(): AnalyticsBaseContextType {
  return useContext(Context)
}

/** Analytics, logging and build-local feature settings. */
export function useAnalytics() {
  return useContext(Context)
}
