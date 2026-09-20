import {Fragment} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {Divider} from '#/components/Divider'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon} from '#/components/icons/Chevron'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {type ExploreStory} from '../cluster'
import {type ExploreSection} from '../sections'
import {ColumnRule} from './Rules'
import {PublisherLabel, StoryMeta} from './StoryByline'
import {StoryHeadline, StoryLead} from './StoryCard'

/** Stories in a department column before its own filter takes over. */
const COLUMN_STORIES = 4

/** Stories across a full-width department strip. */
const STRIP_STORIES = 4

/**
 * A department as one column of a band: its name, a lead with a picture, then
 * headlines. No frame - the band's rules already say where it starts and ends.
 */
export function DepartmentColumn({
  section,
  stories,
  profiles,
  onOpenSection,
}: {
  section: ExploreSection
  stories: ExploreStory[]
  profiles: Map<string, app.bsky.actor.defs.ProfileViewDetailed>
  onOpenSection: () => void
}) {
  const [lead, ...rest] = stories.slice(0, COLUMN_STORIES)

  return (
    <View style={[a.flex_1, a.p_lg, a.gap_md]}>
      <DepartmentHeading
        section={section}
        count={stories.length}
        onPress={onOpenSection}
      />
      {!!lead && <StoryLead story={lead} profiles={profiles} />}
      {rest.map(story => (
        <View key={story.id} style={[a.gap_md]}>
          <Divider />
          <StoryHeadline story={story} profiles={profiles} />
        </View>
      ))}
    </View>
  )
}

/**
 * A department across the full spread: the same stories in a row of picture
 * columns. Breaking the rhythm of the taller bands is the point - a page of
 * identical columns reads as a grid, not as a front page.
 */
export function DepartmentStrip({
  section,
  stories,
  profiles,
  onOpenSection,
  columns,
}: {
  section: ExploreSection
  stories: ExploreStory[]
  profiles: Map<string, app.bsky.actor.defs.ProfileViewDetailed>
  onOpenSection: () => void
  /** How many stories fit across at this width. */
  columns: number
}) {
  const shown = stories.slice(0, Math.min(STRIP_STORIES, columns))

  return (
    <View style={[a.p_lg, a.gap_md]}>
      <DepartmentHeading
        size="band"
        section={section}
        count={stories.length}
        onPress={onOpenSection}
      />
      <View style={[a.flex_row, a.align_stretch]}>
        {shown.map((story, index) => (
          <Fragment key={story.id}>
            {index > 0 && <ColumnRule />}
            <View style={[a.flex_1, index > 0 && a.pl_lg, a.pr_lg]}>
              <StripStory story={story} profiles={profiles} />
            </View>
          </Fragment>
        ))}
      </View>
    </View>
  )
}

/** One story in a strip: picture over source, headline, time. */
export function StripStory({
  story,
  profiles,
}: {
  story: ExploreStory
  profiles: Map<string, app.bsky.actor.defs.ProfileViewDetailed>
}) {
  const t = useTheme()
  const {lead} = story

  return (
    <View style={[a.flex_1, a.gap_sm]}>
      {!!lead.item.imageUrl && (
        <Link to={lead.item.link} label={lead.item.title} style={[a.w_full]}>
          <Image
            accessibilityIgnoresInvertColors
            source={{uri: lead.item.imageUrl}}
            style={[a.w_full, {aspectRatio: 4 / 3}]}
            contentFit="cover"
            transition={200}
          />
        </Link>
      )}
      <PublisherLabel
        article={lead}
        profile={profiles.get(lead.publisher.did)}
      />
      <Link
        to={lead.item.link}
        label={lead.item.title}
        style={[a.flex_col, a.align_start, a.w_full]}>
        <Text
          numberOfLines={3}
          style={[a.text_md, a.font_bold, a.leading_snug, t.atoms.text]}>
          {lead.item.title}
        </Text>
      </Link>
      <StoryMeta article={lead} />
    </View>
  )
}

/** A department's name, which is also the way into that section alone. */
function DepartmentHeading({
  section,
  count,
  onPress,
  size = 'column',
}: {
  section: ExploreSection
  count: number
  onPress: () => void
  /** A department running the full width carries a larger name. */
  size?: 'column' | 'band'
}) {
  const t = useTheme()
  const {i18n, t: l} = useLingui()
  const name = i18n._(section.label)

  return (
    <Button
      label={l`Show only ${name}`}
      onPress={onPress}
      style={[a.flex_row, a.align_center, a.gap_xs, a.pb_xs]}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={[
          a.flex_1,
          size === 'band' ? a.text_2xl : a.text_md,
          a.font_bold,
          a.text_left,
          t.atoms.text,
        ]}>
        {name}
      </Text>
      <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
        {plural(count, {one: '# story', other: '# stories'})}
      </Text>
      <ChevronRightIcon size="xs" style={t.atoms.text_contrast_medium} />
    </Button>
  )
}
