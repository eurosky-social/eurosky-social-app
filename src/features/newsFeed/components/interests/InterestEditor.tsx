import {type ReactNode, useState} from 'react'
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import {ArrowLeft_Stroke2_Corner0_Rounded as ArrowLeftIcon} from '#/components/icons/Arrow'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {
  useDutchOutletsQuery,
  useDutchThemesQuery,
} from '#/features/news/dutch/queries'
import {type DutchOutletListing} from '#/features/news/dutch/types'
import {OutletIcon} from '#/features/news/explore/components/OutletIcon'
import {
  outletCoverage,
  outletsForInterest,
  SUB_LOCATIONS,
} from '#/features/news/explore/interests'
import {countryName} from '#/features/news/explore/useInterestTitle'
import {type NewsInterest} from '../../state/prefs'
import {SetupFooter} from '../SetupFooter'
import {SetupHeader, StepDots} from '../SetupHeader'

const STEPS = ['places', 'themes', 'outlets'] as const
type Step = (typeof STEPS)[number]

/**
 * One interest as a short wizard: which countries the news is from (and, for
 * the Netherlands, which provinces), what it is about, then which outlets. Its
 * tab is named after its places (see `useInterestTitle`). Every step starts open - nothing
 * picked is everything - so pressing Next through it gives all the news from
 * everywhere. Nothing reaches the settings until Done; backing out of the
 * first step leaves the interest as it was.
 *
 * As a `dialog` it fills a `Dialog.Outer` instead of a screen, for editing an
 * interest without leaving the page it is shown on.
 */
