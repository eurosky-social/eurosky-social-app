import {act, render, screen} from '@testing-library/react-native'

import {Provider as ClockProvider} from '#/state/shell/tick-every-minute'
import {ProfileBadges} from '#/components/ProfileBadges'
import {type app} from '#/lexicons'

jest.mock('#/state/cache/profile-shadow', () => ({
  useProfileShadow: (profile: unknown) => profile,
}))

jest.mock('#/alf', () => ({
  atoms: {
    flex_row: {flexDirection: 'row'},
    align_center: {alignItems: 'center'},
    gap_2xs: {gap: 2},
    gap_xs: {gap: 4},
  },
  useAlf: () => ({fonts: {scaleMultiplier: 1}}),
}))

jest.mock('#/alf/util/dimensions', () => ({
  useNativeFontScale: () => 1,
}))

jest.mock('#/components/verification', () => ({
  useSimpleVerificationState: () => ({showBadge: false}),
}))

jest.mock('#/components/verification/VerificationCheck', () => ({
  VerificationCheck: () => null,
}))

jest.mock('#/components/verification/VerificationCheckButton', () => ({
  VerificationCheckButton: () => null,
}))

jest.mock('#/components/BetaBadge', () => ({
  useIsBetaBadgeVisible: () => false,
  BetaBadge: () => null,
  BetaBadgeButton: () => null,
}))

jest.mock('#/components/BotBadge', () => ({
  isBotAccount: () => false,
  BotBadge: () => null,
  BotBadgeButton: () => null,
}))

jest.mock('#/components/CakeDayBadge', () => ({
  CakeDayBadge: (props: object) => {
    const {View} = require('react-native')
    return <View testID="cakeDayBadge" {...props} />
  },
}))

const profile: app.bsky.actor.defs.ProfileViewBasic = {
  did: 'did:plc:cakeday',
  handle: 'cake.example.com',
  createdAt: '2023-06-15T18:30:00.000Z',
}

function badges(
  props: Partial<React.ComponentProps<typeof ProfileBadges>> = {},
) {
  return (
    <ClockProvider>
      <ProfileBadges profile={profile} size="md" {...props} />
    </ClockProvider>
  )
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00Z'))
})

afterEach(() => {
  jest.useRealTimers()
})

it('renders a cake even when there are no other badges', () => {
  render(badges())
  expect(screen.getByTestId('cakeDayBadge').props.width).toBe(15)
  expect(screen.getByTestId('cakeDayBadge').props.interactive).toBe(false)
})

it('supports the interactive profile header and its badge size', () => {
  render(badges({interactive: true, size: 'lg'}))
  const badge = screen.getByTestId('cakeDayBadge')
  expect(badge.props.interactive).toBe(true)
  expect(badge.props.width).toBe(19)
  expect(badge.props.hitSlop).toEqual(
    expect.objectContaining({left: 20, right: 20}),
  )
})

it('does not render a container when no badges are visible', () => {
  render(badges({profile: {...profile, createdAt: undefined}}))
  expect(screen.toJSON()).toBeNull()
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
