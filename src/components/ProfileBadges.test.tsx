import {render} from '@testing-library/react-native'

import {HITSLOP_20} from '#/lib/constants'
import {SupporterBadge} from '#/components/SupporterBadge'
import {useSimpleVerificationState} from '#/components/verification'
import {useIsSupporter} from '#/features/supporter'
import {ProfileBadges} from './ProfileBadges'

jest.mock('#/lib/constants', () => ({
  HITSLOP_20: {top: 20, bottom: 20, left: 20, right: 20},
}))
jest.mock('#/state/cache/profile-shadow', () => ({
  useProfileShadow: (profile: unknown) => profile,
}))
jest.mock('#/alf', () => ({
  atoms: {flex_row: {}, align_center: {}, gap_2xs: {gap: 4}, gap_xs: {gap: 8}},
  useAlf: () => ({fonts: {scaleMultiplier: 1}}),
}))
jest.mock('#/alf/util/dimensions', () => ({useNativeFontScale: () => 1}))
jest.mock('#/components/BotBadge', () => ({
  isBotAccount: () => false,
  BotBadge: () => null,
  BotBadgeButton: () => null,
}))
jest.mock('./BetaBadge', () => ({
  useIsBetaBadgeVisible: () => false,
  BetaBadge: () => null,
  BetaBadgeButton: () => null,
}))
jest.mock('#/components/verification', () => ({
  useSimpleVerificationState: jest.fn(),
}))
jest.mock('#/components/verification/VerificationCheck', () => ({
  VerificationCheck: () => null,
}))
jest.mock('#/components/verification/VerificationCheckButton', () => ({
  VerificationCheckButton: () => null,
}))
jest.mock('#/components/SupporterBadge', () => ({
  SupporterBadge: jest.fn(() => null),
}))
jest.mock('#/features/supporter', () => ({useIsSupporter: jest.fn()}))

const profile = {did: 'did:plc:supporter', handle: 'supporter.test'} as const

beforeEach(() => {
  jest.clearAllMocks()
  jest
    .mocked(useSimpleVerificationState)
    .mockReturnValue({showBadge: false} as ReturnType<
      typeof useSimpleVerificationState
    >)
  jest.mocked(useIsSupporter).mockReturnValue(false)
})

it('does not show the supporter mark for a nonmember', () => {
  render(<ProfileBadges profile={profile} size="sm" />)
  expect(SupporterBadge).not.toHaveBeenCalled()
})

it('shows a supporter even when there is no verification or other badge', () => {
  jest.mocked(useIsSupporter).mockReturnValue(true)
  render(<ProfileBadges profile={profile} size="sm" />)
  expect(useIsSupporter).toHaveBeenCalledWith(profile.did)
  expect(jest.mocked(SupporterBadge).mock.calls.at(-1)?.[0]).toEqual({
    width: 12,
    interactive: false,
    hitSlop: HITSLOP_20,
  })
})

it('keeps supporter and verification badges distinct with adjacent hit targets', () => {
  jest.mocked(useIsSupporter).mockReturnValue(true)
  jest
    .mocked(useSimpleVerificationState)
    .mockReturnValue({showBadge: true} as ReturnType<
      typeof useSimpleVerificationState
    >)
  render(<ProfileBadges profile={profile} size="lg" interactive />)
  expect(jest.mocked(SupporterBadge).mock.calls.at(-1)?.[0]).toEqual({
    width: 18,
    interactive: true,
    hitSlop: {...HITSLOP_20, left: 4},
  })
})
