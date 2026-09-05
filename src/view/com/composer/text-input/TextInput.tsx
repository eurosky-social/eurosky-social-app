import {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputSelectionChangeEvent,
  View,
} from 'react-native'
import {type PasteEventPayload, TextInputWrapper} from 'expo-paste-input'
import {RichText} from '@bsky/sdk/richtext'
import {useLingui} from '@lingui/react/macro'

import {IMAGE_SIZE_CONFIG_POSTS} from '#/lib/constants'
import {downloadAndResize} from '#/lib/media/manip'
import {isUriImage} from '#/lib/media/util'
import {getEmojiAt, insertEmojiAt} from '#/lib/strings/emoji-manip'
import {getMentionAt, insertMentionAt} from '#/lib/strings/mention-manip'
import {useTheme} from '#/lib/ThemeContext'
import {
  type LinkFacetMatch,
  suggestLinkCardUri,
} from '#/view/com/composer/text-input/text-input-util'
import {atoms as a, useAlf} from '#/alf'
import {normalizeTextStyles} from '#/alf/typography'
import {
  type AutocompleteEmoji,
  type AutocompleteProfile,
} from '#/components/Autocomplete'
import {IS_ANDROID} from '#/env'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {type ActiveAutocomplete, Autocomplete} from './mobile/Autocomplete'
import {type TextInputProps} from './TextInput.types'

interface Selection {
  start: number
  end: number
}

