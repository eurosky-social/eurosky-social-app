import {Fragment, useRef, useState} from 'react'
import {View} from 'react-native'
import Animated, {useAnimatedStyle} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {useShellLayout} from '#/state/shell/shell-layout'
import {atoms as a} from '#/alf'
import {ButtonIcon, ButtonText} from '#/components/Button'
import {Newspaper_Stroke2_Corner2_Rounded as NewsFeedIcon} from '#/components/icons/Newspaper'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {NewsroomSwitcher} from '../components/NewsroomSwitcher'
import {NewsroomSwitcherMenu} from '../components/NewsroomSwitcherMenu'
import {NEWSROOM_PUBLISHERS, type NewsroomPublisher} from '../publishers'
import {useNewsroomProfilesQuery} from '../queries'
import {type ExploreStory, groupStoriesBySection} from './cluster'
import {
  ExploreColumn,
  ExploreHeaderOuter,
  ExploreSpreadBorders,
  useExploreSpread,
} from './components/ExploreColumn'
import {DepartmentColumn, DepartmentStrip} from './components/ExploreDepartment'
import {ExploreLeadBand} from './components/ExploreLeadBand'
import {ExploreSectionChips} from './components/ExploreSectionChips'
import {ExploreSectionFront} from './components/ExploreSectionFront'
import {BandRule, ColumnRule} from './components/Rules'
import {
  EXPLORE_SECTION_OTHER,
  EXPLORE_SECTIONS,
  type ExploreSection,
} from './sections'
import {useExploreStories} from './useExploreStories'

/** How many stories the opening band takes before the departments start. */
const TOP_STORIES_COUNT = 5

/** Above this spread width a band of departments runs three across, not two. */
const THREE_COLUMN_WIDTH = 1100

type SectionGroup = {section: ExploreSection; stories: ExploreStory[]}

/** Departments laid side by side, or one running the full width of the page. */
type Band =
  | {kind: 'columns'; groups: SectionGroup[]}
  | {kind: 'strip'; group: SectionGroup}

type Props = NativeStackScreenProps<CommonNavigatorParams, 'NewsroomExplore'>

/**
 * The newsroom hub's cross-publisher page: every registered newsroom's latest
 * articles in one spread, grouped into departments and clustered so a story
 * several outlets ran reads once.
 *
 * It is the one hub surface that is not a branded org space, so it runs from
 * the center column to the window's right edge (the shell hides the right rail
 * here) and is laid out as bands of unequal columns divided by rules, rather
 * than a grid of cards.
 */
