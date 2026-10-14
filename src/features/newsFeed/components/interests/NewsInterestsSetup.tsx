import {useState} from 'react'
import {Pressable, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {nanoid} from 'nanoid/non-secure'

import {codeToLanguageName} from '#/locale/helpers'
import {useLanguagePrefs} from '#/state/preferences/languages'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Divider} from '#/components/Divider'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon} from '#/components/icons/Chevron'
import {Earth_Stroke2_Corner2_Rounded as EarthIcon} from '#/components/icons/Globe'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {useDutchThemesQuery} from '#/features/newsrooms/dutch/queries'
import {useInterestTitle} from '#/features/newsrooms/explore/useInterestTitle'
import {
  type NewsFeedPrefs,
  type NewsInterest,
  useNewsFeedPrefsMutation,
} from '../../state/prefs'
import {SetupConsent} from '../SetupConsent'
import {SetupHeader} from '../SetupHeader'
import {Section} from '../SetupTopics'
import {InterestEditor} from './InterestEditor'

/**
 * The news page's settings: the reader's interests, each a tab on the page.
 * The languages stories must be in are the app's content languages, so this
 * only points to where those are set. An interest is edited in its own
 * wizard, which the settings open on while there are none; nothing is written
 * until Done here, which publishes the whole record.
 *
 * The record is the one the news feed uses too, so its own fields - topics,
 * regions, excluded accounts - are carried through untouched.
 */
export function NewsInterestsSetup({
  initialDraft,
  onExit,
  onSaved,
}: {
  initialDraft: NewsFeedPrefs
  onExit: () => void
  /** Called as soon as the draft is submitted, before the write lands. */
  onSaved: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const titleOf = useInterestTitle()
  const {themes} = useDutchThemesQuery()
  const themeNames = new Map(themes.map(theme => [theme.slug, theme.name]))
  const {mutateAsync: savePrefs} = useNewsFeedPrefsMutation()
  const {contentLanguages, appLanguage} = useLanguagePrefs()
  const languageNames = contentLanguages
    .map(code => codeToLanguageName(code, appLanguage))
    .join(', ')
  const [draft, setDraft] = useState(initialDraft)
  /*
   * With no interests yet there is nothing to list, so the settings open on
   * the wizard for a first one.
   */
  const [editing, setEditing] = useState<
    {interest: NewsInterest; isNew: boolean} | undefined
  >(() =>
    initialDraft.interests.length === 0
      ? {interest: makeInterest(), isNew: true}
      : undefined,
  )

  async function finish() {
    onSaved()
    try {
      await savePrefs(draft)
    } catch {
      // surfaced + logged by the mutation
    }
  }

  if (editing) {
    const {interest, isNew} = editing
    return (
      <InterestEditor
        key={interest.id}
        initial={interest}
        isNew={isNew}
        onCancel={() => {
          /* Backing out of a first interest leaves an empty list behind. */
          if (draft.interests.length === 0) {
            onExit()
          } else {
            setEditing(undefined)
          }
        }}
        onDelete={() => {
          setDraft({
            ...draft,
            interests: draft.interests.filter(i => i.id !== interest.id),
          })
          setEditing(undefined)
        }}
        onDone={next => {
          setDraft({
            ...draft,
            interests: isNew
              ? [...draft.interests, next]
              : draft.interests.map(i => (i.id === next.id ? next : i)),
          })
          setEditing(undefined)
        }}
      />
    )
  }

  return (
    <Layout.Screen testID="newsInterestsSetup">
      <SetupHeader
        title={l`News settings`}
        onBack={() => {
          onExit()
          return true
        }}
      />

      <Layout.Content
        style={[a.flex_1]}
        contentContainerStyle={[{paddingBottom: 220}]}>
        <View style={[a.px_xl, a.pt_2xl, a.pb_lg]}>
          <Section
            titleText={<Trans>Your interests</Trans>}
            hintText={<Trans>Each one is a tab</Trans>}>
            <Text
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>
                Add an interest for each slice of the news you follow, like tech
                from anywhere, or everything from Belgian outlets.
              </Trans>
            </Text>
            <View style={[a.gap_sm]}>
              {draft.interests.map(interest => (
                <InterestRow
                  key={interest.id}
                  title={titleOf(interest)}
                  themeNames={themeNames}
                  interest={interest}
                  onPress={() => setEditing({interest, isNew: false})}
                />
              ))}
            </View>
            <View style={[a.flex_row]}>
              <Button
                testID="newsInterestAddBtn"
                label={l`Add an interest`}
                size="small"
                color="secondary"
                onPress={() =>
                  setEditing({interest: makeInterest(), isNew: true})
                }>
                <ButtonIcon icon={PlusIcon} />
                <ButtonText>
                  <Trans>Add an interest</Trans>
                </ButtonText>
              </Button>
            </View>
          </Section>
        </View>

        <Divider />

        <View style={[a.px_xl, a.pt_2xl, a.pb_lg]}>
          <Section
            titleText={<Trans>Languages</Trans>}
            hintText={<Trans>Your content languages</Trans>}>
            <Text style={[a.text_sm, a.leading_snug]}>
              {contentLanguages.length > 0 ? (
                <Trans>
                  Only stories in {languageNames} show, as set for the rest of
                  the app.
                </Trans>
              ) : (
                <Trans>
                  Stories in every language show, as set for the rest of the
                  app.
                </Trans>
              )}
            </Text>
            <View style={[a.flex_row]}>
              <Link
                testID="newsLanguagesLink"
                to="/settings/language"
                label={l`Change your content languages`}
                size="small"
                color="secondary">
                <ButtonIcon icon={EarthIcon} />
                <ButtonText>
                  <Trans>Change languages</Trans>
                </ButtonText>
              </Link>
            </View>
          </Section>
        </View>
      </Layout.Content>

      <SetupConsent
        onDone={() => {
          void finish()
        }}
      />
    </Layout.Screen>
  )
}

function InterestRow({
  title,
  interest,
  themeNames,
  onPress,
}: {
  title: string
  interest: NewsInterest
  /** Theme names by slug. */
  themeNames: Map<string, string>
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const topics = interest.themes
    .map(slug => themeNames.get(slug) ?? slug)
    .join(' · ')
  /*
   * An interest from everywhere is already titled by its topics, so the
   * subtitle says where instead of repeating them.
   */
  const titledByTopics =
    interest.countries.length === 0 && interest.themes.length > 0

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={l`Edit ${title}`}
      accessibilityHint={l`Opens the interest’s places, topics and outlets`}
      onPress={onPress}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.p_md,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
        t.atoms.bg_contrast_25,
      ]}>
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text emoji style={[a.text_md, a.font_semi_bold]} numberOfLines={1}>
          {title}
        </Text>
        <Text
          style={[a.text_sm, t.atoms.text_contrast_medium]}
          numberOfLines={1}>
          {titledByTopics ? (
            <Trans>Everywhere</Trans>
          ) : topics ? (
            topics
          ) : (
            <Trans>All topics</Trans>
          )}
        </Text>
      </View>
      <ChevronRightIcon size="sm" style={t.atoms.text_contrast_medium} />
    </Pressable>
  )
}

function makeInterest(): NewsInterest {
  return {
    id: nanoid(),
    name: '',
    countries: [],
    subLocations: [],
    themes: [],
    excludedOutlets: [],
    strictOutlets: false,
  }
}
