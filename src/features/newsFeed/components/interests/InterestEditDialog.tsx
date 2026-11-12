import * as Dialog from '#/components/Dialog'
import {
  type NewsInterest,
  useNewsFeedPrefsMutation,
  useNewsFeedPrefsQuery,
} from '../../state/prefs'
import {InterestEditor} from './InterestEditor'

/**
 * One interest's wizard in a dialog, saved straight to the news prefs on Done,
 * so it can be edited from the page that shows it. Deleting stays in the news
 * settings, where it is only kept once the settings are saved.
 */
export function InterestEditDialog({
  control,
  interest,
  onSaved,
}: {
  control: Dialog.DialogControlProps
  interest: NewsInterest
  /** Once the dialog has closed on Done, e.g. to show the interest. */
  onSaved?: (interest: NewsInterest) => void
}) {
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <DialogInner control={control} interest={interest} onSaved={onSaved} />
    </Dialog.Outer>
  )
}

function DialogInner({
  control,
  interest,
  onSaved,
}: {
  control: Dialog.DialogControlProps
  interest: NewsInterest
  onSaved?: (interest: NewsInterest) => void
}) {
  const {data: prefs} = useNewsFeedPrefsQuery()
  /* Optimistic, and surfaces and logs its own failure. */
  const {mutate: savePrefs} = useNewsFeedPrefsMutation()

  return (
    <InterestEditor
      key={interest.id}
      initial={interest}
      isNew={false}
      variant="dialog"
      onCancel={() => control.close()}
      onDone={next => {
        control.close(() => {
          if (!prefs) return
          savePrefs({
            ...prefs,
            interests: prefs.interests.map(i => (i.id === next.id ? next : i)),
          })
          onSaved?.(next)
        })
      }}
    />
  )
}
