import {Trans, useLingui} from '@lingui/react/macro'

import {Admonition} from '#/components/Admonition'
import {IS_PARTNER_PREVIEW} from '#/env'

/**
 * Temporary: Oso signups open at the start of the testing phase. Remove this
 * feature once that date has passed.
 */
const SIGNUP_OPENS_AT = new Date('2026-10-23T15:00:00+02:00')

/**
 * Whether account creation is still closed. Evaluated on each call so an open
 * page picks up the opening time on its next render.
 */
export function isSignupClosed() {
  return IS_PARTNER_PREVIEW && Date.now() < SIGNUP_OPENS_AT.getTime()
}

/**
 * Tells visitors when signups open, shown in place of "Create account".
 */
export function SignupClosedNotice() {
  /*
   * The i18n object stays the same when the language changes, so React
   * Compiler would keep the date in the language it first rendered in (often
   * English, before the reader's language loads).
   */
  'use no memo'
  const {i18n} = useLingui()
  const date = i18n.date(SIGNUP_OPENS_AT, {day: 'numeric', month: 'long'})

  return (
    <Admonition type="info">
      <Trans>
        Please note: it isn’t possible to create an account yet. The testing
        phase starts on {date}, and from then on you can sign up on this website
        to take part.
      </Trans>
    </Admonition>
  )
}
