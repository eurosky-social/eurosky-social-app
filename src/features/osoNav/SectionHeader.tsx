import {View} from 'react-native'

import {atoms as a} from '#/alf'
import {Link} from '#/components/Link'
import {type OsoPillKind, OsoTitlePill, useOsoPill} from './pills'

/**
 * A section heading inside an Oso page: the section's pill (without the logo
 * page titles carry), linking to the section's own page when `to` is set, and
 * an optional action on the right.
 */
export function OsoSectionHeader({
  kind,
  to,
  right,
}: {
  kind: OsoPillKind
  /** The page the section previews, opened by pressing the pill. */
  to?: string
  right?: React.ReactNode
}) {
  const pill = useOsoPill(kind)

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.justify_between,
        a.gap_md,
        a.px_lg,
        a.pt_xl,
        a.pb_md,
      ]}>
      {to ? (
        <Link to={to} label={pill.label} style={[a.rounded_full]}>
          <OsoTitlePill kind={kind} withLogo={false} />
        </Link>
      ) : (
        <OsoTitlePill kind={kind} withLogo={false} />
      )}
      {right}
    </View>
  )
}
