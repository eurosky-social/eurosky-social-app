import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {cleanError} from '#/lib/strings/errors'
import {useFetchDid} from '#/state/queries/handle'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {FormError} from '#/components/forms/FormError'
import * as TextField from '#/components/forms/TextField'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {getStreamPlayer, type LiveEvent, parsePostReference} from '../events'
import {type LiveEventInput, useLiveEventMutation} from '../queries'

/**
 * The curator's form: creates or updates one `social.mu.live.event` record.
 * Kept to plain text fields so it works the same on every platform; the
 * running order is one "HH:MM label" line per item.
 */
export function LiveEventEditorDialog({
  control,
  event,
}: {
  control: Dialog.DialogControlProps
  /** When set, the form edits this event; otherwise it creates one. */
  event?: LiveEvent
}) {
  const {t: l} = useLingui()
  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{fullHeight: true}}
      testID="liveEventEditorDialog">
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={event ? l`Edit live event` : l`New live event`}
        style={[{maxWidth: 560}]}>
        <Form event={event} />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

/** Renders a datetime for the form: local time, `YYYY-MM-DD HH:MM`. */
function toLocalInput(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parses `YYYY-MM-DD HH:MM` (or ISO) in local time; undefined when invalid. */
function fromLocalInput(input: string): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  const d = m
    ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
    : new Date(trimmed)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

function runningOrderToText(
  items: LiveEvent['runningOrder'] | undefined,
): string {
  if (!items?.length) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return items
    .map(item => {
      const d = new Date(item.at)
      return `${pad(d.getHours())}:${pad(d.getMinutes())} ${item.label}`
    })
    .join('\n')
}

/**
 * "HH:MM label" per line, on the event's start date. A time earlier than
 * the start, or earlier than the previous item, rolls over to the next day,
 * so a 23:00 event can list 00:15 without landing the day before.
 */
function runningOrderFromText(
  text: string,
  startsAt: string,
): LiveEventInput['runningOrder'] | undefined {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return undefined
  const base = new Date(startsAt)
  let previous = base.getHours() * 60 + base.getMinutes()
  let dayOffset = 0
  const items: {at: string; label: string}[] = []
  for (const line of lines) {
    const m = line.match(/^(\d{1,2}):(\d{2})\s+(.+)$/)
    if (!m) return undefined
    const minutes = +m[1] * 60 + +m[2]
    if (minutes < previous) dayOffset += 1
    previous = minutes
    const d = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + dayOffset,
      +m[1],
      +m[2],
    )
    items.push({at: d.toISOString(), label: m[3]})
  }
  return items
}

