import {Fragment} from 'react'
import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'

export function SetupHeader({
  step,
  totalSteps = 2,
  title,
  onBack,
}: {
  /** The current step, from 1; unset hides the step dots. */
  step?: number
  totalSteps?: number
  /** Defaults to “News”. */
  title?: string
  onBack: () => boolean | void
}) {
  return (
    <Layout.Header.Outer>
      <Layout.Header.BackButton
        onPress={evt => {
          // If onBack handled it, don't also navigate away.
          if (onBack()) {
            evt.preventDefault()
          }
        }}
      />
      <Layout.Header.Content align="left">
        <Layout.Header.TitleText>
          {title ?? <Trans>News</Trans>}
        </Layout.Header.TitleText>
      </Layout.Header.Content>
      {step !== undefined ? (
        <StepDots current={step} total={totalSteps} />
      ) : (
        <Layout.Header.Slot />
      )}
    </Layout.Header.Outer>
  )
}

function StepDots({current, total}: {current: number; total: number}) {
  const t = useTheme()
  return (
    <View style={[a.flex_row, a.align_center, a.gap_sm]}>
      {Array.from({length: total}).map((_unused, index) => {
        const n = index + 1
        const active = n <= current
        return (
          <Fragment key={n}>
            {index > 0 && (
              <View style={[{width: 24, height: 2}, t.atoms.bg_contrast_100]} />
            )}
            <View
              style={[
                a.align_center,
                a.justify_center,
                a.rounded_full,
                {width: 28, height: 28},
                active
                  ? {backgroundColor: t.palette.primary_500}
                  : t.atoms.bg_contrast_100,
              ]}>
              <Text
                style={[
                  a.text_sm,
                  a.font_bold,
                  {
                    color: active
                      ? t.palette.white
                      : t.atoms.text_contrast_medium.color,
                  },
                ]}>
                {n}
              </Text>
            </View>
          </Fragment>
        )
      })}
    </View>
  )
}
