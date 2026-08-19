import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'
import {
  type TangledStringAuthorProps,
  type TangledStringCodeIconProps,
  type TangledStringLinkProps,
  type TangledStringStrings,
  type TangledStringTextProps,
  type TangledStringTheme,
  type TangledStringUi,
} from '@social-app-community/embed-tangled-string'

import {useCodePanelColor} from '#/lib/code/theme'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfileQuery} from '#/state/queries/profile'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {CodeBrackets_Stroke2_Corner2_Rounded as CodeIcon} from '#/components/icons/CodeBrackets'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {CodeBlock} from './CodeBlock'

function TangledText(props: TangledStringTextProps) {
  return <Text {...props} />
}

function TangledLink({
  uri,
  label,
  onPress,
  style,
  children,
}: TangledStringLinkProps) {
  return (
    <Link label={label} to={uri} shouldProxy onPress={onPress} style={style}>
      {children as React.ReactElement}
    </Link>
  )
}

function TangledAuthor({did}: TangledStringAuthorProps) {
  const t = useTheme()
  const {data: author} = useProfileQuery({did})

  if (!author) return null

  return (
    <View style={[a.flex_row, a.align_center, a.gap_xs]}>
      <UserAvatar type="user" size={20} avatar={author.avatar} />
      <Text
        emoji
        numberOfLines={1}
        style={[a.flex_1, a.text_sm, t.atoms.text_contrast_medium]}>
        {author.displayName || sanitizeHandle(author.handle, '@')}
      </Text>
    </View>
  )
}

function TangledCodeIcon({color}: TangledStringCodeIconProps) {
  return <CodeIcon size="sm" style={{color}} />
}

function useTangledTheme(): TangledStringTheme {
  const t = useTheme()
  const panelBackground = useCodePanelColor()

  return {
    panelBackground,
    borderColor: t.atoms.border_contrast_low.borderColor,
    textColor: t.atoms.text.color,
    mutedTextColor: t.atoms.text_contrast_medium.color,
    subtleTextColor: t.atoms.text_contrast_low.color,
    buttonBackground: t.atoms.bg_contrast_25.backgroundColor,
    buttonPressedBackground: t.atoms.bg_contrast_50.backgroundColor,
  }
}

function useTangledStrings(): TangledStringStrings {
  const {t: l} = useLingui()

  return {
    snippet: l`Snippet`,
    codeSnippet: l`Code snippet`,
    loadError: l`Couldn't load this snippet.`,
    showMore: l`Show more`,
    showLess: l`Show less`,
    openFile: (filename, domain) => l`Open ${filename} on ${domain}`,
    openOn: domain => l`Open on ${domain}`,
    lineCount: count => plural(count, {one: '# line', other: '# lines'}),
  }
}

export const tangledStringUi: TangledStringUi = {
  Text: TangledText,
  Link: TangledLink,
  CodeBlock,
  Author: TangledAuthor,
  CodeIcon: TangledCodeIcon,
  useTheme: useTangledTheme,
  useStrings: useTangledStrings,
}
