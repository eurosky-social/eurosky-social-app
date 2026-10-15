import {useEffect, useState} from 'react'
import {View} from 'react-native'
import {Plural, Trans, useLingui} from '@lingui/react/macro'

import {cleanError, isNetworkError} from '#/lib/strings/errors'
import {matchXrpcError} from '#/lib/xrpc-error'
import {logger} from '#/logger'
import {ErrorMessage} from '#/view/com/util/error/ErrorMessage'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {com} from '#/lexicons'
import {useEventSaveMutation} from '../../queries'
import {type EventMode, type EventRecord, type EventStatus} from '../../types'
import {DateTimeField} from '../DateTimeField'
import {EventImageField} from './EventImageField'
import {
  DESCRIPTION_MAX_GRAPHEMES,
  type EventFormError,
  type EventFormValues,
  fromRecord,
  IMAGE_ALT_MAX_GRAPHEMES,
  isDirty,
  NAME_MAX_GRAPHEMES,
  validate,
} from './form'

/**
 * Creates an event, or edits `event` when passed. Bottom sheet on native,
 * modal on web.
 */
export function CreateOrEditEventDialog({
  control,
  event,
  onSave,
}: {
  control: Dialog.DialogControlProps
  event?: EventRecord
  onSave?: (event: EventRecord) => void
}) {
  const {t: l} = useLingui()
  const cancelControl = Dialog.useDialogControl()
  const [dirty, setDirty] = useState(false)

  // 'You might lose unsaved changes' warning
  useEffect(() => {
    if (IS_WEB && dirty) {
      const abortController = new AbortController()
      window.addEventListener('beforeunload', evt => evt.preventDefault(), {
        signal: abortController.signal,
      })
      return () => abortController.abort()
    }
  }, [dirty])

  const onPressCancel = () => {
    if (dirty) {
      cancelControl.open()
    } else {
      control.close()
    }
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventDismiss: dirty, fullHeight: true}}
      testID="createOrEditEventDialog">
      <DialogInner
        // Start fresh when switching between events.
        key={event?.uri ?? 'new'}
        event={event}
        onSave={onSave}
        setDirty={setDirty}
        onPressCancel={onPressCancel}
      />
      <Prompt.Basic
        control={cancelControl}
        title={l`Discard changes?`}
        description={l`Are you sure you want to discard your changes?`}
        onConfirm={() => control.close()}
        confirmButtonCta={l`Discard`}
        confirmButtonColor="negative"
      />
    </Dialog.Outer>
  )
}

