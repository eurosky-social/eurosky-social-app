import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

export type AccountAction = 'delete' | 'deactivate'

/**
 * Deleting or deactivating acts on the whole atproto account, which other apps
 * use too. Make that explicit before anyone starts either flow.
 */
export function AccountActionWarning({action}: {action: AccountAction}) {
  const t = useTheme()

  return (
    <Text
      style={[
        a.mb_lg,
        a.text_md,
        a.leading_snug,
        a.font_semi_bold,
        t.atoms.text,
      ]}>
      {action === 'delete' ? (
        <Trans>
          This will delete your Atmosphere account and remove access to all apps
          you use with it.
        </Trans>
      ) : (
        <Trans>
          This will deactivate your Atmosphere account and remove access to all
          apps you use with it.
        </Trans>
      )}
    </Text>
  )
}
