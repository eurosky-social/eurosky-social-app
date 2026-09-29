import {ScrollView} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon} from '#/components/icons/Chevron'
import {Earth_Stroke2_Corner2_Rounded as LatestIcon} from '#/components/icons/Globe'
import {Newspaper_Stroke2_Corner2_Rounded as MyNewsIcon} from '#/components/icons/Newspaper'
import {Newspaper2_Stroke2_Corner2_Rounded as NewsroomsIcon} from '#/components/icons/Newspaper2'
import {PinLocation_Stroke2_Corner0_Rounded as LocalIcon} from '#/components/icons/PinLocation'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {IS_DUTCH_API_CONFIGURED} from '../dutch/config'

/**
 * The hub's top-level pages. `newsrooms` is not a tab but the link at the end
 * of the row (see `NewsroomsLink`), so on that page it is the link that lights.
 */
export type NewsroomHubTab = 'latest' | 'local' | 'newsrooms' | 'mine'

/**
 * The newsroom hub's primary navigation: the pages it is made of, as a
 * row of pills under the header. Each tab is a route of its own so a page can
 * be linked to and returned to; the row only marks which one is open.
 *
 * Tinted in the app accent so they read as a level above the topic chips,
 * which are monochrome and filter within a page rather than leave it.
 */
export function NewsroomHubTabs({active}: {active: NewsroomHubTab}) {
  const t = useTheme()
  const {t: l} = useLingui()

  const tabs = [
    {
      id: 'latest',
      to: '/newsroom/explore',
      icon: LatestIcon,
      text: l`Latest`,
      label: l`Show the latest news`,
    },
    {
      id: 'local',
      to: '/newsroom/local',
      icon: LocalIcon,
      text: l`Local`,
      label: l`Show local news`,
    },
    {
      id: 'mine',
      to: '/news',
      icon: MyNewsIcon,
      text: l`My News`,
      label: l`Show your news feed`,
    },
  ] as const

  /*
   * Only the Dutch source knows which stories are regional, so on any other
   * source the tab would always be empty.
   */
  const visibleTabs = tabs.filter(
    tab => tab.id !== 'local' || IS_DUTCH_API_CONFIGURED,
  )

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      testID="newsroomHubTabs"
      style={[a.border_b, t.atoms.border_contrast_low]}
      /* Grows to the row's width so the newsrooms link can sit at its end. */
      contentContainerStyle={[
        a.flex_grow,
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.p_md,
      ]}>
      {visibleTabs.map(tab => {
        const isActive = tab.id === active
        const color = isActive
          ? t.palette.primary_500
          : t.atoms.text_contrast_medium.color
        return (
          <Link
            key={tab.id}
            testID={`newsroomHubTab-${tab.id}`}
            to={tab.to}
            label={tab.label}
            accessibilityState={{selected: isActive}}
            style={[
              a.flex_row,
              a.align_center,
              a.gap_sm,
              a.px_md,
              a.py_sm,
              a.rounded_full,
              a.border,
              isActive
                ? {
                    borderColor: t.palette.primary_500,
                    backgroundColor: t.palette.primary_25,
                  }
                : [t.atoms.border_contrast_low, t.atoms.bg_contrast_25],
            ]}>
            <tab.icon size="md" style={{color}} />
            <Text numberOfLines={1} style={[a.text_sm, a.font_bold, {color}]}>
              {tab.text}
            </Text>
          </Link>
        )
      })}
      <NewsroomsLink active={active === 'newsrooms'} />
    </ScrollView>
  )
}

/**
 * The way into the newsroom list, at the far end of the tab row. The tabs are
 * ways of reading the news and this is where the outlets themselves are
 * found, so it is set apart - pushed to the end, outlined rather than filled,
 * and pointing onward - while staying on the same line as the tabs.
 */
function NewsroomsLink({active}: {active: boolean}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const color = active
    ? t.palette.primary_500
    : t.atoms.text_contrast_medium.color

  return (
    <Link
      testID="newsroomHubNewsroomsLink"
      to="/newsrooms"
      label={l`Browse every newsroom`}
      accessibilityState={{selected: active}}
      style={[
        a.ml_auto,
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.px_md,
        a.py_sm,
        a.rounded_full,
        a.border,
        active
          ? {
              borderColor: t.palette.primary_500,
              backgroundColor: t.palette.primary_25,
            }
          : t.atoms.border_contrast_low,
      ]}>
      <NewsroomsIcon size="md" style={{color}} />
      <Text numberOfLines={1} style={[a.text_sm, a.font_bold, {color}]}>
        {l`Newsrooms`}
      </Text>
      <ChevronRightIcon size="xs" style={{color}} />
    </Link>
  )
}
