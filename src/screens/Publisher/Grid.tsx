import {View} from 'react-native'

import {atoms as a} from '#/alf'

export function PublisherGrid({
  children,
}: {
  children: React.ReactNode
  wide: boolean
}) {
  return (
    <View testID="publisherDirectoryList" style={[a.px_lg, a.py_lg, a.gap_lg]}>
      {children}
    </View>
  )
}