export function InterestEditor({
  initial,
  isNew,
  variant = 'screen',
  onDone,
  onCancel,
  onDelete,
}: {
  initial: NewsInterest
  isNew: boolean
  variant?: 'screen' | 'dialog'
  onDone: (interest: NewsInterest) => void
  onCancel: () => void
  /** Offers Delete on the last step, for an interest that is not new. */
  onDelete?: () => void
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {gtMobile} = useBreakpoints()
  const [interest, setInterest] = useState(initial)
  const [step, setStep] = useState<Step>('places')
  const outletsQuery = useDutchOutletsQuery()

  /* Outlets the service holds no articles from yet would change nothing. */
  const outlets = (outletsQuery.outlets ?? []).filter(
    outlet => outlet.articles > 0,
  )
  const placeOutlets = outletsForInterest(interest, outlets).sort((x, y) =>
    x.name.localeCompare(y.name, i18n.locale),
  )
  const index = STEPS.indexOf(step)

  function back() {
    if (index === 0) {
      onCancel()
    } else {
      setStep(STEPS[index - 1])
    }
    return true
  }

  function done() {
    /* Only outlets of its places can be left out; the rest are dropped. */
    const offered = new Set(placeOutlets.map(outlet => outlet.slug))
    onDone({
      ...interest,
      excludedOutlets: outletsQuery.outlets
        ? interest.excludedOutlets.filter(slug => offered.has(slug))
        : interest.excludedOutlets,
    })
  }

  const title = isNew ? l`New interest` : l`Edit interest`

  const body =
    step === 'places' ? (
      <PlacesStep
        interest={interest}
        outlets={outlets}
        isLoading={outletsQuery.isLoading}
        isError={outletsQuery.isError}
        onRetry={() => void outletsQuery.refetch()}
        onChange={setInterest}
      />
    ) : step === 'themes' ? (
      <ThemesStep interest={interest} onChange={setInterest} />
    ) : (
      <OutletsStep
        interest={interest}
        placeOutlets={placeOutlets}
        isLoading={outletsQuery.isLoading}
        isError={outletsQuery.isError}
        onRetry={() => void outletsQuery.refetch()}
        onChange={setInterest}
      />
    )

  const actions = (
    <View style={[a.flex_row, a.gap_sm]}>
      {step === 'outlets' && !isNew && onDelete && (
        <Button
          testID="newsInterestDeleteBtn"
          label={l`Delete this interest`}
          size="large"
          color="negative_subtle"
          onPress={onDelete}>
          <ButtonText>
            <Trans>Delete</Trans>
          </ButtonText>
        </Button>
      )}
      {step === 'outlets' ? (
        <Button
          testID="newsInterestDoneBtn"
          label={l`Keep this interest`}
          size="large"
          color="primary"
          onPress={done}
          style={[a.flex_1]}>
          <ButtonText>
            <Trans>Done</Trans>
          </ButtonText>
        </Button>
      ) : (
        <Button
          testID="newsInterestNextBtn"
          label={l`Next`}
          size="large"
          color="primary"
          onPress={() => setStep(STEPS[index + 1])}
          style={[a.flex_1]}>
          <ButtonText>
            <Trans>Next</Trans>
          </ButtonText>
        </Button>
      )}
    </View>
  )

  if (variant === 'dialog') {
    return (
      <Dialog.ScrollableInner
        label={title}
        footer={
          <View
            style={[
              gtMobile ? a.px_2xl : a.px_xl,
              a.py_md,
              a.border_t,
              t.atoms.border_contrast_low,
              t.atoms.bg,
            ]}>
            {actions}
          </View>
        }>
        <View style={[a.gap_lg]}>
          <View
            style={[
              a.flex_row,
              a.align_center,
              a.gap_sm,
              /* Clear of the close button the web dialog pins top right. */
              web({paddingRight: 40}),
            ]}>
            {index > 0 && (
              <Button
                label={l`Back to the previous step`}
                size="small"
                color="secondary"
                variant="ghost"
                shape="round"
                onPress={back}>
                <ButtonIcon icon={ArrowLeftIcon} size="lg" />
              </Button>
            )}
            <Text style={[a.flex_1, a.text_xl, a.font_bold]}>{title}</Text>
            <StepDots current={index + 1} total={STEPS.length} />
          </View>
          {body}
        </View>
        <Dialog.Close />
      </Dialog.ScrollableInner>
    )
  }

  return (
    <Layout.Screen testID="newsInterestEditor">
      <SetupHeader
        title={title}
        step={index + 1}
        totalSteps={STEPS.length}
        onBack={back}
      />

      <Layout.Content
        style={[a.flex_1]}
        contentContainerStyle={[{paddingBottom: 120}]}>
        <View style={[a.px_xl, a.pt_xl, a.pb_lg, a.gap_lg]}>{body}</View>
      </Layout.Content>

      <SetupFooter>{actions}</SetupFooter>
    </Layout.Screen>
  )
}

function PlacesStep({
  interest,
  outlets,
  isLoading,
  isError,
  onRetry,
  onChange,
}: {
  interest: NewsInterest
  outlets: DutchOutletListing[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onChange: (next: NewsInterest) => void
}) {
  const {t: l, i18n} = useLingui()
  const countries = [
    ...new Set(
      outlets
        .map(outlet => outlet.country)
        .filter((country): country is string => !!country),
    ),
  ]
    .map(code => ({code, name: countryName(code, i18n.locale)}))
    /* The Netherlands leads: the aggregator covers it most closely. */
    .sort(
      (x, y) =>
        Number(y.code === 'nl') - Number(x.code === 'nl') ||
        x.name.localeCompare(y.name, i18n.locale),
    )

  /* A province goes with its country. */
  function setCountries(next: string[]) {
    onChange({
      ...interest,
      countries: next,
      subLocations: interest.subLocations.filter(id =>
        next.some(country =>
          SUB_LOCATIONS[country]?.some(region => region.id === id),
        ),
      ),
    })
  }

  function setSubLocations(country: string, next: string[]) {
    const inCountry = new Set(SUB_LOCATIONS[country].map(region => region.id))
    onChange({
      ...interest,
      subLocations: [
        ...interest.subLocations.filter(id => !inCountry.has(id)),
        ...next,
      ],
    })
  }

  /* The picked countries a place inside can narrow: for now the Netherlands. */
  const narrowable = interest.countries.filter(
    country => SUB_LOCATIONS[country],
  )

  return (
    <>
      <StepTitle
        titleText={<Trans>Where from?</Trans>}
        hintText={<Trans>Pick nothing for news from everywhere.</Trans>}
      />
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <LoadError onRetry={onRetry} />
      ) : (
        <Toggle.Group
          type="checkbox"
          label={l`Countries`}
          values={interest.countries}
          onChange={setCountries}
          style={CHIP_ROW}>
          <AllChip
            label={l`Everywhere`}
            active={interest.countries.length === 0}
            onPress={() => setCountries([])}
          />
          {countries.map(country => (
            <Toggle.Item
              key={country.code}
              name={country.code}
              label={country.name}>
              <CompactChip label={country.name} />
            </Toggle.Item>
          ))}
        </Toggle.Group>
      )}
      {!isLoading &&
        !isError &&
        narrowable.map(country => {
          const name = countryName(country, i18n.locale)
          const regions = SUB_LOCATIONS[country]
          const picked = interest.subLocations.filter(id =>
            regions.some(region => region.id === id),
          )
          return (
            <View key={country} style={[a.gap_sm]}>
              <SubStepTitle
                titleText={<Trans>Where in {name}?</Trans>}
                hintText={<Trans>Pick nothing for the whole country.</Trans>}
              />
              <Toggle.Group
                type="checkbox"
                label={l`Places in ${name}`}
                values={picked}
                onChange={next => setSubLocations(country, next)}
                style={CHIP_ROW}>
                <AllChip
                  label={l`All of ${name}`}
                  active={picked.length === 0}
                  onPress={() => setSubLocations(country, [])}
                />
                {regions.map(region => (
                  <Toggle.Item
                    key={region.id}
                    name={region.id}
                    label={region.label}>
                    <CompactChip label={region.label} />
                  </Toggle.Item>
                ))}
              </Toggle.Group>
            </View>
          )
        })}
    </>
  )
}

