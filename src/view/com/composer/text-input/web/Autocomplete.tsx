import {forwardRef, useEffect, useImperativeHandle, useState} from 'react'
import {Pressable, View} from 'react-native'
import {type ModerationOpts} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'
import {ReactRenderer} from '@tiptap/react'
import {
  type SuggestionKeyDownProps,
  type SuggestionOptions,
  type SuggestionProps,
} from '@tiptap/suggestion'
import tippy, {type Instance as TippyInstance} from 'tippy.js'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {type ActorAutocompleteFn} from '#/state/queries/actor-autocomplete'
import {atoms as a, useTheme} from '#/alf'
import {
  type AutocompleteEmoji,
  type EmojiSearch,
} from '#/components/Autocomplete'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'

interface AutocompleteListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

type ProfileSuggestion = app.bsky.actor.defs.ProfileViewBasic
type ProfileSelection = {id: string}

export interface AutocompleteRef {
  maybeClose: () => boolean
}

export function createSuggestion({
  autocomplete,
  autocompleteRef,
}: {
  autocomplete: ActorAutocompleteFn
  autocompleteRef: React.Ref<AutocompleteRef>
}): Omit<SuggestionOptions, 'editor'> {
  const suggestion: Omit<
    SuggestionOptions<ProfileSuggestion, ProfileSelection>,
    'editor'
  > = {
    async items({query}) {
      const suggestions = await autocomplete({query})
      return suggestions.slice(0, 8)
    },

    render: () => {
      let component: ReactRenderer<AutocompleteListRef> | undefined
      let popup: TippyInstance[] | undefined

      const hide = () => {
        popup?.[0]?.destroy()
        component?.destroy()
      }

      return {
        onStart: props => {
          component = new ReactRenderer(MentionList, {
            props: {...props, autocompleteRef, hide},
            editor: props.editor,
          })

          if (!props.clientRect) {
            return
          }

          // @ts-ignore getReferenceClientRect doesnt like that clientRect can return null -prf
          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          })
        },

        onUpdate(props) {
          component?.updateProps(props)

          if (!props.clientRect) {
            return
          }

          popup?.[0]?.setProps({
            // @ts-ignore getReferenceClientRect doesnt like that clientRect can return null -prf
            getReferenceClientRect: props.clientRect,
          })
        },

        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            return false
          }

          return component?.ref?.onKeyDown(props) || false
        },

        onExit() {
          hide()
        },
      }
    },
  }

  return suggestion as Omit<SuggestionOptions, 'editor'>
}

export function createEmojiSuggestion({
  search,
  autocompleteRef,
}: {
  search: EmojiSearch
  autocompleteRef: React.Ref<AutocompleteRef>
}): Omit<SuggestionOptions, 'editor'> {
  const suggestion: Omit<
    SuggestionOptions<AutocompleteEmoji, AutocompleteEmoji>,
    'editor'
  > = {
    char: ':',
    allowToIncludeChar: true,
    async items({query}) {
      const isCompletedShortcode = query.endsWith(':')
      const normalizedQuery = isCompletedShortcode ? query.slice(0, -1) : query
      if (!normalizedQuery) return []
      return search(normalizedQuery, 8, isCompletedShortcode)
    },
    command({editor, range, props}) {
      const shortcode = editor.state.doc.textBetween(range.from, range.to)
      const nodeAfter = editor.state.doc.resolve(range.to).nodeAfter
      const hasWhitespaceAfter = nodeAfter?.text?.startsWith(' ')
      const trailingSpace =
        shortcode.endsWith(':') || hasWhitespaceAfter ? '' : ' '

      editor
        .chain()
        .focus()
        .insertContentAt(range, `${props.value}${trailingSpace}`)
        .run()
    },
    render: () => {
      let component: ReactRenderer<AutocompleteListRef> | undefined
      let popup: TippyInstance[] | undefined

      const hide = () => {
        popup?.[0]?.destroy()
        popup = undefined
        component?.destroy()
        component = undefined
      }
      const maybeCommitShortcode = (
        props: SuggestionProps<AutocompleteEmoji, AutocompleteEmoji>,
      ) => {
        const isCompletedShortcode =
          props.query.length > 1 && props.query.endsWith(':')
        if (!isCompletedShortcode) return false

        hide()
        const exactItem = props.items[0]
        if (exactItem) props.command(exactItem)
        return true
      }

      const update = (
        props: SuggestionProps<AutocompleteEmoji, AutocompleteEmoji>,
      ) => {
        if (maybeCommitShortcode(props)) return

        if (component) {
          component.updateProps(props)
        } else {
          component = new ReactRenderer(EmojiList, {
            props: {...props, autocompleteRef, hide},
            editor: props.editor,
          })
        }

        if (!props.clientRect) return

        if (popup) {
          popup[0]?.setProps({
            // @ts-ignore getReferenceClientRect doesnt like that clientRect can return null -prf
            getReferenceClientRect: props.clientRect,
          })
        } else {
          // @ts-ignore getReferenceClientRect doesnt like that clientRect can return null -prf
          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          })
        }
      }

      return {
        onStart: update,
        onUpdate: update,

        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            return false
          }

          return component?.ref?.onKeyDown(props) || false
        },

        onExit() {
          hide()
        },
      }
    },
  }

  return suggestion as Omit<SuggestionOptions, 'editor'>
}

