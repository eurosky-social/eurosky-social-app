import {act, render} from '@testing-library/react-native'

import {onAppStateChange} from '#/lib/appState'
import {getEntries} from '#/logger/logDump'
import {
  type AnalyticsBaseContextType,
  AnalyticsContext,
  type AnalyticsContextType,
  useAnalytics,
  useAnalyticsBase,
} from '#/analytics'
import {Features, features} from '#/analytics/features'
import {getDeviceId, getSessionId} from '#/analytics/identifiers'
import {
  type MergeableMetadata,
  type Metadata,
  type MetricMetadata,
} from '#/analytics/metadata'
import {type Metrics, metrics} from '#/analytics/metrics'
import {MetricsClient} from '#/analytics/metrics/client'
import {recordSessionActivity} from '#/analytics/useSessionActivity/index.web'
import {useMeta} from '#/analytics/utils'
import {useGeolocationServiceResponse} from '#/geolocation/service'
import {device} from '#/storage'

jest.mock('#/lib/appState', () => ({
  onAppStateChange: jest.fn(() => ({remove: jest.fn()})),
}))
let mockIsNative = true
jest.mock('#/env', () => ({
  ENV: 'test',
  ENABLE_METRICS: true,
  get IS_NATIVE() {
    return mockIsNative !== false
  },
}))
jest.mock('#/logger/transports/sentry', () => ({sentryTransport: jest.fn()}))
jest.mock('#/logger/transports/console', () => ({consoleTransport: jest.fn()}))
jest.mock('#/analytics/metrics', () => ({metrics: {track: jest.fn()}}))
jest.mock('#/analytics/identifiers/device', () => ({
  getDeviceId: jest.fn(),
  getAndMigrateDeviceId: () => Promise.resolve('device-a'),
}))
jest.mock('#/geolocation/service', () => ({
  useGeolocationServiceResponse: jest.fn(),
}))

const FIVE_MINUTES = 5 * 60 * 1e3
let contexts: Metadata[]
let baseAx: AnalyticsBaseContextType
let ax: AnalyticsContextType
let childLogger: AnalyticsContextType['logger']
let renderCount: number

function CaptureBase({index}: {index: number}) {
  baseAx = useAnalyticsBase()
  contexts[index] = baseAx.metadata
  return null
}

function CaptureAnalytics() {
  renderCount++
  ax = useAnalytics()
  childLogger = ax.logger.useChild(ax.logger.Context.Notifications)
  return null
}

function Tree({session, preferences}: MergeableMetadata) {
  return (
    <AnalyticsContext>
      <CaptureBase index={0} />
      <AnalyticsContext metadata={useMeta({session})}>
        <CaptureBase index={1} />
        <AnalyticsContext metadata={useMeta({preferences})}>
          <CaptureBase index={2} />
          <CaptureAnalytics />
        </AnalyticsContext>
      </AnalyticsContext>
    </AnalyticsContext>
  )
}