/** A heading within a step, for a facet that narrows the one above it. */
function SubStepTitle({
  titleText,
  hintText,
}: {
  titleText: ReactNode
  hintText: ReactNode
}) {
  const t = useTheme()
  return (
    <View style={[a.gap_2xs, a.pt_sm]}>
      <Text style={[a.text_md, a.font_semi_bold, a.leading_tight]}>
        {titleText}
      </Text>
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        {hintText}
      </Text>
    </View>
  )
}

function ThemesStep({
  interest,
  onChange,
}: {
  interest: NewsInterest
  onChange: (next: NewsInterest) => void
}) {
  const {t: l} = useLingui()
  const {themes, isLoading} = useDutchThemesQuery()

  return (
    <>
      <StepTitle
        titleText={<Trans>About what?</Trans>}
        hintText={<Trans>Pick nothing for every topic.</Trans>}
      />
      {isLoading ? (
        <Loader />
      ) : (
        <Toggle.Group
          type="checkbox"
          label={l`Topics`}
          values={interest.themes}
          onChange={themes => onChange({...interest, themes})}
          style={CHIP_ROW}>
          <AllChip
            label={l`All topics`}
            active={interest.themes.length === 0}
            onPress={() => onChange({...interest, themes: []})}
          />
          {themes.map(theme => (
            <Toggle.Item key={theme.slug} name={theme.slug} label={theme.name}>
              <CompactChip label={theme.name} />
            </Toggle.Item>
          ))}
        </Toggle.Group>
      )}
    </>
  )
}

