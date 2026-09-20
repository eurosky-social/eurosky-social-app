import {useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {
  ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon,
  ChevronTop_Stroke2_Corner0_Rounded as ChevronUpIcon,
} from '#/components/icons/Chevron'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {useOgImageQuery} from '../../queries'
import {type ExploreStory} from '../cluster'
import {CoverageStack, PublisherLabel, StoryMeta} from './StoryByline'

type Profiles = Map<string, app.bsky.actor.defs.ProfileViewDetailed>

/**
 * A story given the lead treatment: image first, then source, headline, time.
 * One per band - the eye needs a single entry point into each block.
 */
export function StoryLead({
  story,
  profiles,
  postCount,
  size = 'section',
  hideCoverage = false,
}: {
  story: ExploreStory
  profiles: Profiles
  postCount?: number
  /** `hero` is the spread's own lead; `section` a department's. */
  size?: 'hero' | 'section'
  /** For the spread's lead, whose coverage gets a column of its own. */
  hideCoverage?: boolean
}) {
  const t = useTheme()
  const {lead} = story
  const hero = size === 'hero'
  /*
   * Leads carry the article's full-resolution og:image; some feeds (the
   * Guardian's among them) ship thumbnails far too small for this size. The
   * feed image shows immediately as the fallback while the scrape resolves.
   */
  const {data: ogImage} = useOgImageQuery({url: lead.item.link})
  const image = ogImage || lead.item.imageUrl

  return (
    <View style={[a.gap_sm]}>
      {!!image && (
        <Link to={lead.item.link} label={lead.item.title} style={[a.w_full]}>
          <Image
            accessibilityIgnoresInvertColors
            source={{uri: image}}
            style={[a.w_full, {aspectRatio: hero ? 3 / 2 : 16 / 9}]}
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
        style={[a.flex_col, a.align_start, a.gap_sm, a.w_full]}>
        <Text
          numberOfLines={hero ? 4 : 3}
          style={[
            hero ? a.text_2xl : a.text_md,
            a.font_bold,
            hero ? a.leading_tight : a.leading_snug,
            t.atoms.text,
          ]}>
          {lead.item.title}
        </Text>
        {hero && !!lead.item.description && (
          <Text
            numberOfLines={3}
            style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
            {lead.item.description}
          </Text>
        )}
      </Link>
      <StoryMeta article={lead} postCount={postCount} />
      {!hideCoverage && <StoryCoverage story={story} profiles={profiles} />}
    </View>
  )
}

/**
 * A story in a list: headline left, thumbnail right, so a column of them keeps
 * one left edge and scans as a list rather than a stack of tiles.
 */
export function StoryRow({
  story,
  profiles,
  postCount,
}: {
  story: ExploreStory
  profiles: Profiles
  postCount?: number
}) {
  const t = useTheme()
  const {lead} = story

  return (
    <View style={[a.gap_xs]}>
      <View style={[a.flex_row, a.gap_md, a.align_start]}>
        <View style={[a.flex_1, a.gap_xs]}>
          <PublisherLabel
            article={lead}
            profile={profiles.get(lead.publisher.did)}
          />
          <Link
            to={lead.item.link}
            label={lead.item.title}
            style={[a.flex_col, a.align_start, a.gap_xs, a.w_full]}>
            <Text
              numberOfLines={3}
              style={[a.text_md, a.font_bold, a.leading_snug, t.atoms.text]}>
              {lead.item.title}
            </Text>
          </Link>
          <StoryMeta article={lead} postCount={postCount} />
        </View>
        {!!lead.item.imageUrl && (
          <Link to={lead.item.link} label={lead.item.title}>
            <Image
              accessibilityIgnoresInvertColors
              source={{uri: lead.item.imageUrl}}
              style={{width: 92, height: 68}}
              contentFit="cover"
              transition={200}
            />
          </Link>
        )}
      </View>
      <StoryCoverage story={story} profiles={profiles} />
    </View>
  )
}

/**
 * A story as text alone. Most of the spread is set this way: with no thumbnail
 * competing, a column of headlines reads as a page of news rather than a feed
 * of tiles.
 */
export function StoryHeadline({
  story,
  profiles,
}: {
  story: ExploreStory
  profiles: Profiles
}) {
  const t = useTheme()
  const {lead} = story

  return (
    <View style={[a.gap_xs]}>
      <PublisherLabel
        article={lead}
        profile={profiles.get(lead.publisher.did)}
      />
      <Link
        to={lead.item.link}
        label={lead.item.title}
        style={[a.flex_col, a.align_start, a.gap_xs, a.w_full]}>
        <Text
          numberOfLines={3}
          style={[a.text_md, a.font_bold, a.leading_snug, t.atoms.text]}>
          {lead.item.title}
        </Text>
      </Link>
      <StoryMeta article={lead} />
      <StoryCoverage story={story} profiles={profiles} />
    </View>
  )
}

/**
 * The rest of a story's coverage, folded away until asked for. Expanding lists
 * each newsroom's own headline, since the difference between them is the
 * information - collapsed, it would just be a count.
 */
function StoryCoverage({
  story,
  profiles,
}: {
  story: ExploreStory
  profiles: Profiles
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [expanded, setExpanded] = useState(false)
  const others = story.coverage.slice(1)

  if (others.length === 0) return null

  return (
    <View style={[a.gap_sm]}>
      <Button
        label={
          expanded
            ? l`Hide the other newsrooms on this story`
            : l`Show the other newsrooms on this story`
        }
        onPress={() => setExpanded(!expanded)}
        style={[a.self_start, a.flex_row, a.align_center, a.gap_2xs]}>
        <CoverageStack articles={others} profiles={profiles} />
        {expanded ? (
          <ChevronUpIcon size="xs" style={{color: t.palette.primary_500}} />
        ) : (
          <ChevronDownIcon size="xs" style={{color: t.palette.primary_500}} />
        )}
      </Button>
      {expanded && (
        <View
          style={[a.gap_md, a.pl_md, a.border_l, t.atoms.border_contrast_low]}>
          {others.map(article => (
            <View key={article.publisher.id} style={[a.gap_xs]}>
              <PublisherLabel
                article={article}
                profile={profiles.get(article.publisher.did)}
              />
              <Link
                to={article.item.link}
                label={article.item.title}
                style={[a.flex_col, a.align_start, a.w_full]}>
                <Text
                  numberOfLines={2}
                  style={[a.text_sm, a.leading_snug, t.atoms.text]}>
                  {article.item.title}
                </Text>
              </Link>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
