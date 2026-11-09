import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {type ArticleGridItemProps, type ArticleGridProps} from './types'

export function ArticleGrid({children}: ArticleGridProps) {
  return <View style={[a.gap_xl, a.pt_xl]}>{children}</View>
}

export function ArticleGridItem({children}: ArticleGridItemProps) {
  const t = useTheme()
  return (
    <View style={[a.pb_xl, a.border_b, t.atoms.border_contrast_low]}>
      {children}
    </View>
  )
}
