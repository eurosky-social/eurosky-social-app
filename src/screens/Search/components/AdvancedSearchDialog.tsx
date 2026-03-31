import {useCallback, useRef, useState} from 'react'
import {type TextInput, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, native, platform, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {DateField} from '#/components/forms/DateField'
import {toSimpleDateString} from '#/components/forms/DateField/utils'
import * as TextField from '#/components/forms/TextField'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as SettingsSliderIcon} from '#/components/icons/SettingsSlider'
import {Text} from '#/components/Typography'
import {IS_NATIVE, IS_WEB} from '#/env'

const WHITESPACE_RE = /\s+/
const GLOBAL_WHITESPACE_RE = /\s+/g
const ANY_WORDS_GROUP_RE = /\(([^)]+\sOR\s[^)]+)\)/g
const ANY_WORDS_RE = /\s+OR\s+/
const EXACT_PHRASE_RE = /"([^"]+)"/g
const NEGATED_WORDS_RE = /(?:^|\s)-(\S+)/g
const HASHTAGS_RE = /(?:^|\s)(#\S+)/g
const FROM_USER_RE = /(?:^|\s)from:(\S+)/g
const TO_USER_RE = /(?:^|\s)to:(\S+)/g
const MENTIONS_RE = /(?:^|\s)(@\S+)/g
const SINCE_DATE_RE = /(?:^|\s)since:(\S+)/g
const UNTIL_DATE_RE = /(?:^|\s)from:(\S+)/g
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// The date picker requires a valid date, so default to today.
const DEFAULT_DATE = toSimpleDateString(new Date())

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const d = new Date(value + 'T00:00:00')
  return !isNaN(d.getTime())
}

