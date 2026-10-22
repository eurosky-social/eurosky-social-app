import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {InlineLinkText} from '#/components/Link'
import {Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {IS_PARTNER_PREVIEW} from '#/env'

/**
 * The FAQ, legal, donate and feedback links shown in a desktop side column:
 * the right one by default, the bottom of the left side bar for Oso.
 */
export function DesktopLegalLinks() {
  const t = useTheme()
  const {_} = useLingui()
  const {hasSession} = useSession()
  // Oso shows these under the left side bar, one size down from body text.
  const size = IS_PARTNER_PREVIEW ? a.text_xs : a.text_sm

  return (
    <Text style={[size, a.leading_snug, t.atoms.text_contrast_low]}>
      {IS_PARTNER_PREVIEW && (
        <>
          <InlineLinkText
            to={BRAND.links.faq}
            style={[size, t.atoms.text_contrast_medium]}
            label={_(msg`FAQ`)}>
            {_(msg`FAQ`)}
          </InlineLinkText>
          <Text style={[size, t.atoms.text_contrast_low]}>{' ∙ '}</Text>
        </>
      )}
      <InlineLinkText
        to={BRAND.links.privacy}
        style={[size, t.atoms.text_contrast_medium]}
        label={_(msg`Privacy`)}>
        {_(msg`Privacy`)}
      </InlineLinkText>
      <Text style={[size, t.atoms.text_contrast_low]}>{' ∙ '}</Text>
      <InlineLinkText
        to={BRAND.links.tos}
        style={[size, t.atoms.text_contrast_medium]}
        label={_(msg`Terms`)}>
        {_(msg`Terms`)}
      </InlineLinkText>
      {IS_PARTNER_PREVIEW && (
        <>
          <Text style={[size, t.atoms.text_contrast_low]}>{' ∙ '}</Text>
          <InlineLinkText
            to={BRAND.links.community}
            style={[size, t.atoms.text_contrast_medium]}
            label={_(msg`Guidelines`)}>
            {_(msg`Guidelines`)}
          </InlineLinkText>
          <Text style={[size, t.atoms.text_contrast_low]}>{' ∙ '}</Text>
          <InlineLinkText
            to={BRAND.links.copyright}
            style={[size, t.atoms.text_contrast_medium]}
            label={_(msg`Copyright`)}>
            {_(msg`Copyright`)}
          </InlineLinkText>
          <Text style={[size, t.atoms.text_contrast_low]}>{' ∙ '}</Text>
          <InlineLinkText
            disableMismatchWarning
            to={BRAND.links.donate}
            style={[size, t.atoms.text_contrast_medium]}
            label={_(msg`Donate`)}>
            {_(msg`Donate`)}
          </InlineLinkText>
          {hasSession && (
            <>
              <Text style={[size, t.atoms.text_contrast_low]}>{' ∙ '}</Text>
              <InlineLinkText
                disableMismatchWarning
                to={BRAND.links.feedback}
                style={[size, t.atoms.text_contrast_medium]}
                label={_(msg`Send feedback`)}>
                {_(msg`Feedback`)}
              </InlineLinkText>
            </>
          )}
        </>
      )}
    </Text>
  )
}
