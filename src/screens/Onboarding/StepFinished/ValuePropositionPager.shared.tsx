import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {IS_PARTNER_PREVIEW} from '#/env'

export type ValuePropositionPagerProps = {
  step: 0 | 1 | 2
  /**
   * Only the native pager changes pages itself (by swiping); the web pager
   * is driven entirely by the step prop.
   */
  setStep: (step: 0 | 1 | 2) => void
  avatarUri?: string
}

export function useValuePropText(step: 0 | 1 | 2) {
  const {_} = useLingui()

  if (IS_PARTNER_PREVIEW) {
    // Oso shows these pages as text only, so the alt texts are unused.
    return [
      {
        title: _(msg`Follow your friends, acquaintances, and interests.`),
        description: _(
          msg`On oso, you can find your best friends, casual acquaintances, your favorite news outlets, events you’d like to attend, and the communities you want to be a part of.`,
        ),
        alt: '',
      },
      {
        title: _(msg`Take control of your feed.`),
        description: _(
          msg`On oso, you decide what your feed looks like, who you follow, and who sees what you share. There’s no paid content here hijacking your attention without your consent.`,
        ),
        alt: '',
      },
      {
        title: _(msg`Play it safe.`),
        description: _(
          msg`oso’s servers are located in Europe and comply with European law—not with external, opaque interests. Your data remains yours, and your privacy is protected.`,
        ),
        alt: '',
      },
    ][step]
  }

  return [
    {
      title: _(msg`Free your feed`),
      description: _(
        msg`No more doomscrolling junk-filled algorithms. Find feeds that work for you, not against you.`,
      ),
      alt: _(
        msg`A collection of popular feeds you can find on Bluesky, including News, Booksky, Game Dev, Blacksky, and Fountain Pens`,
      ),
    },
    {
      title: _(msg`Find your people`),
      description: _(
        msg`Ditch the trolls and clickbait. Find real people and conversations that matter to you.`,
      ),
      alt: _(
        msg`Your profile picture surrounded by concentric circles of other users' profile pictures`,
      ),
    },
    {
      title: _(msg`Forget the noise`),
      description: _(
        msg`No ads, no invasive tracking, no engagement traps. Bluesky respects your time and attention.`,
      ),
      alt: _(
        msg`An illustration of several Bluesky posts alongside repost, like, and comment icons`,
      ),
    },
  ][step]
}

export function Dot({active}: {active: boolean}) {
  const t = useTheme()

  return (
    <View
      style={[
        a.rounded_full,
        {width: 8, height: 8},
        active
          ? {backgroundColor: t.palette.primary_500}
          : t.atoms.bg_contrast_50,
      ]}
    />
  )
}