const MentionList = forwardRef<
  AutocompleteListRef,
  SuggestionProps<ProfileSuggestion, ProfileSelection> & {
    autocompleteRef: React.Ref<AutocompleteRef>
    hide: () => void
  }
>(function MentionListImpl({items, command, hide, autocompleteRef}, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const t = useTheme()
  const moderationOpts = useModerationOpts()

  const selectItem = (index: number) => {
    const item = items[index]

    if (item) {
      command({id: item.handle})
    }
  }

  const upHandler = () => {
    if (items.length) {
      setSelectedIndex((selectedIndex + items.length - 1) % items.length)
    }
  }

  const downHandler = () => {
    if (items.length) {
      setSelectedIndex((selectedIndex + 1) % items.length)
    }
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useEffect(() => setSelectedIndex(0), [items])

  useImperativeHandle(autocompleteRef, () => ({
    maybeClose: () => {
      hide()
      return true
    },
  }))

  useImperativeHandle(ref, () => ({
    onKeyDown: ({event}) => {
      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }

      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        enterHandler()
        return true
      }

      return false
    },
  }))

  if (!moderationOpts) return null

  return (
    <div className="items">
      <View
        style={[
          t.atoms.border_contrast_low,
          t.atoms.bg,
          a.rounded_sm,
          a.border,
          a.p_xs,
          {width: 300},
        ]}>
        {items.length > 0 ? (
          items.map((item, index) => {
            const isSelected = selectedIndex === index

            return (
              <AutocompleteProfileCard
                key={item.handle}
                profile={item}
                isSelected={isSelected}
                onPress={() => selectItem(index)}
                onHover={() => setSelectedIndex(index)}
                moderationOpts={moderationOpts}
              />
            )
          })
        ) : (
          <Text style={[a.text_sm, a.px_md, a.py_md]}>
            <Trans>No result</Trans>
          </Text>
        )}
      </View>
    </div>
  )
})

const EmojiList = forwardRef<
  AutocompleteListRef,
  SuggestionProps<AutocompleteEmoji, AutocompleteEmoji> & {
    autocompleteRef: React.Ref<AutocompleteRef>
    hide: () => void
  }
>(function EmojiListImpl({items, command, hide, autocompleteRef}, ref) {
  const {t: l} = useLingui()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const t = useTheme()

  const selectItem = (index: number) => {
    const item = items[index]
    if (!item) return false

    command(item)
    return true
  }

  useEffect(() => setSelectedIndex(0), [items])

  useImperativeHandle(autocompleteRef, () => ({
    maybeClose: () => {
      hide()
      return true
    },
  }))

  useImperativeHandle(ref, () => ({
    onKeyDown: ({event}) => {
      if (event.key === 'ArrowUp') {
        if (items.length) {
          setSelectedIndex((selectedIndex + items.length - 1) % items.length)
        }
        return true
      }

      if (event.key === 'ArrowDown') {
        if (items.length) {
          setSelectedIndex((selectedIndex + 1) % items.length)
        }
        return true
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        return selectItem(selectedIndex)
      }

      return false
    },
  }))

  return (
    <div className="items">
      <View
        style={[
          t.atoms.border_contrast_low,
          t.atoms.bg,
          a.rounded_sm,
          a.border,
          a.p_xs,
          {width: 300},
        ]}>
        {items.length > 0 ? (
          items.map((item, index) => (
            <Pressable
              key={item.key}
              style={[
                selectedIndex === index && t.atoms.bg_contrast_25,
                a.flex_row,
                a.align_center,
                a.gap_sm,
                a.px_md,
                a.py_sm,
                a.rounded_xs,
                a.transition_color,
              ]}
              onPress={() => selectItem(index)}
              onPointerEnter={() => setSelectedIndex(index)}
              accessibilityRole="button"
              accessibilityLabel={l`Insert ${item.emoji.name} emoji`}
              accessibilityHint="">
              <Text emoji style={[a.text_xl, a.leading_tight]}>
                {item.value}
              </Text>
              <View style={[a.flex_1]}>
                <Text style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
                  :{item.emoji.id}:
                </Text>
                <Text
                  style={[
                    t.atoms.text_contrast_medium,
                    a.text_sm,
                    a.leading_snug,
                  ]}
                  numberOfLines={1}>
                  {item.emoji.name}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <Text style={[a.text_sm, a.px_md, a.py_md]}>
            <Trans>No result</Trans>
          </Text>
        )}
      </View>
    </div>
  )
})

function AutocompleteProfileCard({
  profile,
  isSelected,
  onPress,
  onHover,
  moderationOpts,
}: {
  profile: app.bsky.actor.defs.ProfileViewBasic
  isSelected: boolean
  onPress: () => void
  onHover: () => void
  moderationOpts: ModerationOpts
}) {
  const t = useTheme()

  return (
    <Pressable
      style={[
        isSelected && t.atoms.bg_contrast_25,
        a.align_center,
        a.justify_between,
        a.flex_row,
        a.px_md,
        a.py_sm,
        a.gap_2xl,
        a.rounded_xs,
        a.transition_color,
      ]}
      onPress={onPress}
      onPointerEnter={onHover}
      accessibilityRole="button">
      <View style={[a.flex_1]}>
        <ProfileCard.Header>
          <ProfileCard.Avatar
            profile={profile}
            moderationOpts={moderationOpts}
            disabledPreview
          />
          <ProfileCard.NameAndHandle
            profile={profile}
            moderationOpts={moderationOpts}
          />
        </ProfileCard.Header>
      </View>
    </Pressable>
  )
}