beforeEach(() => {
  mockIsNative = true
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-09-22T12:00:00Z'))
  jest.mocked(metrics.track).mockReset()
  jest.mocked(getDeviceId).mockReturnValue('device-a')
  contexts = []
  renderCount = 0
  device.set(['analyticsSession'], {id: 'session-a', lastEventAt: Date.now()})
  jest.mocked(useGeolocationServiceResponse).mockReturnValue({
    countryCode: 'US',
    regionCode: 'WI',
    city: 'Madison',
  })
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

function rotateSession() {
  const onChange = jest.mocked(onAppStateChange).mock.calls[0][0]
  onChange('background')
  jest.setSystemTime(Date.now() + FIVE_MINUTES)
  onChange('active')
}

function lastMetricMetadata() {
  return jest.mocked(metrics.track).mock.calls.at(-1)![2] as MetricMetadata
}

it('inherits device identity without session state or rerenders on rotation', () => {
  render(
    <Tree
      session={{did: 'did:plc:a', isBskyPds: true}}
      preferences={{appLanguage: 'en', contentLanguages: ['en']}}
    />,
  )
  const previousContext = ax
  const previousMetadata = [...contexts]
  const previousRenderCount = renderCount

  act(() => rotateSession())
  expect(getSessionId()).not.toBe('session-a')
  expect(renderCount).toBe(previousRenderCount)
  expect(ax).toBe(previousContext)
  for (const [index, metadata] of contexts.entries()) {
    expect(metadata).toBe(previousMetadata[index])
    expect(metadata.base).not.toHaveProperty('sessionId')
    expect(metadata.base.deviceId).toBe('device-a')
    expect(metadata.geolocation).toEqual({
      countryCode: 'US',
      regionCode: 'WI',
      city: 'Madison',
    })
  }
  expect(contexts[0].session).toBeUndefined()
  expect(contexts[1].session?.did).toBe('did:plc:a')
  expect(contexts[1].preferences).toBeUndefined()
  expect(ax.metadata).toMatchObject({
    session: {did: 'did:plc:a'},
    preferences: {appLanguage: 'en', contentLanguages: ['en']},
  })
  expect(metrics.track).not.toHaveBeenCalled()
})

it('tracks lifecycle before mount and between mounts without context subscriptions', () => {
  rotateSession()
  const beforeMount = getSessionId()
  expect(beforeMount).not.toBe('session-a')
  const view = render(<Tree />)
  ax.metric('state:foreground', {})
  expect(lastMetricMetadata().base.sessionId).toBe(beforeMount)
  view.unmount()

  rotateSession()
  expect(getSessionId()).not.toBe(beforeMount)
  render(<Tree />)
  ax.metric('state:foreground', {})
  expect(lastMetricMetadata().base.sessionId).toBe(getSessionId())
})

it('updates inherited account, preferences, and geolocation', () => {
  const view = render(
    <Tree
      session={{did: 'did:plc:a', isBskyPds: true}}
      preferences={{appLanguage: 'en', contentLanguages: ['en']}}
    />,
  )
  jest
    .mocked(useGeolocationServiceResponse)
    .mockReturnValue({countryCode: 'CA', regionCode: 'ON', city: 'Toronto'})
  view.rerender(
    <Tree
      session={{did: 'did:plc:b', isBskyPds: false}}
      preferences={{appLanguage: 'fr', contentLanguages: ['fr']}}
    />,
  )

  expect(ax.metadata).toMatchObject({
    session: {did: 'did:plc:b'},
    preferences: {appLanguage: 'fr'},
    geolocation: {countryCode: 'CA'},
  })
  ax.metric('state:foreground', {})
  expect(lastMetricMetadata()).toMatchObject({
    base: {...ax.metadata.base, sessionId: getSessionId()},
    session: ax.metadata.session,
    preferences: ax.metadata.preferences,
    geolocation: ax.metadata.geolocation,
  })
  childLogger.info('updated logger')
  expect(getEntries()[0].metadata.__metadata__).toMatchObject({
    countryCode: 'CA',
    deviceId: ax.metadata.base.deviceId,
    sessionId: getSessionId(),
  })
})

it.each(['default', 'nested'])(
  'preserves device identity and snapshots the session for captured metrics in %s context',
  context => {
    render(
      context === 'default' ? (
        <CaptureBase index={0} />
      ) : (
        <Tree session={{did: 'did:plc:a', isBskyPds: true}} />
      ),
    )
    const metric = baseAx.metric
    const metadata = Object.freeze({
      ...baseAx.metadata,
      __meta: true,
      base: Object.freeze({
        ...baseAx.metadata.base,
        deviceId: 'device-a',
        sessionId: 'obsolete-session',
      }),
    })
    metric('state:foreground', {}, metadata)
    const previousMetric = lastMetricMetadata()
    expect(previousMetric.base).toMatchObject({
      deviceId: 'device-a',
      sessionId: getSessionId(),
    })
    expect(previousMetric).not.toHaveProperty('__meta')

    act(() => rotateSession())
    jest.mocked(getDeviceId).mockReturnValue('device-b')
    metric('state:foreground', {}, metadata)
    expect(lastMetricMetadata().base).toMatchObject({
      deviceId: 'device-a',
      sessionId: getSessionId(),
    })
    expect(previousMetric.base).toMatchObject({
      deviceId: 'device-a',
      sessionId: 'session-a',
    })
    expect(metadata.__meta).toBe(true)
    expect(metadata.base).toMatchObject({
      deviceId: 'device-a',
      sessionId: 'obsolete-session',
    })
  },
)

it.each(['debug', 'info', 'log', 'warn', 'error'] as const)(
  'preserves device identity and snapshots the session in captured parent and child %s callbacks',
  level => {
    render(<Tree />)
    const parentLog = ax.logger[level]
    const childLog = childLogger[level]
    parentLog('previous parent')
    childLog('previous child')
    const previousLogs = getEntries().slice(0, 2)

    act(() => rotateSession())
    jest.mocked(getDeviceId).mockReturnValue('device-b')
    parentLog('current parent')
    childLog('current child')
    const currentLogs = getEntries().slice(0, 2)
    for (const entry of currentLogs) {
      expect(entry.metadata.__metadata__).toMatchObject({
        deviceId: 'device-a',
        sessionId: getSessionId(),
      })
    }
    expect(currentLogs[0].context).toBe(ax.logger.Context.Notifications)
    expect(currentLogs[1].context).toBe(ax.logger.Context.Default)
    for (const entry of previousLogs) {
      expect(entry.metadata.__metadata__).toMatchObject({
        sessionId: 'session-a',
        deviceId: 'device-a',
      })
    }
  },
)

it('resolves device identity for events emitted without a provider', () => {
  jest.mocked(getDeviceId).mockReturnValue(undefined)
  render(<CaptureBase index={0} />)
  const metric = baseAx.metric
  const log = baseAx.logger.info
  metric('state:foreground', {})
  log('before device initialization')
  const previousMetric = lastMetricMetadata()
  const previousLog = getEntries()[0]
  expect(previousMetric.base.deviceId).toBe('unknown')
  expect(previousLog.metadata.__metadata__).toMatchObject({deviceId: 'unknown'})

  jest.mocked(getDeviceId).mockReturnValue('initialized-device')
  metric('state:foreground', {})
  log('after device initialization')
  expect(lastMetricMetadata().base.deviceId).toBe('initialized-device')
  expect(getEntries()[0].metadata.__metadata__).toMatchObject({
    deviceId: 'initialized-device',
  })
  expect(previousMetric.base.deviceId).toBe('unknown')
  expect(previousLog.metadata.__metadata__).toMatchObject({deviceId: 'unknown'})
})

it('does not send product metrics on native', () => {
  const client = new MetricsClient<Metrics>()
  const fetchMock = jest.spyOn(global, 'fetch')
  client.track('state:foreground', {})
  client.flush()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('flushes queued metrics with emission-time sessions and a stable device ID', () => {
  mockIsNative = false
  const client = new MetricsClient<Metrics>()
  jest
    .mocked(metrics.track)
    .mockImplementation((...args) => client.track(...args))
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue({ok: true} as Response)
  render(<Tree />)
  const metric = ax.metric
  metric('state:foreground', {})

  act(() => rotateSession())
  const secondSessionId = getSessionId()
  metric('state:foreground', {})
  act(() => rotateSession())
  expect(fetchMock).not.toHaveBeenCalled()
  client.flush()

  const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string) as {
    events: {metadata: MetricMetadata}[]
  }
  expect(body.events.map(event => event.metadata.base)).toEqual([
    expect.objectContaining({deviceId: 'device-a', sessionId: 'session-a'}),
    expect.objectContaining({deviceId: 'device-a', sessionId: secondSessionId}),
  ])
})

it('keeps passive metrics, logs, evaluations, flushes and retries separate from the web activity clock', async () => {
  mockIsNative = false
  const lastEventAt = Date.now()
  device.set(['analyticsSession'], {id: 'session-a', lastEventAt})
  const client = new MetricsClient<Metrics>()
  jest
    .mocked(metrics.track)
    .mockImplementation((...args) => client.track(...args))
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValue({ok: true} as Response)
  render(<Tree />)
  jest.setSystemTime(lastEventAt + 30 * 60_000)
  ax.metric('state:foreground', {})
  ax.logger.info('passive work')
  const previousLog = getEntries()[0]
  ax.features.enabled(Features.PostGalleryEmbedEnable)
  const previousMetric = lastMetricMetadata()
  client.flush()
  await Promise.resolve()
  const retry = jest.mocked(onAppStateChange).mock.calls.at(-1)![0]
  retry('active')
  await Promise.resolve()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(device.get(['analyticsSession'])).toEqual({
    id: 'session-a',
    lastEventAt,
  })

  recordSessionActivity('keydown')
  ax.metric('router:navigate', {})
  expect(lastMetricMetadata().base.sessionId).not.toBe('session-a')
  expect(previousMetric.base.sessionId).toBe('session-a')
  expect(previousLog.metadata.__metadata__).toMatchObject({
    sessionId: 'session-a',
  })
  expect(fetchMock.mock.calls[0][1]!.body).toBe(
    fetchMock.mock.calls[1][1]!.body,
  )
})

it('uses the initialized device ID when contexts mount', () => {
  jest.mocked(getDeviceId).mockReturnValue('initialized-device')
  render(<Tree session={{did: 'did:plc:a', isBskyPds: true}} />)
  expect(contexts.map(metadata => metadata.base.deviceId)).toEqual([
    'initialized-device',
    'initialized-device',
    'initialized-device',
  ])
  ax.metric('state:foreground', {})
  expect(lastMetricMetadata().base.deviceId).toBe('initialized-device')
  childLogger.info('initialized device')
  expect(getEntries()[0].metadata.__metadata__).toMatchObject({
    deviceId: 'initialized-device',
    sessionId: getSessionId(),
  })
})

it('keeps feature evaluation local across session and account changes without exposures', () => {
  const fetchMock = jest.spyOn(global, 'fetch')
  const view = render(<Tree session={{did: 'did:plc:a', isBskyPds: true}} />)
  const initialFeatures = ax.features
  expect(initialFeatures).toBe(features)
  expect(ax.features.enabled(Features.PostGalleryEmbedEnable)).toBe(false)
  expect(ax.features.getValue(Features.StarterPacksConfig, {limit: 1})).toEqual(
    {limit: 150},
  )
  act(() => rotateSession())
  view.rerender(<Tree session={{did: 'did:plc:b', isBskyPds: false}} />)
  expect(ax.features).toBe(initialFeatures)
  expect(ax.features.enabled(Features.PostGalleryEmbedEnable)).toBe(false)
  expect(metrics.track).not.toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(ax.metadata.base).not.toHaveProperty('isBetaUser')
})
