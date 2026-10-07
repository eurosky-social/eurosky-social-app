import {useState} from 'react'
import {useLingui} from '@lingui/react/macro'

import * as Prompt from '#/components/Prompt'
import {
  type NewsFeedPrefs,
  useNewsFeedPrefsDeleteMutation,
  useNewsFeedPrefsMutation,
} from '../state/prefs'
import {SetupSources} from './SetupSources'
import {SetupTopics} from './SetupTopics'

/**
 * The two-step news setup: topics, regions and languages, then the accounts
 * they select. Nothing is written until the last step, which publishes the
 * whole draft as the prefs record. Shared by the news feed and the news page's
 * settings, so both edit the one record.
 */
export function NewsFeedSetup({
  initialDraft,
  hasRecord,
  onExit,
  onSaved,
  onRemoved,
}: {
  initialDraft: NewsFeedPrefs
  /** Whether a prefs record exists, in which case reset confirms deleting it. */
  hasRecord: boolean
  /**
   * Back from the first step. Return true if handled, so the header does not
   * also navigate away; return nothing to let the back button leave.
   */
  onExit: () => boolean | void
  /** Called as soon as the draft is submitted, before the write lands. */
  onSaved: (prefs: NewsFeedPrefs) => void
  onRemoved?: () => void
}) {
  const {t: l} = useLingui()
  const resetPromptControl = Prompt.usePromptControl()
  const {mutateAsync: savePrefs} = useNewsFeedPrefsMutation()
  const {mutate: deletePrefs} = useNewsFeedPrefsDeleteMutation()
  const [step, setStep] = useState<'topics' | 'sources'>('topics')
  const [draft, setDraft] = useState(initialDraft)

  const clearDraft = () => {
    setDraft({
      ...draft,
      topics: [],
      regions: [],
      languages: [],
      excludedDids: [],
    })
  }

  const confirmReset = () => {
    deletePrefs()
    onRemoved?.()
    clearDraft()
  }

  const finish = async () => {
    onSaved(draft)
    try {
      await savePrefs(draft)
    } catch {
      // surfaced + logged by the mutation
    }
  }

  if (step === 'topics') {
    return (
      <>
        <SetupTopics
          topics={draft.topics}
          regions={draft.regions}
          languages={draft.languages}
          onChangeTopics={topics => setDraft({...draft, topics})}
          onChangeRegions={regions => setDraft({...draft, regions})}
          onChangeLanguages={languages => setDraft({...draft, languages})}
          onBack={onExit}
          /* Reset deletes the published record whenever one exists, so it
           * confirms first. With no record, an unsaved draft just clears. */
          onReset={() => (hasRecord ? resetPromptControl.open() : clearDraft())}
          onNext={() => setStep('sources')}
        />
        <Prompt.Basic
          control={resetPromptControl}
          title={l`Remove your news feed?`}
          description={l`This deletes your saved topics and sources from your account. You can set up the feed again anytime.`}
          confirmButtonCta={l`Remove`}
          confirmButtonColor="negative"
          onConfirm={confirmReset}
        />
      </>
    )
  }

  return (
    <SetupSources
      draft={draft}
      onChangeExcluded={excludedDids => setDraft({...draft, excludedDids})}
      onBack={() => {
        setStep('topics')
        return true
      }}
      onDone={() => {
        void finish()
      }}
    />
  )
}
