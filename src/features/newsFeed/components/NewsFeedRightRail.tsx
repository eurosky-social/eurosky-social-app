import {useState} from 'react'
import {Pressable, View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import * as ModuleHeader from '#/screens/Search/components/ModuleHeader'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {
  ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon,
  ChevronTop_Stroke2_Corner0_Rounded as ChevronUpIcon,
} from '#/components/icons/Chevron'
import {Newspaper2_Stroke2_Corner2_Rounded as FrontpagesIcon} from '#/components/icons/Newspaper2'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {
  type Frontpage,
  frontpageFromOutlet,
  frontpagePath,
  storyCount,
  useFrontpageProfiles,
} from '#/features/frontpages/frontpages'
import {ExploreLiveSportsWidget} from '#/features/liveSports/components/ExploreLiveSportsWidget'
import {useDutchOutletsQuery} from '#/features/news/dutch/queries'
import {
  InterestLogos,
  outletOfFrontpage,
} from '#/features/news/explore/components/InterestLogos'
import {OutletIcon} from '#/features/news/explore/components/OutletIcon'
import {feedOutletsForInterest} from '#/features/news/explore/interests'
import {
  useInterestSubtitle,
  useInterestTitle,
} from '#/features/news/explore/useInterestTitle'
import {getPublisherName} from '#/features/news/publishers'
import {type app} from '#/lexicons'
import {type NewsInterest, useNewsFeedPrefsQuery} from '../state/prefs'
import {InterestEditDialog} from './interests/InterestEditDialog'

/**
 * The news feed's right column: the mirror of the frontpage rail's "Your News"
 * module, pointing the other way - into the publisher hubs - plus the same
 * cross-network live sports context.
 */
export function NewsFeedRightRail({
  selectedInterestId,
  onSelectInterest,
}: {
  /** The interest the feed is narrowed to, or none for all of them. */
  selectedInterestId?: string
  onSelectInterest: (interestId: string | undefined) => void
}) {
  return (
    <View>
      <OutletsModule
        selectedId={selectedInterestId}
        onSelect={onSelectInterest}
      />
      <ExploreLiveSportsWidget />
    </View>
  )
}

/** How many outlets the module features when the reader has no interests. */
const FEATURED_COUNT = 8

/**
 * The reader's interests, one card each, which pick the feed's accounts:
 * picking a card narrows the feed to that interest, and picking it again (or
 * "Show all") goes back to all of them. Without interests, the outlets with
 * the most current stories.
 */
function OutletsModule({
  selectedId,
  onSelect,
}: {
  selectedId?: string
  onSelect: (interestId: string | undefined) => void
}) {
  const {t: l} = useLingui()
  const {data: prefs} = useNewsFeedPrefsQuery()
  const interests = prefs?.interests ?? []
  const selected = interests.some(interest => interest.id === selectedId)
  const {outlets} = useDutchOutletsQuery()
  const editControl = Dialog.useDialogControl()
  /* The dialog stays mounted, so it can open as soon as one is picked. */
  const [editing, setEditing] = useState<NewsInterest | undefined>()

  if (!outlets) return null

  return (
    <View style={[a.pb_xl]}>
      {interests.length > 0 && (
        /* Finishing an edit narrows the feed to that interest. */
        <InterestEditDialog
          control={editControl}
          interest={editing ?? interests[0]}
          onSaved={saved => onSelect(saved.id)}
        />
      )}
      <ModuleHeader.Container>
        <ModuleHeader.Icon icon={FrontpagesIcon} />
        <ModuleHeader.TitleText>
          {interests.length > 0 ? l`Your interests` : l`Your outlets`}
        </ModuleHeader.TitleText>
        {selected && (
          <Button
            label={l`Show posts from all your interests`}
            size="tiny"
            color="secondary"
            onPress={() => onSelect(undefined)}>
            <ButtonText>
              <Trans>Show all</Trans>
            </ButtonText>
          </Button>
        )}
      </ModuleHeader.Container>
      <View style={[a.px_lg, a.gap_md]}>
        {interests.length > 0 ? (
          <View style={[a.gap_sm]}>
            {interests.map(interest => (
              <InterestOutlets
                key={interest.id}
                interest={interest}
                selected={interest.id === selectedId}
                onToggleSelected={() =>
                  onSelect(interest.id === selectedId ? undefined : interest.id)
                }
                onEdit={() => {
                  setEditing(interest)
                  editControl.open()
                }}
                frontpages={feedOutletsForInterest(interest, outlets).map(
                  frontpageFromOutlet,
                )}
              />
            ))}
          </View>
        ) : (
          <TopOutlets frontpages={outlets.map(frontpageFromOutlet)} />
        )}
        <Link
          to="/news/outlets"
          label={l`See all outlets`}
          color="primary"
          size="large"
          style={[a.w_full, a.justify_center]}>
          <ButtonText>
            <Trans>See all outlets</Trans>
          </ButtonText>
        </Link>
      </View>
    </View>
  )
}

/**
 * One interest as a card: its title, topics and how many outlets it brings
 * into the feed. Pressing it picks it for the feed; its chevron opens onto
 * its outlets, and its pencil onto its settings.
 */
function InterestOutlets({
  interest,
  frontpages,
  selected,
  onToggleSelected,
  onEdit,
}: {
  interest: NewsInterest
  frontpages: Frontpage[]
  selected: boolean
  onToggleSelected: () => void
  onEdit: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const titleOf = useInterestTitle()
  const subtitleOf = useInterestSubtitle()
  const [expanded, setExpanded] = useState(false)
  /* Only an open card needs every outlet's avatar. */
  const profiles = useFrontpageProfiles(expanded ? frontpages : [])
  const title = titleOf(interest)
  const count = plural(frontpages.length, {one: '# outlet', other: '# outlets'})

  return (
    <View
      style={[
        a.rounded_md,
        a.border,
        a.overflow_hidden,
        selected
          ? {borderColor: t.palette.primary_500}
          : t.atoms.border_contrast_low,
      ]}>
      <View
        style={[
          a.flex_row,
          a.align_center,
          selected
            ? {backgroundColor: t.palette.primary_25}
            : t.atoms.bg_contrast_25,
        ]}>
        <Pressable
          accessibilityRole="button"
          aria-pressed={selected}
          accessibilityLabel={title}
          accessibilityHint={
            selected
              ? l`Shows posts from all your interests again`
              : l`Shows only this interest’s posts in the feed`
          }
          onPress={onToggleSelected}
          style={({pressed}) => [
            a.flex_1,
            a.flex_row,
            a.align_center,
            a.gap_sm,
            a.pl_md,
            a.pr_xs,
            a.py_sm,
            pressed && t.atoms.bg_contrast_50,
          ]}>
          <View style={[a.flex_1, a.gap_xs]}>
            <Text emoji numberOfLines={1} style={[a.text_sm, a.font_semi_bold]}>
              {title}
            </Text>
            <View style={[a.flex_row, a.align_center, a.gap_xs]}>
              <InterestLogos interest={interest} frontpages={frontpages} />
              <Text
                numberOfLines={1}
                style={[a.flex_1, a.text_xs, t.atoms.text_contrast_medium]}>
                {subtitleOf(interest)} · {count}
              </Text>
            </View>
          </View>
        </Pressable>
        {/* Beside the card's button rather than in it: buttons cannot nest. */}
        <Button
          aria-expanded={expanded}
          label={
            expanded
              ? l`Hide the outlets of ${title}`
              : l`Show the outlets of ${title}`
          }
          onPress={() => setExpanded(!expanded)}
          size="small"
          color="secondary"
          variant="ghost"
          shape="round">
          <ButtonIcon icon={expanded ? ChevronUpIcon : ChevronDownIcon} />
        </Button>
        <Button
          label={l`Edit ${title}`}
          onPress={onEdit}
          size="small"
          color="secondary"
          variant="ghost"
          shape="round"
          style={[a.mr_xs]}>
          <ButtonIcon icon={PencilIcon} />
        </Button>
      </View>
      {expanded && (
        <View
          style={[a.gap_md, a.p_md, a.border_t, t.atoms.border_contrast_low]}>
          {frontpages.length > 0 ? (
            frontpages.map(frontpage => (
              <FeaturedFrontpage
                key={frontpage.slug}
                frontpage={frontpage}
                profile={
                  frontpage.did ? profiles.get(frontpage.did) : undefined
                }
              />
            ))
          ) : (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>None of its outlets post on the network yet.</Trans>
            </Text>
          )}
        </View>
      )}
    </View>
  )
}

/** The outlets with the most current stories, for a reader with no interests. */
function TopOutlets({frontpages}: {frontpages: Frontpage[]}) {
  const t = useTheme()
  const featured = [...frontpages]
    .sort((x, y) => storyCount(y) - storyCount(x))
    .slice(0, FEATURED_COUNT)
  const profiles = useFrontpageProfiles(featured)

  return (
    <>
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>The outlets with the most stories right now</Trans>
      </Text>
      <View style={[a.gap_md]}>
        {featured.map(frontpage => (
          <FeaturedFrontpage
            key={frontpage.slug}
            frontpage={frontpage}
            profile={frontpage.did ? profiles.get(frontpage.did) : undefined}
          />
        ))}
      </View>
    </>
  )
}

function FeaturedFrontpage({
  frontpage,
  profile,
}: {
  frontpage: Frontpage
  profile?: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const {t: l} = useLingui()
  const name = getPublisherName(profile) || frontpage.name

  return (
    <Link
      to={frontpagePath(frontpage)}
      label={l`Open the ${name} frontpage`}
      style={[a.flex_row, a.align_center, a.gap_sm]}>
      <OutletIcon
        outlet={outletOfFrontpage(frontpage)}
        profile={profile}
        size={28}
      />
      <Text emoji numberOfLines={1} style={[a.flex_1, a.text_sm, a.font_bold]}>
        {name}
      </Text>
    </Link>
  )
}
