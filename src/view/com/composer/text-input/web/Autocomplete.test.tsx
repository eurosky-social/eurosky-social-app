import {createElement, createRef} from 'react'
import Emojis, {type EmojiMartData} from '@emoji-mart/data'
import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {render} from '@testing-library/react-native'
import {type Editor} from '@tiptap/core'
import {ReactRenderer} from '@tiptap/react'
import {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from '@tiptap/suggestion'
import tippy, {type Instance as TippyInstance} from 'tippy.js'

import {
  type AutocompleteRef,
  createEmojiSuggestion,
} from '#/view/com/composer/text-input/web/Autocomplete'
import {type AutocompleteEmoji} from '#/components/Autocomplete/types'

jest.mock('@tiptap/react', () => ({ReactRenderer: jest.fn()}))
jest.mock('tippy.js', () => ({__esModule: true, default: jest.fn()}))
jest.mock('@lingui/react', () => ({
  useLingui: () => ({_: () => ''}),
  Trans: () => null,
}))
jest.mock('#/alf', () => ({
  atoms: {},
  useTheme: () => ({atoms: {}}),
}))
jest.mock('#/components/Typography', () => ({
  Text: jest.requireActual<typeof import('react-native')>('react-native').Text,
}))
jest.mock('#/components/ProfileCard', () => ({}))
jest.mock('#/state/preferences/moderation-opts', () => ({}))

const emoji = (Emojis as EmojiMartData).emojis.smile
const item: AutocompleteEmoji = {
  key: emoji.id,
  type: 'emoji',
  value: emoji.skins[0].native,
  emoji,
}

function createProps(
  query: string,
  items: AutocompleteEmoji[] = [],
): SuggestionProps<AutocompleteEmoji, AutocompleteEmoji> {
  return {
    editor: {} as Editor,
    range: {from: 1, to: query.length + 2},
    query,
    text: `:${query}`,
    items,
    command: jest.fn(),
    decorationNode: null,
    clientRect: () => ({}) as DOMRect,
  }
}

function setup() {
  const component = {
    element: {} as Element,
    updateProps: jest.fn(),
    destroy: jest.fn(),
  }
  const popup = {destroy: jest.fn(), setProps: jest.fn()}
  jest
    .mocked(ReactRenderer)
    .mockReturnValue(component as unknown as jest.Mocked<ReactRenderer>)
  jest.mocked(tippy).mockReturnValue([popup as unknown as TippyInstance])

  const autocompleteRef = createRef<AutocompleteRef>()
  const suggestion = createEmojiSuggestion({
    search: jest.fn<() => Promise<AutocompleteEmoji[]>>().mockResolvedValue([]),
    autocompleteRef,
  })
  const lifecycle = suggestion.render!()

  return {component, popup, autocompleteRef, lifecycle}
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('emoji autocomplete keyboard handling', () => {
  it.each(['Enter', 'Tab'])('does not consume %s with no results', key => {
    const {autocompleteRef, lifecycle} = setup()
    const props = createProps(')')
    lifecycle.onStart!(props)

    const Component = jest.mocked(ReactRenderer).mock.calls[0][0]
    const ref = createRef<{
      onKeyDown: (props: SuggestionKeyDownProps) => boolean
    }>()
    const listProps = {...props, autocompleteRef, hide: jest.fn(), ref}
    render(createElement(Component, listProps))

    expect(
      ref.current?.onKeyDown({event: {key}} as SuggestionKeyDownProps),
    ).toBe(false)
    expect(props.command).not.toHaveBeenCalled()
  })

  it.each(['Enter', 'Tab'])('selects an available emoji with %s', key => {
    const {autocompleteRef, lifecycle} = setup()
    const props = createProps('smil', [item])
    lifecycle.onStart!(props)

    const Component = jest.mocked(ReactRenderer).mock.calls[0][0]
    const ref = createRef<{
      onKeyDown: (props: SuggestionKeyDownProps) => boolean
    }>()
    const listProps = {...props, autocompleteRef, hide: jest.fn(), ref}
    render(createElement(Component, listProps))

    expect(
      ref.current?.onKeyDown({event: {key}} as SuggestionKeyDownProps),
    ).toBe(true)
    expect(props.command).toHaveBeenCalledWith(item)
  })
})

describe('emoji autocomplete popup lifecycle', () => {
  it('recreates the popup after correcting an unknown completed shortcode', () => {
    const {component, popup, lifecycle} = setup()
    lifecycle.onStart!(createProps('smil', [item]))
    lifecycle.onUpdate!(createProps('smil:'))

    expect(component.destroy).toHaveBeenCalledTimes(1)
    expect(popup.destroy).toHaveBeenCalledTimes(1)

    lifecycle.onUpdate!(createProps('smil', [item]))

    expect(ReactRenderer).toHaveBeenCalledTimes(2)
    expect(tippy).toHaveBeenCalledTimes(2)
    expect(component.updateProps).not.toHaveBeenCalled()
    expect(popup.setProps).not.toHaveBeenCalled()
  })

  it('opens suggestions when editing a shortcode that started completed', () => {
    const {lifecycle} = setup()
    lifecycle.onStart!(createProps('smil:'))
    expect(ReactRenderer).not.toHaveBeenCalled()

    lifecycle.onUpdate!(createProps('smil', [item]))

    expect(ReactRenderer).toHaveBeenCalledTimes(1)
    expect(tippy).toHaveBeenCalledTimes(1)
  })

  it('updates an open popup without recreating it', () => {
    const {component, popup, lifecycle} = setup()
    lifecycle.onStart!(createProps('smi', [item]))
    const nextProps = createProps('smil', [item])
    lifecycle.onUpdate!(nextProps)

    expect(ReactRenderer).toHaveBeenCalledTimes(1)
    expect(tippy).toHaveBeenCalledTimes(1)
    expect(component.updateProps).toHaveBeenCalledWith(nextProps)
    expect(popup.setProps).toHaveBeenCalledTimes(1)
  })

  it('commits an exact shortcode and only destroys the popup once', () => {
    const {component, popup, lifecycle} = setup()
    lifecycle.onStart!(createProps('smile', [item]))
    const completedProps = createProps('smile:', [item])
    lifecycle.onUpdate!(completedProps)
    lifecycle.onExit!(completedProps)

    expect(completedProps.command).toHaveBeenCalledWith(item)
    expect(component.destroy).toHaveBeenCalledTimes(1)
    expect(popup.destroy).toHaveBeenCalledTimes(1)
  })
})
