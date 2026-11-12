import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {nanoid} from 'nanoid/non-secure'

import {codeToLanguageName} from '#/locale/helpers'
import {useLanguagePrefs} from '#/state/preferences/languages'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Divider} from '#/components/Divider'
import {Earth_Stroke2_Corner2_Rounded as EarthIcon} from '#/components/icons/Globe'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {
  Star_Filled_Corner0_Rounded as StarFilledIcon,
  Star_Stroke2_Corner0_Rounded as StarIcon,
} from '#/components/icons/Star'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {
  useInterestSubtitle,
  useInterestTitle,
} from '#/features/news/explore/useInterestTitle'
import {
  type NewsFeedPrefs,
  type NewsInterest,
  useNewsFeedPrefsMutation,
} from '../../state/prefs'
import {SetupDone} from '../SetupDone'
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
  const subtitleOf = useInterestSubtitle()
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

  async function save(prefs: NewsFeedPrefs) {
    onSaved()
    try {
      await savePrefs(prefs)
    } catch {
      // surfaced + logged by the mutation
    }
  }

  /** Back to the list with the change, kept once the settings are saved. */
  function apply(next: NewsFeedPrefs) {
    setDraft(next)
    setEditing(undefined)
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
          apply({
            ...draft,
            interests: draft.interests.filter(i => i.id !== interest.id),
          })
        }}
        onDone={next => {
          apply({
            ...draft,
            interests: isNew
              ? [...draft.interests, next]
              : draft.interests.map(i => (i.id === next.id ? next : i)),
          })
        }}
      />
    )
  }

  return (
    <Layout.Screen testID="newsInterestsSetup">
      <SetupHeader
        title={l`News preferences`}
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
            <Text
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>
                The News tab opens on your default interest. Star another to
                make it the default.
              </Trans>
            </Text>
            <View style={[a.gap_sm]}>
              {draft.interests.map((interest, index) => (
                <InterestRow
                  key={interest.id}
                  title={titleOf(interest)}
                  subtitle={subtitleOf(interest)}
                  isDefault={index === 0}
                  onMakeDefault={() =>
                    setDraft({
                      ...draft,
                      interests: [
                        interest,
                        ...draft.interests.filter(i => i.id !== interest.id),
                      ],
                    })
                  }
                  onEdit={() => setEditing({interest, isNew: false})}
                  onDelete={() =>
                    setDraft({
                      ...draft,
                      interests: draft.interests.filter(
                        i => i.id !== interest.id,
                      ),
                    })
                  }
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

      <SetupDone
        onDone={() => {
          void save(draft)
        }}
      />
    </Layout.Screen>
  )
}

/**
 * One interest in the list. The first is the default, which the news page
 * opens on; starring another moves it to the top. Deleting, like any change
 * here, is only kept once the settings are saved.
 */
function InterestRow({
  title,
  subtitle,
  isDefault,
  onMakeDefault,
  onEdit,
  onDelete,
}: {
  title: string
  subtitle: string
  isDefault: boolean
  onMakeDefault: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.py_sm,
        a.pl_md,
        a.pr_sm,
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
          {isDefault ? l`Default · ${subtitle}` : subtitle}
        </Text>
      </View>
      <Button
        testID="newsInterestDefaultBtn"
        label={
          isDefault
            ? l`${title} is your default interest`
            : l`Make ${title} your default interest`
        }
        /* Not disabled, which would fade the star that marks the default. */
        onPress={() => {
          if (!isDefault) onMakeDefault()
        }}
        size="small"
        color={isDefault ? 'primary_subtle' : 'secondary'}
        shape="square">
        <ButtonIcon icon={isDefault ? StarFilledIcon : StarIcon} />
      </Button>
      <Button
        testID="newsInterestEditBtn"
        label={l`Edit ${title}`}
        onPress={onEdit}
        size="small"
        color="secondary"
        shape="square">
        <ButtonIcon icon={PencilIcon} />
      </Button>
      <Button
        testID="newsInterestRowDeleteBtn"
        label={l`Delete ${title}`}
        onPress={onDelete}
        size="small"
        color="secondary"
        variant="ghost"
        shape="square">
        <ButtonIcon icon={TrashIcon} />
      </Button>
    </View>
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