function Form({event}: {event?: LiveEvent}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const fetchDid = useFetchDid()
  const {mutateAsync: save, isPending} = useLiveEventMutation()

  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [streamUrl, setStreamUrl] = useState(event?.streamUrl ?? '')
  const [host, setHost] = useState(event?.hostDid ?? '')
  const [anchor, setAnchor] = useState(event?.anchorPostUri ?? '')
  const [startsAt, setStartsAt] = useState(toLocalInput(event?.startsAt))
  const [endsAt, setEndsAt] = useState(toLocalInput(event?.endsAt))
  const [image, setImage] = useState(event?.image ?? '')
  const [speakers, setSpeakers] = useState(event?.speakerDids?.join(', ') ?? '')
  const [runningOrder, setRunningOrder] = useState(
    runningOrderToText(event?.runningOrder),
  )
  const [error, setError] = useState('')

  async function resolveActor(actor: string): Promise<string> {
    return fetchDid(actor.trim().replace(/^@/, ''))
  }

  async function onPressSave() {
    setError('')
    try {
      if (!title.trim()) throw new Error(l`Give the event a title.`)
      if (!getStreamPlayer(streamUrl.trim())) {
        throw new Error(
          l`The stream link must be a YouTube, Twitch or Vimeo link that plays inline.`,
        )
      }
      const startsIso = fromLocalInput(startsAt)
      if (!startsIso) {
        throw new Error(l`Enter the start as YYYY-MM-DD HH:MM.`)
      }
      const endsIso = endsAt.trim() ? fromLocalInput(endsAt) : undefined
      if (endsAt.trim() && !endsIso) {
        throw new Error(
          l`Enter the end as YYYY-MM-DD HH:MM, or leave it empty.`,
        )
      }
      if (!host.trim()) throw new Error(l`Name the host account.`)
      const hostDid = await resolveActor(host)

      let anchorPost: string | undefined
      if (anchor.trim()) {
        const ref = parsePostReference(anchor)
        if (!ref)
          throw new Error(
            l`Paste a link to the host's post, or leave it empty.`,
          )
        const did = await resolveActor(ref.actor)
        anchorPost = `at://${did}/app.bsky.feed.post/${ref.rkey}`
      }

      const speakerDids: string[] = []
      for (const item of speakers.split(',')) {
        if (item.trim()) speakerDids.push(await resolveActor(item))
      }

      const order = runningOrderFromText(runningOrder, startsIso)
      if (runningOrder.trim() && !order) {
        throw new Error(
          l`Write the running order as one "HH:MM label" per line.`,
        )
      }

      const record: LiveEventInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        streamUrl: streamUrl.trim(),
        host: hostDid,
        anchorPost,
        startsAt: startsIso,
        endsAt: endsIso,
        image: image.trim() || undefined,
        // Not editable here yet; keep whatever the record already has.
        accent: event?.accent,
        speakers: speakerDids.length ? speakerDids : undefined,
        runningOrder: order,
      }
      // A post-derived event gets its own record; a record keeps its key.
      await save({rkey: event?.fromRecord ? event.id : undefined, record})
      Toast.show(
        event
          ? l({message: 'Event updated', context: 'toast'})
          : l({message: 'Event added to Live', context: 'toast'}),
      )
      control.close()
    } catch (e) {
      setError(cleanError(e))
    }
  }

  return (
    <View style={[a.gap_lg]}>
      <Text style={[a.text_2xl, a.font_bold, t.atoms.text]}>
        {event ? <Trans>Edit live event</Trans> : <Trans>New live event</Trans>}
      </Text>

      <Field label={l`Title`}>
        <Dialog.Input
          label={l`Title`}
          defaultValue={title}
          onChangeText={setTitle}
        />
      </Field>
      <Field label={l`Description`} hint={l`One line under the title.`}>
        <Dialog.Input
          label={l`Description`}
          defaultValue={description}
          onChangeText={setDescription}
          multiline
        />
      </Field>
      <Field
        label={l`Stream link`}
        hint={l`YouTube, Twitch or Vimeo. It plays inside mu.`}>
        <Dialog.Input
          label={l`Stream link`}
          defaultValue={streamUrl}
          onChangeText={setStreamUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </Field>
      <Field
        label={l`Host`}
        hint={l`Handle or DID. Replies to the host's post of the stream are the live thread.`}>
        <Dialog.Input
          label={l`Host`}
          defaultValue={host}
          onChangeText={setHost}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>
      <Field
        label={l`Anchor post (optional)`}
        hint={l`Link to the post whose replies are the thread. Found automatically when empty.`}>
        <Dialog.Input
          label={l`Anchor post`}
          defaultValue={anchor}
          onChangeText={setAnchor}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>
      <View style={[a.flex_row, a.gap_md]}>
        <View style={[a.flex_1]}>
          <Field label={l`Starts`} hint={l`YYYY-MM-DD HH:MM, local time`}>
            <Dialog.Input
              label={l`Starts`}
              defaultValue={startsAt}
              onChangeText={setStartsAt}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
        </View>
        <View style={[a.flex_1]}>
          <Field label={l`Ends (optional)`} hint={l`Empty while open-ended`}>
            <Dialog.Input
              label={l`Ends`}
              defaultValue={endsAt}
              onChangeText={setEndsAt}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
        </View>
      </View>
      <Field
        label={l`Image link (optional)`}
        hint={l`16:9. YouTube events use the video thumbnail when empty.`}>
        <Dialog.Input
          label={l`Image link`}
          defaultValue={image}
          onChangeText={setImage}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </Field>
      <Field
        label={l`Speakers (optional)`}
        hint={l`Handles separated by commas. Their replies get a SPEAKER chip.`}>
        <Dialog.Input
          label={l`Speakers`}
          defaultValue={speakers}
          onChangeText={setSpeakers}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>
      <Field
        label={l`Running order (optional)`}
        hint={l`One item per line: 14:00 Opening statements`}>
        <Dialog.Input
          label={l`Running order`}
          defaultValue={runningOrder}
          onChangeText={setRunningOrder}
          multiline
          numberOfLines={4}
        />
      </Field>

      <FormError error={error} />

      <View style={[a.flex_row, a.justify_end, a.gap_sm, a.pt_sm]}>
        <Button
          label={l`Cancel`}
          size="large"
          color="secondary"
          onPress={() => control.close()}>
          <ButtonText>
            <Trans>Cancel</Trans>
          </ButtonText>
        </Button>
        <Button
          label={event ? l`Save changes` : l`Add event`}
          size="large"
          color="primary"
          disabled={isPending}
          onPress={() => void onPressSave()}>
          <ButtonText>
            {event ? <Trans>Save changes</Trans> : <Trans>Add event</Trans>}
          </ButtonText>
        </Button>
      </View>
    </View>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  const t = useTheme()
  return (
    <View style={[a.gap_xs]}>
      <TextField.LabelText>{label}</TextField.LabelText>
      <TextField.Root>{children}</TextField.Root>
      {!!hint && (
        <Text style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
          {hint}
        </Text>
      )}
    </View>
  )
}
