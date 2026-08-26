import {StyleSheet, View} from 'react-native'

/**
 * Groups modal content for native accessibility. The shell separately hides
 * the navigator while a rest break is active so TalkBack cannot reach it.
 */
export function FocusTrap({children}: {children: React.ReactElement}) {
  return (
    <View
      accessibilityViewIsModal
      importantForAccessibility="yes"
      style={StyleSheet.absoluteFill}>
      {children}
    </View>
  )
}
