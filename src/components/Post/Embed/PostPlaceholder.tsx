import {StyleSheet, View} from 'react-native'

import {usePalette} from '#/lib/hooks/usePalette'
import {Text} from '#/view/com/util/text/Text'
import {atoms as a, useTheme} from '#/alf'
import {CircleInfo_Stroke2_Corner0_Rounded as InfoCircleIcon} from '#/components/icons/Circle'

export function PostPlaceholder({children}: {children: React.ReactNode}) {
  const t = useTheme()
  const pal = usePalette('default')
  return (
    <View
      style={[styles.errorContainer, a.border, t.atoms.border_contrast_low]}>
      <InfoCircleIcon width={18} style={pal.text} />
      <Text type="lg" style={pal.text}>
        {children}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
