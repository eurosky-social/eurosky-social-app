import {FocusGuards, FocusScope} from 'radix-ui/internal'
import {RemoveScrollBar} from 'react-remove-scroll-bar'

export function FocusTrap({children}: {children: React.ReactElement}) {
  FocusGuards.useFocusGuards()

  return (
    <>
      <RemoveScrollBar />
      <FocusScope.FocusScope loop trapped asChild>
        {children}
      </FocusScope.FocusScope>
    </>
  )
}
