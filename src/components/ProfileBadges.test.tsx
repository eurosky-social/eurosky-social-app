import {render, screen} from '@testing-library/react-native'

import {ProfileBadges} from './ProfileBadges'

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

let mockVerified = false
let mockBot = false
const profile = {did: 'did:plc:example', handle: 'example.test'} as const

beforeEach(() => {
  mockVerified = false
  mockBot = false
})

it('renders no container when there is no verification or bot badge', () => {
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