function DialogInner({
  event,
  onSave,
  setDirty,
  onPressCancel,
}: {
  event?: EventRecord
  onSave?: (event: EventRecord) => void
  setDirty: (dirty: boolean) => void
  onPressCancel: () => void
}) {
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const {mutateAsync: saveEvent, isPending} = useEventSaveMutation()
  const [initialValues] = useState(() => fromRecord(event))
  const [values, setValues] = useState(initialValues)
  const [saveError, setSaveError] = useState('')
  /*
   * Errors stay hidden until the first save attempt, so an empty form doesn't
   * open covered in "required" messages.
   */
  const [showErrors, setShowErrors] = useState(false)

  const errors = validate(values)
  const visibleErrors = showErrors ? errors : {}
  const dirty = isDirty(values, initialValues)
  const isVirtual = values.mode === 'community.lexicon.calendar.event#virtual'

  useEffect(() => {
    setDirty(dirty)
  }, [dirty, setDirty])

  const setValue = <K extends keyof EventFormValues>(
    key: K,
    value: EventFormValues[K],
  ) => setValues(prev => ({...prev, [key]: value}))

  const onPressSave = async () => {
    setShowErrors(true)
    setSaveError('')
    if (Object.keys(errors).length > 0) return

    // Hoisted above the `try`: React Compiler can't lower conditionals in one.
    const savedMessage = event
      ? l({message: 'Event updated', context: 'toast'})
      : l({message: 'Event created', context: 'toast'})
    try {
      const saved = await saveEvent({values, existing: event})
      Toast.show(savedMessage)
      control.close(() => onSave?.(saved))
    } catch (e) {
      if (matchXrpcError(e, com.atproto.repo.putRecord) === 'InvalidSwap') {
        setSaveError(
          l`This event was changed somewhere else. Close this form and try again.`,
        )
      } else if (isNetworkError(e)) {
        setSaveError(l`Couldn’t save your event. Check your connection.`)
      } else {
        logger.error('Failed to save event', {safeMessage: e})
        setSaveError(cleanError(e))
      }
    }
  }

  const errorText = (error?: EventFormError) => {
    switch (error) {
      case 'required':
        return l`This field is required.`
      case 'endBeforeStart':
        return l`The event must end after it starts.`
      case 'invalidCountry':
        return l`Enter a two-letter country code, like NL.`
      case 'invalidUrl':
        return l`Enter a full web address, starting with https://.`
      default:
        return undefined
    }
  }

  const title = event ? l`Edit event` : l`New event`

  return (
    <Dialog.ScrollableInner
      label={title}
      style={[a.overflow_hidden, web({maxWidth: 500})]}
      contentContainerStyle={[a.px_0, a.pt_0]}
      header={
        <Dialog.Header
          renderLeft={() => (
            <Button
              label={l`Cancel`}
              onPress={onPressCancel}
              size="small"
              color="primary"
              variant="ghost"
              style={[a.rounded_full]}
              testID="eventFormCancelBtn">
              <ButtonText style={[a.text_md]}>
                <Trans>Cancel</Trans>
              </ButtonText>
            </Button>
          )}>
          <Dialog.HeaderText>{title}</Dialog.HeaderText>
        </Dialog.Header>
      }>
      <View style={[a.pt_xl, a.px_xl, a.pb_2xl, a.gap_xl]}>
        <View style={[a.gap_md]}>
          <Field label={l`Cover image (optional)`}>
            <EventImageField
              image={values.image}
              onChange={image => setValue('image', image)}
            />
          </Field>
          {values.image && (
            <Field label={l`Image description`}>
              <TextField.Root isInvalid={!!visibleErrors.imageAlt}>
                <Dialog.Input
                  defaultValue={values.imageAlt}
                  onChangeText={text => setValue('imageAlt', text)}
                  multiline
                  label={l`Image description`}
                  placeholder={l`Describe the image for people who can’t see it`}
                  testID="eventImageAltInput"
                />
              </TextField.Root>
              {visibleErrors.imageAlt === 'tooLong' && (
                <FieldError>
                  <Plural
                    value={IMAGE_ALT_MAX_GRAPHEMES}
                    other="The description can be at most # characters."
                  />
                </FieldError>
              )}
            </Field>
          )}
        </View>

        <Field label={l`Name`} error={errorText(visibleErrors.name)}>
          <TextField.Root isInvalid={!!visibleErrors.name}>
            <Dialog.Input
              defaultValue={values.name}
              onChangeText={text => setValue('name', text)}
              label={l`Name`}
              placeholder={l`e.g. Bluesky meetup`}
              testID="eventNameInput"
            />
          </TextField.Root>
          {visibleErrors.name === 'tooLong' && (
            <FieldError>
              <Plural
                value={NAME_MAX_GRAPHEMES}
                other="The name can be at most # characters."
              />
            </FieldError>
          )}
        </Field>

        <Field label={l`Description`}>
          <TextField.Root isInvalid={!!visibleErrors.description}>
            <Dialog.Input
              defaultValue={values.description}
              onChangeText={text => setValue('description', text)}
              multiline
              label={l`Description`}
              placeholder={l`What’s happening, and who is it for?`}
              testID="eventDescriptionInput"
            />
          </TextField.Root>
          {visibleErrors.description === 'tooLong' && (
            <FieldError>
              <Plural
                value={DESCRIPTION_MAX_GRAPHEMES}
                other="The description can be at most # characters."
              />
            </FieldError>
          )}
        </Field>

        <Field label={l`Starts`} error={errorText(visibleErrors.startsAt)}>
          <DateTimeField
            label={l`Starts`}
            value={values.startsAt}
            onChange={date => setValue('startsAt', date)}
            placeholder={l`Pick a date and time`}
            minimumDate={event ? undefined : new Date()}
            isInvalid={!!visibleErrors.startsAt}
            testID="eventStartsAtInput"
          />
        </Field>

        <Field
          label={l`Ends (optional)`}
          error={errorText(visibleErrors.endsAt)}>
          <DateTimeField
            label={l`Ends`}
            value={values.endsAt}
            onChange={date => setValue('endsAt', date)}
            placeholder={l`Pick a date and time`}
            initialDate={values.startsAt}
            minimumDate={values.startsAt}
            isInvalid={!!visibleErrors.endsAt}
            testID="eventEndsAtInput"
          />
        </Field>

        <Field label={l`Where`}>
          <SegmentedControl.Root
            type="radio"
            label={l`Where`}
            value={values.mode}
            onChange={(mode: EventMode) => setValue('mode', mode)}>
            <SegmentedControl.Item
              value="community.lexicon.calendar.event#inperson"
              label={l`In person`}>
              <SegmentedControl.ItemText>
                <Trans>In person</Trans>
              </SegmentedControl.ItemText>
            </SegmentedControl.Item>
            <SegmentedControl.Item
              value="community.lexicon.calendar.event#virtual"
              label={l`Online`}>
              <SegmentedControl.ItemText>
                <Trans>Online</Trans>
              </SegmentedControl.ItemText>
            </SegmentedControl.Item>
            <SegmentedControl.Item
              value="community.lexicon.calendar.event#hybrid"
              label={l`Both`}>
              <SegmentedControl.ItemText>
                <Trans context="event mode: in person and online">Both</Trans>
              </SegmentedControl.ItemText>
            </SegmentedControl.Item>
          </SegmentedControl.Root>
        </Field>

        {!isVirtual && (
          <View style={[a.gap_md]}>
            <Field label={l`Venue`}>
              <TextField.Root>
                <Dialog.Input
                  defaultValue={values.venue}
                  onChangeText={text => setValue('venue', text)}
                  label={l`Venue`}
                  placeholder={l`e.g. Public Library`}
                  testID="eventVenueInput"
                />
              </TextField.Root>
            </Field>
            <Field label={l`Street address`}>
              <TextField.Root>
                <Dialog.Input
                  defaultValue={values.street}
                  onChangeText={text => setValue('street', text)}
                  label={l`Street address`}
                  testID="eventStreetInput"
                />
              </TextField.Root>
            </Field>
            <View style={[a.flex_row, a.gap_md]}>
              <View style={[a.flex_1]}>
                <Field label={l`City`}>
                  <TextField.Root>
                    <Dialog.Input
                      defaultValue={values.locality}
                      onChangeText={text => setValue('locality', text)}
                      label={l`City`}
                      placeholder={l`e.g. Amsterdam`}
                      testID="eventLocalityInput"
                    />
                  </TextField.Root>
                </Field>
              </View>
              <View style={{width: 110}}>
                <Field
                  label={l`Country`}
                  error={errorText(visibleErrors.country)}>
                  <TextField.Root isInvalid={!!visibleErrors.country}>
                    <Dialog.Input
                      defaultValue={values.country}
                      onChangeText={text => setValue('country', text)}
                      label={l`Country code`}
                      placeholder="NL"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={2}
                      testID="eventCountryInput"
                    />
                  </TextField.Root>
                </Field>
              </View>
            </View>
          </View>
        )}

        <View style={[a.gap_md]}>
          <Field
            label={isVirtual ? l`Link to join` : l`Link (optional)`}
            error={errorText(visibleErrors.linkUri)}>
            <TextField.Root isInvalid={!!visibleErrors.linkUri}>
              <Dialog.Input
                defaultValue={values.linkUri}
                onChangeText={text => setValue('linkUri', text)}
                label={l`Link`}
                placeholder="https://"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                testID="eventLinkInput"
              />
            </TextField.Root>
          </Field>
          {values.linkUri.trim() !== '' && (
            <Field label={l`Link text (optional)`}>
              <TextField.Root>
                <Dialog.Input
                  defaultValue={values.linkName}
                  onChangeText={text => setValue('linkName', text)}
                  label={l`Link text`}
                  placeholder={l`e.g. Tickets`}
                  testID="eventLinkNameInput"
                />
              </TextField.Root>
            </Field>
          )}
        </View>

        {event && (
          <Field label={l`Status`}>
            <SegmentedControl.Root
              type="radio"
              label={l`Status`}
              value={values.status}
              onChange={(status: EventStatus) => setValue('status', status)}>
              <SegmentedControl.Item
                value="community.lexicon.calendar.event#scheduled"
                label={l`Scheduled`}>
                <SegmentedControl.ItemText>
                  <Trans>Scheduled</Trans>
                </SegmentedControl.ItemText>
              </SegmentedControl.Item>
              <SegmentedControl.Item
                value="community.lexicon.calendar.event#postponed"
                label={l`Postponed`}>
                <SegmentedControl.ItemText>
                  <Trans>Postponed</Trans>
                </SegmentedControl.ItemText>
              </SegmentedControl.Item>
              <SegmentedControl.Item
                value="community.lexicon.calendar.event#cancelled"
                label={l`Cancelled`}>
                <SegmentedControl.ItemText>
                  <Trans>Cancelled</Trans>
                </SegmentedControl.ItemText>
              </SegmentedControl.Item>
            </SegmentedControl.Root>
          </Field>
        )}

        <View style={[a.gap_md]}>
          {saveError !== '' && <ErrorMessage message={saveError} />}
          <Button
            label={l`Save`}
            onPress={() => void onPressSave()}
            disabled={(!!event && !dirty) || isPending}
            size="large"
            color="primary"
            testID="eventFormSaveBtn">
            <ButtonText>
              <Trans>Save</Trans>
            </ButtonText>
            {isPending && <ButtonIcon icon={Loader} />}
          </Button>
        </View>
      </View>
    </Dialog.ScrollableInner>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <View>
      <TextField.LabelText>{label}</TextField.LabelText>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </View>
  )
}

function FieldError({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <Text
      style={[
        a.mt_xs,
        a.text_sm,
        a.font_bold,
        {color: t.palette.negative_400},
      ]}>
      {children}
    </Text>
  )
}
