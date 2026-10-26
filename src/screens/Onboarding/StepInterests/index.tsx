import {useCallback, useState} from 'react'
import {Pressable, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  interests,
  MIN_ONBOARDING_INTERESTS,
  useInterestsDisplayNames,
} from '#/lib/interests'
import {capitalize} from '#/lib/strings/capitalize'
import {logger} from '#/logger'
import {
  OnboardingControls,
  OnboardingDescriptionText,
  OnboardingPosition,
  OnboardingTitleText,
} from '#/screens/Onboarding/Layout'
import {useOnboardingInternalState} from '#/screens/Onboarding/state'
import {InterestButton} from '#/screens/Onboarding/StepInterests/InterestButton'
import {atoms as a} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Toggle from '#/components/forms/Toggle'
import {Loader} from '#/components/Loader'
import * as Tooltip from '#/components/Tooltip'
import {useAnalytics} from '#/analytics'

export function StepInterests() {
  const {t: l} = useLingui()
  const ax = useAnalytics()
  const interestsDisplayNames = useInterestsDisplayNames()

  const {state, dispatch} = useOnboardingInternalState()
  const [saving, setSaving] = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    state.interestsStepResults.selectedInterests.map(i => i),
  )
  const missingRequiredInterest =
    selectedInterests.length < MIN_ONBOARDING_INTERESTS

  const showMissingInterestTooltip = () => {
    ax.metric('onboarding:interests:disabledNextPressed', {})
    setTooltipVisible(true)
  }

  const saveInterests = useCallback(() => {
    setSaving(true)

    try {
      setSaving(false)
      dispatch({
        type: 'setInterestsStepResults',
        selectedInterests,
      })
      dispatch({type: 'next'})
      ax.metric('onboarding:interests:nextPressed', {
        selectedInterests,
        selectedInterestsLength: selectedInterests.length,
      })
    } catch (error) {
      const e = error as Error
      logger.info(`onboarding: error saving interests`)
      logger.error(e)
    }
  }, [ax, selectedInterests, setSaving, dispatch])

  const continueButton = (
    <Button
      disabled={saving || missingRequiredInterest}
      testID="onboardingContinue"
      variant="solid"
      color="primary"
      size="large"
      label={
        missingRequiredInterest
          ? l`Choose at least ${MIN_ONBOARDING_INTERESTS} interests`
          : l`Continue to next step`
      }
      onPress={() => void saveInterests()}>
      <ButtonText style={{pointerEvents: 'none'}}>
        {missingRequiredInterest ? (
          <Trans>Choose at least {MIN_ONBOARDING_INTERESTS}</Trans>
        ) : (
          <Trans>Continue</Trans>
        )}
      </ButtonText>
      {saving && <ButtonIcon icon={Loader} />}
    </Button>
  )

  return (
    <View style={[a.align_start, a.gap_sm]} testID="onboardingInterests">
      <OnboardingPosition />
      <OnboardingTitleText>
        <Trans>What are your interests?</Trans>
      </OnboardingTitleText>
      <OnboardingDescriptionText>
        <Trans>
          Choose at least {MIN_ONBOARDING_INTERESTS} to help personalize your
          feed. You can change these anytime.
        </Trans>
      </OnboardingDescriptionText>

      <View style={[a.w_full, a.pt_lg]}>
        <Toggle.Group
          values={selectedInterests}
          onChange={setSelectedInterests}
          label={l`Select your interests from the options below`}>
          <View style={[a.flex_row, a.gap_md, a.flex_wrap]}>
            {interests.map(interest => (
              <Toggle.Item
                key={interest}
                name={interest}
                label={interestsDisplayNames[interest] || capitalize(interest)}>
                <InterestButton interest={interest} />
              </Toggle.Item>
            ))}
          </View>
        </Toggle.Group>
      </View>

      <OnboardingControls.Portal>
        <View style={[a.relative]}>
          {missingRequiredInterest ? (
            <Tooltip.Outer
              position="top"
              visible={tooltipVisible}
              onVisibleChange={setTooltipVisible}>
              <Tooltip.Target>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={l`Choose at least ${MIN_ONBOARDING_INTERESTS} interests`}
                  accessibilityHint={l`Choose at least ${MIN_ONBOARDING_INTERESTS} interests to continue`}
                  onPress={showMissingInterestTooltip}>
                  <View
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants">
                    {continueButton}
                  </View>
                </Pressable>
              </Tooltip.Target>
              <Tooltip.BubbleText
                label={l`Choose at least ${MIN_ONBOARDING_INTERESTS} interests.`}>
                <Trans>
                  Choose at least {MIN_ONBOARDING_INTERESTS} interests.
                </Trans>
              </Tooltip.BubbleText>
            </Tooltip.Outer>
          ) : (
            continueButton
          )}
        </View>
      </OnboardingControls.Portal>
    </View>
  )
}