function OutletsStep({
  interest,
  placeOutlets,
  isLoading,
  isError,
  onRetry,
  onChange,
}: {
  interest: NewsInterest
  placeOutlets: DutchOutletListing[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onChange: (next: NewsInterest) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const included = placeOutlets
    .map(outlet => outlet.slug)
    .filter(slug => !interest.excludedOutlets.includes(slug))
  /*
   * With topics picked, the outlets that cover them lead, most stories first,
   * and those with none on them follow on their own: still in, since they
   * cost nothing, but no reason to keep them either. Without topics, or from
   * a service that does not count, the outlets stay in name order.
   */
  const coverageOf = (outlet: DutchOutletListing) =>
    outletCoverage(outlet, interest.themes)
  const ranked = interest.themes.length > 0
  const covering = ranked
    ? placeOutlets
        .filter(outlet => coverageOf(outlet) !== 0)
        .sort((x, y) => (coverageOf(y) ?? 0) - (coverageOf(x) ?? 0))
    : placeOutlets
  const quiet = ranked
    ? placeOutlets.filter(outlet => coverageOf(outlet) === 0)
    : []

  function setIncluded(next: string[]) {
    onChange({
      ...interest,
      excludedOutlets: placeOutlets
        .map(outlet => outlet.slug)
        .filter(slug => !next.includes(slug)),
    })
  }

  return (
    <>
      <StepTitle
        titleText={<Trans>From which outlets?</Trans>}
        hintText={
          interest.strictOutlets ? (
            <Trans>Every outlet is in. Untick the ones you do not want.</Trans>
          ) : (
            <Trans>
              Every outlet is in. Untick some, and the stories of the ones left
              come first.
            </Trans>
          )
        }
      />
      <Toggle.Item
        testID="newsInterestStrictOutlets"
        name="strictOutlets"
        label={l`Only show these outlets`}
        value={interest.strictOutlets}
        onChange={strictOutlets => onChange({...interest, strictOutlets})}
        style={[a.flex_row, a.align_center, a.gap_md]}>
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text style={[a.text_md, a.font_semi_bold]}>
            <Trans>Only show these outlets</Trans>
          </Text>
          <Text
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>Leave out the stories the others covered alone.</Trans>
          </Text>
        </View>
        <Toggle.Switch />
      </Toggle.Item>
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <LoadError onRetry={onRetry} />
      ) : (
        <View style={[a.gap_md]}>
          <View style={[a.flex_row, a.align_center, a.gap_sm]}>
            <Text style={[a.flex_1, a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>
                {included.length} of {placeOutlets.length}
              </Trans>
            </Text>
            <Button
              label={l`Include every outlet`}
              size="tiny"
              color="secondary"
              disabled={included.length === placeOutlets.length}
              onPress={() => setIncluded(placeOutlets.map(o => o.slug))}>
              <ButtonText>
                <Trans>All</Trans>
              </ButtonText>
            </Button>
            <Button
              label={l`Leave out every outlet`}
              size="tiny"
              color="secondary"
              disabled={included.length === 0}
              onPress={() => setIncluded([])}>
              <ButtonText>
                <Trans>None</Trans>
              </ButtonText>
            </Button>
          </View>
          {interest.strictOutlets &&
            included.length === 0 &&
            placeOutlets.length > 0 && (
              <Text style={[a.text_sm, {color: t.palette.negative_500}]}>
                <Trans>
                  With no outlets ticked, this interest shows nothing.
                </Trans>
              </Text>
            )}
          <Toggle.Group
            type="checkbox"
            label={l`Outlets`}
            values={included}
            onChange={setIncluded}>
            <View style={[a.gap_xs]}>
              {covering.map(outlet => (
                <OutletItem
                  key={outlet.slug}
                  outlet={outlet}
                  stories={outletCoverage(outlet, interest.themes)}
                />
              ))}
              {quiet.length > 0 && (
                <Text
                  style={[
                    a.pt_md,
                    a.pb_xs,
                    a.text_sm,
                    a.font_semi_bold,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>No current stories on these topics</Trans>
                </Text>
              )}
              {quiet.map(outlet => (
                <OutletItem key={outlet.slug} outlet={outlet} quiet />
              ))}
            </View>
          </Toggle.Group>
        </View>
      )}
    </>
  )
}

function StepTitle({
  titleText,
  hintText,
}: {
  titleText: ReactNode
  hintText: ReactNode
}) {
  const t = useTheme()
  return (
    <View style={[a.gap_xs]}>
      <Text style={[a.text_xl, a.font_semi_bold, a.leading_tight]}>
        {titleText}
      </Text>
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        {hintText}
      </Text>
    </View>
  )
}

/**
 * A facet's chips, wrapping as one row: the chip that leaves it open, then
 * one per value. `Toggle.Group` is the row itself, since it renders a block.
 */
const CHIP_ROW = [a.flex_row, a.flex_wrap, a.gap_xs]

/** The chip for leaving a facet open, lit while nothing in it is picked. */
function AllChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const t = useTheme()
  return (
    <Button
      label={label}
      onPress={onPress}
      style={[
        a.rounded_full,
        a.py_xs,
        a.px_md,
        active ? t.atoms.bg_contrast_900 : t.atoms.bg_contrast_50,
      ]}>
      {({hovered, pressed}) => (
        <Text
          selectable={false}
          style={[
            a.text_sm,
            a.font_semi_bold,
            active ? t.atoms.text_inverted : {color: t.palette.contrast_900},
            (hovered || pressed) && !active && {opacity: 0.8},
          ]}>
          {label}
        </Text>
      )}
    </Button>
  )
}

/** A smaller take on the setup's chip, so a facet fits on a screen. */
function CompactChip({label}: {label: string}) {
  const t = useTheme()
  const ctx = Toggle.useItemContext()
  const interacted = ctx.hovered || ctx.focused || ctx.pressed

  return (
    <View
      style={[
        a.rounded_full,
        a.py_xs,
        a.px_md,
        t.atoms.bg_contrast_50,
        interacted && t.atoms.bg_contrast_100,
        ctx.selected && t.atoms.bg_contrast_900,
        ctx.selected && interacted && t.atoms.bg_contrast_975,
      ]}>
      <Text
        selectable={false}
        style={[
          a.text_sm,
          a.font_semi_bold,
          {color: t.palette.contrast_900},
          ctx.selected && t.atoms.text_inverted,
        ]}>
        {label}
      </Text>
    </View>
  )
}

function OutletItem({
  outlet,
  stories,
  quiet = false,
}: {
  outlet: DutchOutletListing
  /** Its current stories on the interest's topics, where the service says. */
  stories?: number
  /** It has none on the interest's topics. */
  quiet?: boolean
}) {
  const t = useTheme()
  const domain = outlet.domains[0]
  const detail =
    stories === undefined
      ? domain
      : [
          domain,
          plural(stories, {one: '# current story', other: '# current stories'}),
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <Toggle.Item
      name={outlet.slug}
      label={outlet.name}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.py_xs,
        quiet && {opacity: 0.6},
      ]}>
      <Toggle.Checkbox />
      <OutletIcon
        outlet={{
          id: outlet.slug,
          did: outlet.did ?? undefined,
          name: outlet.name,
          site: domain,
          categories: [],
        }}
        size={28}
      />
      <View style={[a.flex_1]}>
        <Text style={[a.text_md, a.font_semi_bold]} numberOfLines={1}>
          {outlet.name}
        </Text>
        {detail && (
          <Text
            style={[a.text_sm, t.atoms.text_contrast_medium]}
            numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
    </Toggle.Item>
  )
}

function LoadError({onRetry}: {onRetry: () => void}) {
  const {t: l} = useLingui()
  return (
    <View style={[a.gap_md, a.align_start]}>
      <Text style={[a.text_md]}>
        <Trans>The outlets could not be loaded.</Trans>
      </Text>
      <Button
        label={l`Try again`}
        size="small"
        color="secondary"
        onPress={onRetry}>
        <ButtonText>
          <Trans>Try again</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