export function TextInput({
  ref,
  richtext,
  placeholder,
  hasRightPadding,
  setRichText,
  onPhotoPasted,
  onNewLink,
  onError,
  ...props
}: TextInputProps) {
  const {t: l} = useLingui()
  const {theme: t, fonts} = useAlf()
  const textInput = useRef<RNTextInput>(null)
  const textInputSelection = useRef<Selection>({start: 0, end: 0})
  const theme = useTheme()
  const [activeAutocomplete, setActiveAutocomplete] =
    useState<ActiveAutocomplete | null>(null)
  const prevLength = useRef(richtext.length)

  useImperativeHandle(ref, () => ({
    focus: () => textInput.current?.focus(),
    blur: () => {
      textInput.current?.blur()
    },
    getCursorPosition: () => undefined, // Not implemented on native
    maybeClosePopup: () => false, // Not needed on native
  }))

  const pastSuggestedUris = useRef(new Set<string>())
  const prevDetectedUris = useRef(new Map<string, LinkFacetMatch>())
  const onChangeText = useCallback(
    async (newText: string) => {
      const mayBePaste = newText.length > prevLength.current + 1

      const newRt = new RichText({text: newText})
      newRt.detectFacetsWithoutResolution()
      setRichText(newRt)

      // NOTE: BinaryFiddler
      // onChangeText happens before onSelectionChange, cursorPos is out of bound if the user deletes characters,
      const cursorPos = textInputSelection.current?.start ?? 0
      const safeCursorPos = Math.min(cursorPos, newText.length)
      const mention = getMentionAt(newText, safeCursorPos)
      const emoji = getEmojiAt(newText, safeCursorPos)

      if (mention?.value) {
        setActiveAutocomplete({type: 'profile', query: mention.value})
      } else if (emoji?.value) {
        setActiveAutocomplete({type: 'emoji', query: emoji.value})
      } else if (activeAutocomplete) {
        setActiveAutocomplete(null)
      }

      const nextDetectedUris = new Map<string, LinkFacetMatch>()
      if (newRt.facets) {
        for (const facet of newRt.facets) {
          for (const feature of facet.features) {
            if (bsky.isType(app.bsky.richtext.facet.link, feature)) {
              if (isUriImage(feature.uri)) {
                const res = await downloadAndResize({
                  uri: feature.uri,
                  ...IMAGE_SIZE_CONFIG_POSTS,
                  timeout: 15e3,
                })

                if (res !== undefined) {
                  onPhotoPasted(res.path)
                }
              } else {
                nextDetectedUris.set(feature.uri, {facet, rt: newRt})
              }
            }
          }
        }
      }
      const suggestedUri = suggestLinkCardUri(
        mayBePaste,
        nextDetectedUris,
        prevDetectedUris.current,
        pastSuggestedUris.current,
      )
      prevDetectedUris.current = nextDetectedUris
      if (suggestedUri) {
        onNewLink(suggestedUri)
      }
      prevLength.current = newText.length
    },
    [setRichText, activeAutocomplete, onPhotoPasted, onNewLink],
  )

  const onPaste = useCallback(
    (payload: PasteEventPayload) => {
      if (payload.type === 'unsupported') {
        onError(l`Unsupported clipboard content`)
        return
      }

      if (payload.type === 'images') {
        for (const uri of payload.uris) {
          if (isUriImage(uri)) {
            onPhotoPasted(uri)
          }
        }
      }
    },
    [l, onError, onPhotoPasted],
  )

  const onSelectionChange = useCallback(
    (evt: TextInputSelectionChangeEvent) => {
      // NOTE we track the input selection using a ref to avoid excessive renders -prf
      textInputSelection.current = evt.nativeEvent.selection
    },
    [textInputSelection],
  )

  const onSelectAutocompleteItem = useCallback(
    (item: AutocompleteProfile | AutocompleteEmoji) => {
      const cursorPos = textInputSelection.current?.start || 0
      const newText =
        item.type === 'profile'
          ? insertMentionAt(richtext.text, cursorPos, item.value.slice(1))
          : insertEmojiAt(richtext.text, cursorPos, item.value)

      void onChangeText(newText)
      setActiveAutocomplete(null)
    },
    [onChangeText, richtext],
  )

  const inputTextStyle = useMemo(() => {
    const style = normalizeTextStyles(
      [a.text_lg, a.leading_snug, t.atoms.text],
      {
        fontScale: fonts.scaleMultiplier,
        fontFamily: fonts.family,
        flags: {},
      },
    )

    /*
     * Android impl of `PasteInput` doesn't support the array syntax for `fontVariant`
     */
    if (IS_ANDROID) {
      // @ts-ignore
      style.fontVariant = style.fontVariant
        ? style.fontVariant.join(' ')
        : undefined
    }
    return style
  }, [t, fonts])

  const textDecorated = useMemo(() => {
    let i = 0

    return Array.from(richtext.segments()).map(segment => {
      return (
        <RNText
          key={i++}
          style={[
            inputTextStyle,
            {
              color: segment.facet
                ? t.atoms.text_link.color
                : t.atoms.text.color,
              marginTop: -1,
            },
          ]}>
          {segment.text}
        </RNText>
      )
    })
  }, [t, richtext, inputTextStyle])

  return (
    <View style={[a.flex_1, a.pl_md, hasRightPadding && a.pr_4xl]}>
      <TextInputWrapper onPaste={onPaste}>
        <RNTextInput
          testID="composerTextInput"
          ref={textInput}
          onChangeText={(newText: string) => void onChangeText(newText)}
          onSelectionChange={onSelectionChange}
          placeholder={placeholder}
          placeholderTextColor={t.atoms.text_contrast_low.color}
          keyboardAppearance={theme.colorScheme}
          autoFocus={props.autoFocus !== undefined ? props.autoFocus : true}
          allowFontScaling
          multiline
          scrollEnabled={false}
          // Note: should be the default value, but as of v1.104
          // it switched to "none" on Android
          autoCapitalize="sentences"
          {...props}
          style={[
            inputTextStyle,
            a.w_full,
            !activeAutocomplete && a.h_full,
            {
              textAlignVertical: 'top',
              minHeight: 60,
              includeFontPadding: false,
            },
            {
              borderWidth: 1,
              borderColor: 'transparent',
            },
            props.style,
          ]}>
          {textDecorated}
        </RNTextInput>
      </TextInputWrapper>
      <Autocomplete
        active={activeAutocomplete}
        onSelect={onSelectAutocompleteItem}
      />
    </View>
  )
}
