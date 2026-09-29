import {Fragment, useRef, useState} from 'react'
import {View} from 'react-native'
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
} from 'react-native-reanimated'
import {Trans} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {useShellLayout} from '#/state/shell/shell-layout'
import {atoms as a, native, useTheme, web} from '#/alf'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {NewsroomHubTabs} from '../hub/NewsroomHubTabs'
import {useCollapsingTitle} from '../hub/useCollapsingTitle'
import {useNewsroomProfilesQuery} from '../queries'
import {type ExploreStory, groupStoriesBySection} from './cluster'
import {
  ExploreColumn,
  ExploreHeaderOuter,
  ExploreSpreadBorders,
  useExploreSpread,
} from './components/ExploreColumn'
import {DepartmentColumn, DepartmentStrip} from './components/ExploreDepartment'
import {
  ExploreLeadBand,
  LEAD_BAND_DEFAULT_STORIES,
  LEAD_BAND_MAX_STORIES,
} from './components/ExploreLeadBand'
import {
  ExploreLocationPicker,
  LocationPickerRule,
} from './components/ExploreLocationPicker'
import {ExploreSectionChips} from './components/ExploreSectionChips'
import {ExploreSectionFront} from './components/ExploreSectionFront'
import {BandRule, ColumnRule} from './components/Rules'
import {type ExploreSection} from './sections'
import {useExploreSource} from './useExploreSource'

/** Above this spread width a band of departments runs three across, not two. */
const THREE_COLUMN_WIDTH = 1100

type SectionGroup = {section: ExploreSection; stories: ExploreStory[]}

/** Departments laid side by side, or one running the full width of the page. */
type Band =
  | {kind: 'columns'; groups: SectionGroup[]}
  | {kind: 'strip'; group: SectionGroup}

/**
 * The hub's opening page: every registered newsroom's latest articles in one
 * spread, grouped into departments and clustered so a story several outlets
 * ran reads once.
 */
export function NewsroomExploreScreen(
  _props: NativeStackScreenProps<CommonNavigatorParams, 'NewsroomExplore'>,
) {
  return <ExploreSpreadScreen />
}

/**
 * The Dutch labeler's regional stories. Which region is the reader's is not
 * modeled yet, so for now this is every story it places in a province; the
 * filter tightens once there is a locale to tighten it to.
 */
export function NewsroomLocalScreen(
  _props: NativeStackScreenProps<CommonNavigatorParams, 'NewsroomLocal'>,
) {
  return <ExploreSpreadScreen local />
}

/**
 * The cross-publisher spread behind both the Latest News and Local News
 * tabs.
 *
 * It is not a branded org space, so it runs from the center column to the
 * window's right edge (the shell hides the right rail here) and is laid out as
 * bands of unequal columns divided by rules, rather than a grid of cards.
 */
function ExploreSpreadScreen({local = false}: {local?: boolean}) {
  const t = useTheme()
  const {wide, width} = useExploreSpread()
  const source = useExploreSource({source: local ? 'dutch' : 'rss'})
  const [region, setRegion] = useState<string | undefined>()
  const stories = local
    ? source.stories.filter(
        story =>
          !!story.regions?.length &&
          (!region || story.regions.includes(region)),
      )
    : source.stories
  const {sections, isLoading} = source
  const profiles = useNewsroomProfilesQuery()
  const [sectionId, setSectionId] = useState<string | undefined>()
  const [leadBandCount, setLeadBandCount] = useState(LEAD_BAND_DEFAULT_STORIES)
  const scrollRef = useRef<Animated.ScrollView>(null)
  const titleCollapse = useCollapsingTitle()
  const titleScrollHandler = useAnimatedScrollHandler(event => {
    titleCollapse.onScroll(event)
  })
  /* The spread scrolls in its own view rather than `Layout.Content`, whose
   * center column it cannot widen, so it keeps clear of the shell footer
   * itself. */
  const {footerHeight} = useShellLayout()
  const scrollStyle = useAnimatedStyle(() => ({
    marginBottom: footerHeight.get(),
  }))

  /* Web scrolls the window rather than the spread's own view. */
  function scrollToTop() {
    scrollRef.current?.scrollTo({y: 0, animated: false})
    if (IS_WEB) window.scrollTo({top: 0})
  }

  function onSelectSection(next: string | undefined) {
    setSectionId(next)
    scrollToTop()
  }

  const groups = groupStoriesBySection(stories, sections)
  /*
   * The opening band belongs to the whole spread, so a section filter drops it
   * rather than promoting an unrelated story into the lead.
   */
  const focused = sectionId
    ? groups.find(group => group.section.id === sectionId)
    : undefined
  const topStories = focused ? [] : stories.slice(0, LEAD_BAND_MAX_STORIES)
  /* Only what the band actually shows is kept out of the departments. */
  const shownAtTop = topStories.slice(0, leadBandCount)
  const departments = groups
    .map(group => ({
      ...group,
      stories: group.stories.filter(story => !shownAtTop.includes(story)),
    }))
    .filter(group => group.stories.length > 0)

  const columnsPerBand = !wide ? 1 : width >= THREE_COLUMN_WIDTH ? 3 : 2
  const bands = buildBands(departments, columnsPerBand)

  return (
    <Layout.Screen testID="newsroomExploreScreen" noCenterBorders>
      <ExploreSpreadBorders />
      {/* Header, tabs and topic chips pin together. It is one block outside
       * the spread's scroll view because on web the window scrolls, which a
       * sticky header inside the scroll view cannot follow; on native, sitting
       * above the scroll view is enough to stay put. */}
      <View
        pointerEvents="box-none"
        style={[web([a.sticky, {top: 0}]), native(a.overflow_hidden), a.z_10]}>
        <Animated.View style={titleCollapse.blockStyle}>
          <View onLayout={titleCollapse.onTitleLayout}>
            <ExploreHeaderOuter>
              <Layout.Header.BackButton />
              <Layout.Header.Content>
                <Layout.Header.TitleText>
                  <Trans>Mu News</Trans>
                </Layout.Header.TitleText>
              </Layout.Header.Content>
            </ExploreHeaderOuter>
          </View>
          <ExploreColumn style={[t.atoms.bg]}>
            <NewsroomHubTabs active={local ? 'local' : 'latest'} />
            {/* Departments as a filter bar, straight under the tabs: the page
             * opens on the news rather than on an explanation of itself. */}
            <View style={[a.py_sm]}>
              <ExploreSectionChips
                sections={groups.map(group => group.section)}
                selectedId={sectionId}
                onSelect={onSelectSection}
                leading={
                  local && (
                    <>
                      <ExploreLocationPicker
                        selected={region}
                        onSelect={next => {
                          setRegion(next)
                          scrollToTop()
                        }}
                      />
                      <LocationPickerRule />
                    </>
                  )
                }
              />
            </View>
            <BandRule />
          </ExploreColumn>
        </Animated.View>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        style={scrollStyle}
        onScroll={titleScrollHandler}
        scrollEventThrottle={16}>
        <ExploreColumn>
          {isLoading ? (
            <View style={[a.py_5xl, a.align_center]}>
              <Loader size="xl" />
            </View>
          ) : stories.length === 0 ? (
            <View style={[a.p_2xl, a.align_center]}>
              <Text style={[a.text_md, a.text_center]}>
                {local ? (
                  <Trans>No local news right now.</Trans>
                ) : (
                  <Trans>No newsroom feeds are reachable right now.</Trans>
                )}
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
                    onShownCountChange={setLeadBandCount}
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
