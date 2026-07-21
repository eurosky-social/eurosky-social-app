import {ScrollView, View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {useSession} from '#/state/session'
import {useLogoVariant} from '#/view/icons/useLogoVariant'
import {DesktopFeeds} from '#/view/shell/desktop/Feeds'
import {DesktopSearch} from '#/view/shell/desktop/Search'
import {
  atoms as a,
  tokens,
  useGutters,
  useLayoutBreakpoints,
  useTheme,
  web,
} from '#/alf'
import {AppLanguageDropdown} from '#/components/AppLanguageDropdown'
import {ButtonIcon, ButtonText} from '#/components/Button'
import {Message_Stroke2_Corner0_Rounded as Message} from '#/components/icons/Message'
import {CENTER_COLUMN_OFFSET} from '#/components/Layout'
import {InlineLinkText, Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {NewsFeedRightRail} from '#/features/newsFeed/components/NewsFeedRightRail'
import {NewsroomRightRail} from '#/features/newsrooms/components/NewsroomRightRail'

export function DesktopRightNav({routeName}: {routeName: string}) {
  const t = useTheme()
  const {_} = useLingui()
  const {hasSession} = useSession()
  const logoVariant = useLogoVariant()
  const gutters = useGutters(['base', 0, 'base', 'wide'])
  const isSearchScreen = routeName === 'Search'
  const isMessagesRelatedScreen = routeName.startsWith('Messages')
  const {rightNavVisible, centerColumnOffset, leftNavMinimal} =
    useLayoutBreakpoints()

  if (!rightNavVisible || isMessagesRelatedScreen) {
    return null
  }

  const width = centerColumnOffset ? 250 : 300

  // The news surfaces swap the default search/feeds column for their own
  // rails, each cross-linking the other.
  const railContent =
    routeName === 'Newsroom' ? (
      <NewsroomRightRail />
    ) : routeName === 'NewsFeed' ? (
      <NewsFeedRightRail />
    ) : null

  if (railContent) {
    return (
      <View
        style={[
          {
            // The rail's modules carry their own px_lg edge padding and 2xl
            // top padding (they are shared with the Explore screen), so back
            // those out of the shell gutters to keep the rail's content
            // aligned with the other right columns.
            paddingTop: 0,
            paddingBottom: gutters.paddingBottom,
            paddingLeft: gutters.paddingLeft - tokens.space.lg,
          },
          a.pr_2xs,
          web({
            position: 'fixed',
            left: '50%',
            transform: [
              {
                translateX:
                  300 + (centerColumnOffset ? CENTER_COLUMN_OFFSET : 0),
              },
              ...a.scrollbar_offset.transform,
            ],
            width: width + gutters.paddingLeft + 2,
            maxHeight: '100vh',
          }),
        ]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {railContent}
        </ScrollView>
      </View>
    )
  }

  return (
    <View
      style={[
        gutters,
        a.gap_lg,
        a.pr_2xs,
        web({
          position: 'fixed',
          left: '50%',
          transform: [
            {
              translateX: 300 + (centerColumnOffset ? CENTER_COLUMN_OFFSET : 0),
            },
            ...a.scrollbar_offset.transform,
          ],
          /**
           * Compensate for the right padding above (2px) to retain intended width.
           */
          width: width + gutters.paddingLeft + 2,
          maxHeight: '100vh',
        }),
      ]}>
      {!isSearchScreen && <DesktopSearch />}

      {hasSession && <DesktopFeeds />}

      <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
        <Link
          to={BRAND.links.donate}
          label={_(msg`Donate`)}
          color="secondary"
          size="small"
          variant="outline"
          style={{backgroundColor: 'transparent'}}>
          <ButtonText>
            <Trans>Donate</Trans>
          </ButtonText>
        </Link>
        {hasSession && (
          <Link
            to={BRAND.links.feedback}
            label={_(msg`Send feedback`)}
            color="secondary"
            size="small"
            variant="outline"
            style={{backgroundColor: 'transparent'}}>
            <ButtonIcon icon={Message} position="left" />
            <ButtonText>
              <Trans>Feedback</Trans>
            </ButtonText>
          </Link>
        )}
      </View>

      <Text style={[a.leading_snug, t.atoms.text_contrast_low]}>
        <InlineLinkText
          to={BRAND.links.privacy}
          style={[t.atoms.text_contrast_medium]}
          label={_(msg`Privacy`)}>
          {_(msg`Privacy`)}
        </InlineLinkText>
        <Text style={[t.atoms.text_contrast_low]}>{' ∙ '}</Text>
        <InlineLinkText
          to={BRAND.links.tos}
          style={[t.atoms.text_contrast_medium]}
          label={_(msg`Terms`)}>
          {_(msg`Terms`)}
        </InlineLinkText>
      </Text>

      {logoVariant === 'kawaii' && (
        <Text style={[t.atoms.text_contrast_medium, {marginTop: 12}]}>
          <Trans>
            Logo by{' '}
            <InlineLinkText
              label={_(msg`Logo by @sawaratsuki.bsky.social`)}
              to="/profile/sawaratsuki.bsky.social">
              @sawaratsuki.bsky.social
            </InlineLinkText>
          </Trans>
        </Text>
      )}

      {!hasSession && leftNavMinimal && (
        <View style={[a.w_full, {height: 32}]}>
          <AppLanguageDropdown />
        </View>
      )}
    </View>
  )
}