export function NewsroomExploreScreen({navigation}: Props) {
  const {t: l} = useLingui()
  const {wide, width} = useExploreSpread()
  const {stories, isLoading} = useExploreStories()
  const profiles = useNewsroomProfilesQuery()
  const [sectionId, setSectionId] = useState<string | undefined>()
  const scrollRef = useRef<Animated.ScrollView>(null)
  /* The spread scrolls in its own view rather than `Layout.Content`, whose
   * center column it cannot widen, so it keeps clear of the shell footer
   * itself. */
  const {footerHeight} = useShellLayout()
  const scrollStyle = useAnimatedStyle(() => ({
    marginBottom: footerHeight.get(),
  }))

  /*
   * Explore is already the open page, so the rail's own tab does what a tab
   * does when you are on it: takes you back to the top.
   */
  function onSelectExplore() {
    scrollRef.current?.scrollTo({y: 0, animated: true})
  }

  function onSelectPublisher(publisher: NewsroomPublisher) {
    navigation.navigate('Newsroom', {name: publisher.did})
  }

  function onSelectSection(next: string | undefined) {
    setSectionId(next)
    scrollRef.current?.scrollTo({y: 0, animated: false})
  }

  const groups = groupStoriesBySection(stories, [
    ...EXPLORE_SECTIONS,
    EXPLORE_SECTION_OTHER,
  ])
  /*
   * The opening band belongs to the whole spread, so a section filter drops it
   * rather than promoting an unrelated story into the lead.
   */
  const focused = sectionId
    ? groups.find(group => group.section.id === sectionId)
    : undefined
  const topStories = focused ? [] : stories.slice(0, TOP_STORIES_COUNT)
  const departments = groups
    .map(group => ({
      ...group,
      stories: group.stories.filter(story => !topStories.includes(story)),
    }))
    .filter(group => group.stories.length > 0)

  const columnsPerBand = !wide ? 1 : width >= THREE_COLUMN_WIDTH ? 3 : 2
  const bands = buildBands(departments, columnsPerBand)

  return (
    <Layout.Screen testID="newsroomExploreScreen" noCenterBorders>
      <ExploreSpreadBorders />
      <ExploreHeaderOuter>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Explore Newsrooms</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Link
          testID="newsroomExploreNewsFeedBtn"
          to="/news"
          label={l`Open your news feed`}
          size="small"
          color="secondary">
          <ButtonIcon icon={NewsFeedIcon} />
          <ButtonText>
            <Trans>News</Trans>
          </ButtonText>
        </Link>
        <Layout.Header.Slot>
          <NewsroomSwitcherMenu
            exploreActive
            onSelect={onSelectPublisher}
            onSelectExplore={onSelectExplore}
          />
        </Layout.Header.Slot>
      </ExploreHeaderOuter>

      <Animated.ScrollView ref={scrollRef} style={scrollStyle}>
        <ExploreColumn>
          <NewsroomSwitcher
            publishers={NEWSROOM_PUBLISHERS}
            exploreActive
            onSelect={onSelectPublisher}
            onSelectExplore={onSelectExplore}
          />

          {/* Departments as a filter bar, straight under the rail: the page
           * opens on the news rather than on an explanation of itself. */}
          <View style={[a.py_sm]}>
            <ExploreSectionChips
              sections={groups.map(group => group.section)}
              selectedId={sectionId}
              onSelect={onSelectSection}
            />
          </View>
          <BandRule />

          {isLoading ? (
            <View style={[a.py_5xl, a.align_center]}>
              <Loader size="xl" />
            </View>
          ) : stories.length === 0 ? (
            <View style={[a.p_2xl, a.align_center]}>
              <Text style={[a.text_md, a.text_center]}>
                <Trans>No newsroom feeds are reachable right now.</Trans>
              </Text>
            </View>
          ) : focused ? (
            <ExploreSectionFront
              section={focused.section}
              stories={focused.stories}
              profiles={profiles}
              wide={wide}
              columns={columnsPerBand}
              onClear={() => onSelectSection(undefined)}
            />
          ) : (
            <>
              {topStories.length > 0 && (
                <>
                  <ExploreLeadBand
                    stories={topStories}
                    profiles={profiles}
                    wide={wide}
                  />
                  <BandRule />
                </>
              )}
              {bands.map(band => (
                <Fragment key={bandKey(band)}>
                  {band.kind === 'columns' ? (
                    <View style={[a.flex_row, a.align_stretch]}>
                      {band.groups.map((group, index) => (
                        <Fragment key={group.section.id}>
                          {index > 0 && <ColumnRule />}
                          <DepartmentColumn
                            section={group.section}
                            stories={group.stories}
                            profiles={profiles}
                            onOpenSection={() =>
                              onSelectSection(group.section.id)
                            }
                          />
                        </Fragment>
                      ))}
                      {/* Keeps a lone department in its own column rather than
                       * letting it run the width of a full band. */}
                      {band.groups.length < columnsPerBand &&
                        emptyColumns(columnsPerBand - band.groups.length)}
                    </View>
                  ) : (
                    <DepartmentStrip
                      section={band.group.section}
                      stories={band.group.stories}
                      profiles={profiles}
                      columns={columnsPerBand + 1}
                      onOpenSection={() =>
                        onSelectSection(band.group.section.id)
                      }
                    />
                  )}
                  <BandRule />
                </Fragment>
              ))}
            </>
          )}
        </ExploreColumn>
      </Animated.ScrollView>
    </Layout.Screen>
  )
}

/**
 * Alternates a band of department columns with a single department run across
 * the full width. The rhythm is what keeps the page from reading as a grid;
 * on one column (narrow screens) every department is simply its own band.
 */
function buildBands(groups: SectionGroup[], columnsPerBand: number): Band[] {
  if (columnsPerBand === 1) {
    return groups.map(group => ({kind: 'columns', groups: [group]}))
  }

  const bands: Band[] = []
  let index = 0
  while (index < groups.length) {
    bands.push({
      kind: 'columns',
      groups: groups.slice(index, index + columnsPerBand),
    })
    index += columnsPerBand
    /*
     * A strip needs enough stories to fill the width; a department with only
     * one or two left would leave the band half empty, so it waits for a
     * column instead.
     */
    const next = groups[index]
    if (next && next.stories.length >= columnsPerBand) {
      bands.push({kind: 'strip', group: next})
      index += 1
    }
  }
  return bands
}

function bandKey(band: Band): string {
  return band.kind === 'strip'
    ? `strip:${band.group.section.id}`
    : `columns:${band.groups.map(group => group.section.id).join(',')}`
}

function emptyColumns(count: number) {
  return Array.from({length: count}, (_, index) => (
    <View key={`empty-${index}`} style={[a.flex_1]} />
  ))
}
