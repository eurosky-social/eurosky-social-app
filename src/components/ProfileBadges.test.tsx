import {act, render, screen} from '@testing-library/react-native'

import {Provider as ClockProvider} from '#/state/shell/tick-every-minute'
import {ProfileBadges} from '#/components/ProfileBadges'
import {type app} from '#/lexicons'

jest.mock('#/lib/constants', () => ({
  HITSLOP_20: {top: 20, bottom: 20, left: 20, right: 20},
}))
jest.mock('#/state/cache/profile-shadow', () => ({
  useProfileShadow: (profile: unknown) => profile,
}))
jest.mock('#/state/queries/preferences', () => ({
  usePreferencesQuery: () => {
    throw new Error('Profile badges must not read beta-program preferences')
  },
}))
jest.mock('#/alf', () => ({
  atoms: {
    flex_row: {},
    align_center: {},
    px_2xs: {paddingHorizontal: 4},
    gap_2xs: {gap: 4},
    gap_xs: {gap: 8},
  },
  useAlf: () => ({fonts: {scaleMultiplier: 1.5}}),
}))
jest.mock('#/alf/util/dimensions', () => ({useNativeFontScale: () => 2}))
jest.mock('#/components/verification', () => ({
  useSimpleVerificationState: () => ({
    showBadge: mockVerified,
    role: 'verifier',
  }),
}))
jest.mock('#/components/verification/VerificationCheck', () => ({
  VerificationCheck: (props: {width: number}) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="verificationBadge" style={{width: props.width}} />
  },
}))
jest.mock('#/components/verification/VerificationCheckButton', () => ({
  VerificationCheckButton: (props: {width: number; hitSlop: object}) => {
    const {View} = require('react-native') as typeof import('react-native')
    return mockVerified ? (
      <View
        testID="verificationButton"
        style={{width: props.width}}
        hitSlop={props.hitSlop}
      />
    ) : null
  },
}))
jest.mock('#/components/BotBadge', () => ({
  isBotAccount: () => mockBot,
  BotBadge: (props: {width: number}) => {
    const {View} = require('react-native') as typeof import('react-native')
    return mockBot ? (
      <View testID="botBadge" style={{width: props.width}} />
    ) : null
  },
  BotBadgeButton: (props: {width: number; hitSlop: object}) => {
    const {View} = require('react-native') as typeof import('react-native')
    return mockBot ? (
      <View
        testID="botButton"
        style={{width: props.width}}
        hitSlop={props.hitSlop}
      />
    ) : null
  },
}))
jest.mock('#/components/CakeDayBadge', () => ({
  CakeDayBadge: (props: object) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="cakeDayBadge" {...props} />
  },
}))

let mockVerified = false
let mockBot = false
const profile = {did: 'did:plc:example', handle: 'example.test'} as const
const cakeProfile: app.bsky.actor.defs.ProfileViewBasic = {
  did: 'did:plc:cakeday',
  handle: 'cake.example.com',
  createdAt: '2023-06-15T18:30:00.000Z',
}

function badges(
  props: Partial<React.ComponentProps<typeof ProfileBadges>> = {},
) {
  return (
    <ClockProvider>
      <ProfileBadges profile={cakeProfile} size="md" {...props} />
    </ClockProvider>
  )
}

beforeEach(() => {
  mockVerified = false
  mockBot = false
  jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00Z'))
})

afterEach(() => {
  jest.useRealTimers()
})

it('renders no container when there is no verification, bot, or cake badge', () => {
  const {toJSON} = render(<ProfileBadges profile={profile} size="md" />)
  expect(toJSON()).toBeNull()
})

it('retains scaled verification and bot badges without reading beta preferences', () => {
  mockVerified = true
  mockBot = true
  render(<ProfileBadges profile={profile} size="md" />)
  expect(screen.getByTestId('verificationBadge').props).toMatchObject({
    style: {width: 42},
  })
  expect(screen.getByTestId('botBadge').props).toMatchObject({
    style: {width: 45},
  })
})

it('shares the hit area between adjacent interactive badges', () => {
  mockVerified = true
  mockBot = true
  render(<ProfileBadges profile={profile} size="md" interactive />)
  expect(screen.getByTestId('verificationButton').props).toMatchObject({
    hitSlop: {top: 20, bottom: 20, left: 20, right: 4},
  })
  expect(screen.getByTestId('botButton').props).toMatchObject({
    hitSlop: {top: 20, bottom: 20, left: 4, right: 20},
  })
})

it('gives a lone bot badge its full hit area and respects disabled font scaling', () => {
  mockBot = true
  render(
    <ProfileBadges
      profile={profile}
      size="md"
      interactive
      allowFontScaling={false}
    />,
  )
  expect(screen.queryByTestId('verificationButton')).toBeNull()
  expect(screen.getByTestId('botButton').props).toMatchObject({
    style: {width: 15},
    hitSlop: {top: 20, bottom: 20, left: 20, right: 20},
  })
})

it('renders a scaled cake even when there are no other badges', () => {
  render(badges())
  expect(screen.getByTestId('cakeDayBadge').props.width).toBe(45)
  expect(screen.getByTestId('cakeDayBadge').props.interactive).toBe(false)
})

it('supports the interactive profile header and its badge size', () => {
  render(badges({interactive: true, size: 'lg'}))
  const badge = screen.getByTestId('cakeDayBadge')
  expect(badge.props.interactive).toBe(true)
  expect(badge.props.width).toBe(57)
  expect(badge.props.hitSlop).toEqual({
    top: 20,
    bottom: 20,
    left: 20,
    right: 20,
  })
})

it('shares hit areas when verification, bot, and cake badges are all visible', () => {
  mockVerified = true
  mockBot = true
  render(badges({interactive: true}))
  expect(screen.getByTestId('verificationButton').props.hitSlop).toEqual({
    top: 20,
    bottom: 20,
    left: 20,
    right: 4,
  })
  expect(screen.getByTestId('botButton').props.hitSlop).toEqual({
    top: 20,
    bottom: 20,
    left: 4,
    right: 4,
  })
  expect(screen.getByTestId('cakeDayBadge').props.hitSlop).toEqual({
    top: 20,
    bottom: 20,
    left: 4,
    right: 20,
  })
})

it('retains inline alignment for a cake badge with font scaling disabled', () => {
  render(badges({inline: true, allowFontScaling: false}))
  const badge = screen.getByTestId('cakeDayBadge')
  expect(badge.props.width).toBe(15)
  expect(screen.toJSON()).toMatchObject({
    props: {
      style: expect.arrayContaining([
        [{paddingHorizontal: 4}, {transform: [{translateY: 0.75}]}],
      ]),
    },
  })
})

it('does not render a cake outside the anniversary', () => {
  jest.setSystemTime(new Date('2026-06-14T12:00:00Z'))
  render(badges())
  expect(screen.queryByTestId('cakeDayBadge')).toBeNull()
})

it('shows and removes the cake across UTC midnight without remounting', () => {
  jest.setSystemTime(new Date('2026-06-14T23:59:30Z'))
  render(badges())
  expect(screen.queryByTestId('cakeDayBadge')).toBeNull()

  act(() => jest.advanceTimersByTime(60_000))
  expect(screen.getByTestId('cakeDayBadge')).toBeTruthy()

  jest.setSystemTime(new Date('2026-06-15T23:59:30Z'))
  act(() => jest.advanceTimersByTime(60_000))
  expect(screen.queryByTestId('cakeDayBadge')).toBeNull()
})
