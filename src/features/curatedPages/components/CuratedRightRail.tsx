import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import * as ModuleHeader from '#/screens/Search/components/ModuleHeader'
import {atoms as a, useTheme} from '#/alf'
import {ButtonText} from '#/components/Button'
import {Newspaper_Stroke2_Corner2_Rounded as NewspaperIcon} from '#/components/icons/Newspaper'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {ExploreLiveSportsWidget} from '#/features/liveSports/components/ExploreLiveSportsWidget'

/**
 * The curated hub's right column: the cross-network context that sits beside any
 * focused org - the broader curated news feed and live sports. These are
 * app-wide destinations, deliberately distinct from the org-specific front page
 * and conversation in the center column.
 */
export function CuratedRightRail() {
  return (
    <View>
      <NewsModule />
      <ExploreLiveSportsWidget />
    </View>
  )
}

function NewsModule() {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View style={[a.pb_xl]}>
      <ModuleHeader.Container>
        <ModuleHeader.Icon icon={NewspaperIcon} />
        <ModuleHeader.TitleText>{l`Your News`}</ModuleHeader.TitleText>
      </ModuleHeader.Container>
      <View style={[a.px_lg, a.gap_md]}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Your personalized feed of stories from across your sources.
          </Trans>
        </Text>
        <Link
          to="/news"
          label={l`Open your news feed`}
          color="primary"
          size="large"
          style={[a.w_full, a.justify_center]}>
          <ButtonText>
            <Trans>Open news feed</Trans>
          </ButtonText>
        </Link>
      </View>
    </View>
  )
}