// Dates in the search query are UTC.
// Convert to a local date string for the date picker.
function utcDateToLocal(value: string): string {
  const d = new Date(value + 'T00:00:00Z')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function AdvancedSearchDialog({
  searchText,
  onChangeSearchText,
}: {
  searchText: string
  onChangeSearchText: (text: string) => void
}) {
  const {t: l} = useLingui()
  const control = Dialog.useDialogControl()

  return (
    <>
      <Button
        label={l`Open advanced search options`}
        size="small"
        color={platform({native: 'primary', default: 'secondary'})}
        variant={platform({native: 'ghost', default: 'solid'})}
        style={native([a.py_sm, a.px_sm])}
        onPress={control.open}>
        <ButtonIcon icon={SettingsSliderIcon} />
        {IS_WEB ? (
          <ButtonText>
            <Trans>Advanced search</Trans>
          </ButtonText>
        ) : null}
      </Button>

      <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
        <Dialog.Handle />
        <DialogInner
          control={control}
          searchText={searchText}
          onChangeSearchText={onChangeSearchText}
        />
      </Dialog.Outer>
    </>
  )
}

function DialogInner({
  control,
  searchText,
  onChangeSearchText,
}: {
  control: Dialog.DialogControlProps
  searchText: string
  onChangeSearchText: (text: string) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  const exactEl = useRef<TextInput | null>(null)
  const anyEl = useRef<TextInput | null>(null)
  const negatedEl = useRef<TextInput | null>(null)
  const hashtagEl = useRef<TextInput | null>(null)
  const fromAccountsEl = useRef<TextInput | null>(null)
  const toAccountsEl = useRef<TextInput | null>(null)
  const mentionsEl = useRef<TextInput | null>(null)

  const [allWords, setAllWords] = useState(() => {
    // Order matters here
    return searchText
      .replace(EXACT_PHRASE_RE, '')
      .replace(ANY_WORDS_GROUP_RE, '')
      .replace(NEGATED_WORDS_RE, '')
      .replace(HASHTAGS_RE, '')
      .replace(FROM_USER_RE, '')
      .replace(TO_USER_RE, '')
      .replace(MENTIONS_RE, '')
      .replace(SINCE_DATE_RE, (match, value) =>
        isValidDate(value) ? '' : match,
      )
      .replace(GLOBAL_WHITESPACE_RE, ' ')
      .trim()
  })

  const [exactPhrase, setExactPhrase] = useState(() => {
    const matches = [...searchText.matchAll(EXACT_PHRASE_RE)]
    // Use the last quoted string
    return matches.length > 0 ? matches[matches.length - 1][1] : ''
  })

  const [anyWords, setAnyWords] = useState(() => {
    const matches = [...searchText.matchAll(ANY_WORDS_GROUP_RE)]
    if (matches.length === 0) return ''
    return matches.flatMap(m => m[1].split(ANY_WORDS_RE)).join(' ')
  })

  const [negatedWords, setNegatedWords] = useState(() => {
    const matches = [...searchText.matchAll(NEGATED_WORDS_RE)]
    return matches.map(m => m[1]).join(' ')
  })

  const [hashtags, setHashtags] = useState(() => {
    const matches = [...searchText.matchAll(HASHTAGS_RE)]
    return matches.map(m => m[1]).join(' ')
  })

  const [fromAccounts, setFromAccounts] = useState(() => {
    const matches = [...searchText.matchAll(FROM_USER_RE)]
    return matches.map(m => m[1].replace(/^@/, '')).join(' ')
  })

  const [toAccounts, setToAccounts] = useState(() => {
    const matches = [...searchText.matchAll(TO_USER_RE)]
    return matches.map(m => m[1].replace(/^@/, '')).join(' ')
  })

  const [mentions, setMentions] = useState(() => {
    // Parse @mentions from text after stripping from:/to: so those don't get double-matched
    const stripped = searchText
      .replace(FROM_USER_RE, '')
      .replace(TO_USER_RE, '')
    const matches = [...stripped.matchAll(MENTIONS_RE)]
    return matches.map(m => m[1].replace(/^@/, '')).join(' ')
  })

  const [dateSince, setDateSince] = useState(() => {
    const matches = [...searchText.matchAll(SINCE_DATE_RE)]
    if (matches.length === 0) return DEFAULT_DATE
    const last = matches[matches.length - 1][1]
    return isValidDate(last) ? utcDateToLocal(last) : DEFAULT_DATE
  })

  const [dateUntil, setDateUntil] = useState(() => {
    const matches = [...searchText.matchAll(UNTIL_DATE_RE)]
    if (matches.length === 0) return DEFAULT_DATE
    const last = matches[matches.length - 1][1]
    return isValidDate(last) ? utcDateToLocal(last) : DEFAULT_DATE
  })

  const handleChangeAllWords = (value: string) => {
    setAllWords(value)
  }

  const handleChangeExactPhrase = (value: string) => {
    setExactPhrase(value)
  }

  const handleChangeAnyWords = (value: string) => {
    setAnyWords(value)
  }

  const handleChangeNegatedWords = (value: string) => {
    setNegatedWords(value)
  }

  const handleChangeHashtags = (value: string) => {
    setHashtags(value)
  }

  const handleChangeFromAccounts = (value: string) => {
    setFromAccounts(value)
  }

  const handleChangeToAccounts = (value: string) => {
    setToAccounts(value)
  }

  const handleChangeMentions = (value: string) => {
    setMentions(value)
  }

  const handleChangeDateSince = (value: string) => {
    setDateSince(value)
  }

  const handleChangeDateUntil = (value: string) => {
    setDateUntil(value)
  }

  const handlePressSearch = useCallback(() => {
    const parts: string[] = []

    if (allWords.trim()) {
      parts.push(allWords.trim())
    }

    if (exactPhrase.trim()) {
      parts.push(`"${exactPhrase.trim()}"`)
    }

    if (anyWords.trim()) {
      const words = anyWords.trim().split(WHITESPACE_RE)
      if (words.length === 1) {
        parts.push(words[0])
      } else {
        parts.push(`(${words.join(' OR ')})`)
      }
    }

    if (negatedWords.trim()) {
      const words = negatedWords.trim().split(WHITESPACE_RE)
      parts.push(words.map(w => `-${w}`).join(' '))
    }

    if (hashtags.trim()) {
      parts.push(hashtags.trim())
    }

    if (fromAccounts.trim()) {
      const words = fromAccounts.trim().split(WHITESPACE_RE)
      parts.push(words.map(w => `from:${w}`).join(' '))
    }

    if (toAccounts.trim()) {
      const words = toAccounts.trim().split(WHITESPACE_RE)
      parts.push(words.map(w => `to:${w}`).join(' '))
    }

    if (mentions.trim()) {
      const words = mentions.trim().split(WHITESPACE_RE)
      parts.push(words.map(w => `@${w}`).join(' '))
    }

    // Convert from local time to UTC.
    if (dateSince && dateSince !== DEFAULT_DATE) {
      parts.push(
        `since:${toSimpleDateString(new Date(`${dateSince}T00:00:00`))}`,
      )
    }

    // Convert from local time to UTC.
    if (dateUntil && dateUntil !== DEFAULT_DATE) {
      parts.push(
        `until:${toSimpleDateString(new Date(`${dateUntil}T00:00:00`))}`,
      )
    }

    onChangeSearchText(parts.join(' '))
    control.close()
  }, [
    allWords,
    anyWords,
    control,
    dateSince,
    dateUntil,
    exactPhrase,
    fromAccounts,
    hashtags,
    mentions,
    negatedWords,
    onChangeSearchText,
    toAccounts,
  ])

  const cancelButton = useCallback(
    () => (
      <Button
        label={l`Cancel`}
        onPress={() => control.close()}
        size="small"
        color="secondary"
        variant="ghost"
        style={[a.rounded_full]}>
        <ButtonText>
          <Trans>Cancel</Trans>
        </ButtonText>
      </Button>
    ),
    [l, control],
  )

  const searchButton = useCallback(
    () => (
      <Button
        label={l`Search`}
        onPress={handlePressSearch}
        size="small"
        color="primary"
        style={[a.rounded_full]}>
        <ButtonText>
          <Trans>Search</Trans>
        </ButtonText>
      </Button>
    ),
    [l, handlePressSearch],
  )

  return (
    <Dialog.ScrollableInner
      label={l`Dialog: Set advanced search options`}
      contentContainerStyle={[a.px_0, a.pt_0]}
      header={
        <Dialog.Header renderLeft={cancelButton} renderRight={searchButton}>
          <Dialog.HeaderText>
            <Trans>Advanced search</Trans>
          </Dialog.HeaderText>
        </Dialog.Header>
      }>
      <View style={[a.mt_xl, a.px_xl, a.gap_xl]}>
        <Text style={[a.font_bold, a.text_md]}>
          <Trans>Words</Trans>
        </Text>
        <View>
          <TextField.LabelText>
            <Trans>All of these words</Trans>
          </TextField.LabelText>
          <View style={[a.w_full, a.relative, a.mb_xs]}>
            <TextField.Root>
              <Dialog.Input
                label={l`Include all of these words`}
                value={allWords}
                placeholder={l`e.g. what’s up`}
                returnKeyType="next"
                keyboardAppearance={t.scheme}
                selectTextOnFocus={IS_NATIVE}
                autoFocus={false}
                accessibilityRole="search"
                autoCorrect={false}
                autoComplete="off"
                autoCapitalize="none"
                onChangeText={handleChangeAllWords}
                onSubmitEditing={() => {
                  exactEl.current?.focus()
                }}
              />
            </TextField.Root>
          </View>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>
              For example,{' '}
              <Text
                style={[
                  a.text_xs,
                  t.atoms.text_contrast_medium,
                  a.font_semi_bold,
                ]}>
                what’s up
              </Text>{' '}
              includes both “what’s” and “up”
            </Trans>
          </Text>
        </View>
        <View>
          <TextField.LabelText>
            <Trans>This exact phrase</Trans>
          </TextField.LabelText>
          <View style={[a.w_full, a.relative, a.mb_xs]}>
            <TextField.Root>
              <Dialog.Input
                inputRef={exactEl}
                label={l`Include this exact phrase`}
                value={exactPhrase}
                placeholder={l`e.g. no clues`}
                returnKeyType="next"
                keyboardAppearance={t.scheme}
                selectTextOnFocus={IS_NATIVE}
                autoFocus={false}
                accessibilityRole="search"
                autoCorrect={false}
                autoComplete="off"
                autoCapitalize="none"
                onChangeText={handleChangeExactPhrase}
                onSubmitEditing={() => {
                  anyEl.current?.focus()
                }}
              />
            </TextField.Root>
          </View>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>
              For example,{' '}
              <Text
                style={[
                  a.text_xs,
                  t.atoms.text_contrast_medium,
                  a.font_semi_bold,
                ]}>
                no clues
              </Text>{' '}
              includes the exact phrase “no clues”
            </Trans>
          </Text>
        </View>
        <View>
          <TextField.LabelText>
            <Trans>Any of these words</Trans>
          </TextField.LabelText>
          <View style={[a.w_full, a.relative, a.mb_xs]}>
            <TextField.Root>
              <Dialog.Input
                inputRef={anyEl}
                label={l`Include any of these words`}
                value={anyWords}
                placeholder={l`e.g. cats dogs`}
                returnKeyType="next"
                keyboardAppearance={t.scheme}
                selectTextOnFocus={IS_NATIVE}
                autoFocus={false}
                accessibilityRole="search"
                autoCorrect={false}
                autoComplete="off"
                autoCapitalize="none"
                onChangeText={handleChangeAnyWords}
                onSubmitEditing={() => {
                  anyEl.current?.focus()
                }}
              />
            </TextField.Root>
          </View>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>
              For example,{' '}
              <Text
                style={[
                  a.text_xs,
                  t.atoms.text_contrast_medium,
                  a.font_semi_bold,
                ]}>
                cats dogs
              </Text>{' '}
              includes either “cats” or “dogs”
            </Trans>
          </Text>
        </View>
        <View>
          <TextField.LabelText>
            <Trans>None of these words</Trans>
          </TextField.LabelText>
          <View style={[a.w_full, a.relative, a.mb_xs]}>
            <TextField.Root>
              <Dialog.Input
                inputRef={negatedEl}
                label={l`Include none of these words`}
                value={negatedWords}
                placeholder={l`e.g. pancakes waffles`}
                returnKeyType="next"
                keyboardAppearance={t.scheme}
                selectTextOnFocus={IS_NATIVE}
                autoFocus={false}
                accessibilityRole="search"
                autoCorrect={false}
                autoComplete="off"
                autoCapitalize="none"
                onChangeText={handleChangeNegatedWords}
                onSubmitEditing={() => {
                  hashtagEl.current?.focus()
                }}
              />
            </TextField.Root>
          </View>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>
              For example,{' '}
              <Text
                style={[
                  a.text_xs,
                  t.atoms.text_contrast_medium,
                  a.font_semi_bold,
                ]}>
                pancakes waffles
              </Text>{' '}
              does not include “pancakes” or “waffles”
            </Trans>
          </Text>
        </View>
        <View>
          <TextField.LabelText>
            <Trans>These hashtags</Trans>
          </TextField.LabelText>
          <View style={[a.w_full, a.relative, a.mb_xs]}>
            <TextField.Root>
              <Dialog.Input
                inputRef={hashtagEl}
                label={l`Include these hashtags`}
                value={hashtags}
                placeholder={l`e.g. #bluesky`}
                returnKeyType="next"
                keyboardAppearance={t.scheme}
                selectTextOnFocus={IS_NATIVE}
                autoFocus={false}
                accessibilityRole="search"
                autoCorrect={false}
                autoComplete="off"
                autoCapitalize="none"
                onChangeText={handleChangeHashtags}
                onSubmitEditing={() => {
                  fromAccountsEl.current?.focus()
                }}
              />
            </TextField.Root>
          </View>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>
              For example,{' '}
              <Text
                style={[
                  a.text_xs,
                  t.atoms.text_contrast_medium,
                  a.font_semi_bold,
                ]}>
                #bluesky
              </Text>{' '}
              includes the hashtag “#bluesky”
            </Trans>
          </Text>
        </View>
        <Text style={[a.font_bold, a.text_md]}>
          <Trans>Users</Trans>
        </Text>
        <View>
          <TextField.LabelText>
            <Trans>From these users</Trans>
          </TextField.LabelText>
          <View style={[a.w_full, a.relative, a.mb_xs]}>
            <TextField.Root>
              <Dialog.Input
                inputRef={fromAccountsEl}
                label={l`Include these users`}
                value={fromAccounts}
                placeholder={l`e.g. bsky.app`}
                returnKeyType="next"
                keyboardAppearance={t.scheme}
                selectTextOnFocus={IS_NATIVE}
                autoFocus={false}
                accessibilityRole="search"
                autoCorrect={false}
                autoComplete="off"
                autoCapitalize="none"
                onChangeText={handleChangeFromAccounts}
                onSubmitEditing={() => {
                  toAccountsEl.current?.focus()
                }}
              />
            </TextField.Root>
          </View>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>
              For example,{' '}
              <Text
                style={[
                  a.text_xs,
                  t.atoms.text_contrast_medium,
                  a.font_semi_bold,
                ]}>
                bsky.app
              </Text>{' '}
              includes posts made by “@bsky.app”
            </Trans>
          </Text>
        </View>
        <View>
          <TextField.LabelText>
            <Trans>To these users</Trans>
          </TextField.LabelText>
          <View style={[a.w_full, a.relative, a.mb_xs]}>
            <TextField.Root>
              <Dialog.Input
                inputRef={toAccountsEl}
                label={l`Include posts to these users`}
                value={toAccounts}
                placeholder={l`e.g. bsky.app`}
                returnKeyType="next"
                keyboardAppearance={t.scheme}
                selectTextOnFocus={IS_NATIVE}
                autoFocus={false}
                accessibilityRole="search"
                autoCorrect={false}
                autoComplete="off"
                autoCapitalize="none"
                onChangeText={handleChangeToAccounts}
                onSubmitEditing={() => {
                  mentionsEl.current?.focus()
                }}
              />
            </TextField.Root>
          </View>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>
              For example,{' '}
              <Text
                style={[
                  a.text_xs,
                  t.atoms.text_contrast_medium,
                  a.font_semi_bold,
                ]}>
                bsky.app
              </Text>{' '}
              includes replies to “@bsky.app”
            </Trans>
          </Text>
        </View>
        <View>
          <TextField.LabelText>
            <Trans>Mentioning these users</Trans>
          </TextField.LabelText>
          <View style={[a.w_full, a.relative, a.mb_xs]}>
            <TextField.Root>
              <Dialog.Input
                inputRef={mentionsEl}
                label={l`Include posts to these users`}
                value={mentions}
                placeholder={l`e.g. bsky.app`}
                returnKeyType="search"
                keyboardAppearance={t.scheme}
                selectTextOnFocus={IS_NATIVE}
                autoFocus={false}
                accessibilityRole="search"
                autoCorrect={false}
                autoComplete="off"
                autoCapitalize="none"
                onChangeText={handleChangeMentions}
                onSubmitEditing={handlePressSearch}
              />
            </TextField.Root>
          </View>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>
              For example,{' '}
              <Text
                style={[
                  a.text_xs,
                  t.atoms.text_contrast_medium,
                  a.font_semi_bold,
                ]}>
                bsky.app
              </Text>{' '}
              includes posts that mention “@bsky.app”
            </Trans>
          </Text>
        </View>
        <Text style={[a.font_bold, a.text_md]}>
          <Trans>Dates</Trans>
        </Text>
        <View>
          <View style={[a.flex_row, a.gap_lg, a.mb_sm]}>
            <View style={[a.flex_1]}>
              <TextField.LabelText>
                <Trans>Since</Trans>
              </TextField.LabelText>
              <View style={[a.w_full, a.relative]}>
                <DateField
                  label={l`Since`}
                  value={dateSince}
                  accessibilityHint={l`Include posts made since this date`}
                  maximumDate={DEFAULT_DATE}
                  onChangeDate={handleChangeDateSince}
                />
              </View>
            </View>
            <View style={[a.flex_1]}>
              <TextField.LabelText>
                <Trans>Until</Trans>
              </TextField.LabelText>
              <View style={[a.w_full, a.relative]}>
                <DateField
                  label={l`Since`}
                  value={dateUntil}
                  accessibilityHint={l`Include posts made until this date`}
                  maximumDate={DEFAULT_DATE}
                  onChangeDate={handleChangeDateUntil}
                />
              </View>
            </View>
          </View>
          {new Date().getTimezoneOffset() !== 0 && (
            <Admonition type="info">
              <Trans>Note that dates will be converted to UTC.</Trans>
            </Admonition>
          )}
        </View>
      </View>
    </Dialog.ScrollableInner>
  )
}
