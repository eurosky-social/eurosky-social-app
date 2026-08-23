import {useEffect, useMemo, useRef, useState} from 'react'
import {ScrollView, type TextInput, View} from 'react-native'
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {useMutation} from '@tanstack/react-query'

import {
  type AvailabilityResult,
  ensureMarqueAtprotoRecord,
  ITEM_ACTIVE,
  ORDER_ACTIVE,
  ORDER_FAILED,
  type Registrant,
} from '#/lib/api/marque'
import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {cleanError} from '#/lib/strings/errors'
import {useFetchDid, useUpdateHandleMutation} from '#/state/queries/handle'
import {
  useCreateCheckoutMutation,
  useDomainSearchQuery,
  useFinalizeDomainPurchaseMutation,
  useMarquePricingQuery,
  useMarqueRequirementsQuery,
  useOrderPollingQuery,
} from '#/state/queries/marque'
import {usePdsClient, useSession} from '#/state/session'
import {oauthUpgradeForHandle} from '#/state/session/oauth-web-client'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {
  ArrowLeft_Stroke2_Corner0_Rounded as ArrowLeftIcon,
  ArrowRight_Stroke2_Corner0_Rounded as ArrowRightIcon,
} from '#/components/icons/Arrow'
import {CheckThick_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Globe_Stroke2_Corner0_Rounded as GlobeIcon} from '#/components/icons/Globe'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

type Page = 'search' | 'contact' | 'overview' | 'polling' | 'done'

type PaymentMethod = 'stripe' | 'paypal' | 'nowpayments'

const PENDING_CHECKOUT_KEY = 'eurosky.marque.pendingCheckout'

type PendingCheckout = {
  orderId: string
  domain: string
  checkoutUrl: string
}

function readPendingCheckout(): PendingCheckout | null {
  if (!IS_WEB || typeof window === 'undefined') return null
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(PENDING_CHECKOUT_KEY) ?? 'null',
    )
    if (
      value &&
      typeof value === 'object' &&
      'orderId' in value &&
      'domain' in value &&
      'checkoutUrl' in value &&
      typeof value.orderId === 'string' &&
      typeof value.domain === 'string' &&
      typeof value.checkoutUrl === 'string'
    ) {
      return {
        orderId: value.orderId,
        domain: value.domain,
        checkoutUrl: value.checkoutUrl,
      }
    }
  } catch {}
  return null
}

function readCallbackOrderId(): string | null {
  if (!IS_WEB || typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('order')
}

function writePendingCheckout(value: PendingCheckout | null) {
  if (!IS_WEB || typeof window === 'undefined') return
  if (value) {
    window.localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(value))
  } else {
    window.localStorage.removeItem(PENDING_CHECKOUT_KEY)
  }
}

export function hasPendingDomainCheckout() {
  return readCallbackOrderId() !== null || readPendingCheckout() !== null
}

const PAYMENT_METHODS: {value: PaymentMethod; label: string}[] = [
  {value: 'stripe', label: 'Card'},
  {value: 'paypal', label: 'PayPal'},
  {value: 'nowpayments', label: 'Crypto'},
]

const STATE_REQUIRED_COUNTRIES = new Set([
  'US',
  'CA',
  'AU',
  'IE',
  'GB',
  'IT',
  'BR',
  'JP',
  'MX',
])

type Provisioned = {
  domain: string
  nameServers: string[]
  registeredAt?: string
  expiresAt?: string
}

export function BuyDomainDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <BuyDomainDialogInner />
    </Dialog.Outer>
  )
}

function BuyDomainDialogInner() {
  const control = Dialog.useDialogContext()
  const {t: l} = useLingui()

  const cancelButton = () => (
    <Button
      label={l`Cancel`}
      onPress={() => control.close()}
      size="small"
      color="primary"
      variant="ghost"
      style={[a.rounded_full]}>
      <ButtonText style={[a.text_md]}>
        <Trans>Cancel</Trans>
      </ButtonText>
    </Button>
  )

  return (
    <Dialog.ScrollableInner
      label={l`Buy a domain`}
      header={
        <Dialog.Header renderLeft={cancelButton}>
          <Dialog.HeaderText>
            <Trans>Buy a domain</Trans>
          </Dialog.HeaderText>
        </Dialog.Header>
      }
      contentContainerStyle={[a.pt_0, a.px_0]}>
      <View style={[a.px_xl, a.pt_lg]}>
        <BuyDomainFlow />
      </View>
    </Dialog.ScrollableInner>
  )
}

export function BuyDomainFlow() {
  const openUrl = useOpenUrl()
  const pendingCheckout = useMemo(readPendingCheckout, [])
  const callbackOrderId = useMemo(readCallbackOrderId, [])
  const resumedCheckout =
    pendingCheckout?.orderId === callbackOrderId || !callbackOrderId
      ? pendingCheckout
      : null
  const initialOrderId = callbackOrderId ?? resumedCheckout?.orderId ?? null

  const [page, setPage] = useState<Page>(initialOrderId ? 'polling' : 'search')
  const [name, setName] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<string | null>(
    resumedCheckout?.domain ?? null,
  )
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null)
  const [orderId, setOrderId] = useState<string | null>(initialOrderId)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(
    resumedCheckout?.checkoutUrl ?? null,
  )
  const [provisioned, setProvisioned] = useState<Provisioned | null>(null)
  const [registrant, setRegistrant] = useState<Registrant | null>(null)

  return (
    <View style={[a.gap_md]}>
      {page === 'search' && (
        <SearchPage
          name={name}
          setName={setName}
          selectedDomain={selectedDomain}
          setSelectedDomain={(d, price) => {
            setSelectedDomain(d)
            setSelectedPrice(price ?? null)
          }}
          onContinue={() => setPage('contact')}
        />
      )}
      {page === 'contact' && selectedDomain && (
        <ContactPage
          domain={selectedDomain}
          initialRegistrant={registrant}
          onBack={() => setPage('search')}
          onContinue={r => {
            setRegistrant(r)
            setPage('overview')
          }}
        />
      )}
      {page === 'overview' && selectedDomain && registrant && (
        <OverviewPage
          domain={selectedDomain}
          price={selectedPrice}
          registrant={registrant}
          onBack={() => setPage('contact')}
          onCheckout={(id, url) => {
            const pending = {
              orderId: id,
              domain: selectedDomain,
              checkoutUrl: url,
            }
            setOrderId(id)
            setCheckoutUrl(url)
            setPage('polling')
            // Same-tab navigation avoids popup blockers after the async call.
            if (IS_WEB && typeof window !== 'undefined') {
              writePendingCheckout(pending)
              window.location.href = url
            } else {
              openUrl(url)
            }
          }}
        />
      )}
      {page === 'polling' && orderId && (
        <PollingPage
          orderId={orderId}
          domain={selectedDomain}
          checkoutUrl={checkoutUrl}
          onProvisioned={p => {
            writePendingCheckout(null)
            setProvisioned(p)
            setPage('done')
          }}
          onBack={() => {
            writePendingCheckout(null)
            setOrderId(null)
            setCheckoutUrl(null)
            setPage(selectedDomain && registrant ? 'overview' : 'search')
          }}
        />
      )}
      {page === 'done' && provisioned && (
        <DonePage
          provisioned={provisioned}
          onReset={() => {
            writePendingCheckout(null)
            setOrderId(null)
            setProvisioned(null)
            setCheckoutUrl(null)
            setSelectedDomain(null)
            setSelectedPrice(null)
            setName('')
            setPage('search')
          }}
        />
      )}
    </View>
  )
}

function useOpenUrl() {
  const openLink = useOpenLink()
  return (url: string) => openLink(url)
}

function SearchPage({
  name,
  setName,
  selectedDomain,
  setSelectedDomain,
  onContinue,
}: {
  name: string
  setName: (n: string) => void
  selectedDomain: string | null
  setSelectedDomain: (d: string | null, price?: number) => void
  onContinue: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const inputRef = useRef<TextInput | null>(null)
  const wasFocusedRef = useRef(false)
  const {
    data: pricing,
    isError: pricingError,
    error: pricingErr,
  } = useMarquePricingQuery()
  const tlds = pricing?.tlds ?? []

  const [debouncedName, setDebouncedName] = useState('')
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedName(name), 350)
    return () => clearTimeout(handle)
  }, [name])

  const {
    data,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    isError: searchError,
    error: searchErr,
    fetchNextPage,
  } = useDomainSearchQuery(debouncedName, tlds, {enabled: tlds.length > 0})
  const results = useMemo(
    () =>
      (data?.pages ?? []).flatMap(page =>
        [...page.results].sort((a, b) => {
          const av = a.available ? 0 : 1
          const bv = b.available ? 0 : 1
          return av - bv
        }),
      ),
    [data],
  )

  const anyAvailable = results.some(r => r.available)

  // Some browsers move focus when the results scroller mounts.
  useEffect(() => {
    if (results.length > 0 && wasFocusedRef.current) {
      inputRef.current?.focus()
    }
  }, [results.length])

  const onNameChange = (text: string) => {
    setName(text)
    setSelectedDomain(null)
  }

  const rowPrice = (r: AvailabilityResult): number | undefined =>
    r.isPremium && r.premiumPrice != null ? r.premiumPrice : r.price

  return (
    <>
      <Text style={[a.leading_snug]}>
        <Trans>
          Buy a domain and we’ll set it up as your handle automatically. No DNS
          configuration needed. Powered by Marque.
        </Trans>
      </Text>

      <View>
        <TextField.LabelText>
          <Trans>Find a domain</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <TextField.Icon icon={GlobeIcon} />
          <Dialog.Input
            label={l`Find a domain`}
            placeholder={l`e.g. alice`}
            defaultValue={name}
            onChangeText={onNameChange}
            inputRef={inputRef}
            onFocus={() => (wasFocusedRef.current = true)}
            onBlur={() => (wasFocusedRef.current = false)}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            keyboardType="url"
          />
        </TextField.Root>
      </View>

      {isFetching && results.length === 0 && (
        <View style={[a.flex_row, a.align_center, a.gap_sm, a.py_sm]}>
          <Loader size="sm" />
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>Checking availability…</Trans>
          </Text>
        </View>
      )}

      {pricingError && (
        <Admonition type="error">{cleanError(pricingErr)}</Admonition>
      )}
      {searchError && (
        <Admonition type="error">{cleanError(searchErr)}</Admonition>
      )}

      {results.length > 0 && (
        <ScrollView
          style={[
            {maxHeight: 320},
            web({
              scrollbarWidth: 'thin',
              scrollbarColor: `${t.palette.contrast_100} transparent`,
            }),
          ]}
          contentContainerStyle={[a.gap_xs]}
          keyboardShouldPersistTaps="handled">
          {!anyAvailable && (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium, a.py_xs]}>
              <Trans>
                No domains available for “{name}”. Try another name.
              </Trans>
            </Text>
          )}
          {results.map(r => (
            <DomainResultRow
              key={r.domain}
              result={r}
              selected={selectedDomain === r.domain}
              onSelect={() =>
                setSelectedDomain(
                  r.available ? r.domain : null,
                  r.available ? rowPrice(r) : undefined,
                )
              }
            />
          ))}
        </ScrollView>
      )}

      {hasNextPage && (
        <Button
          label={l`Show more extensions`}
          variant="outline"
          color="secondary"
          size="small"
          disabled={isFetchingNextPage}
          onPress={() => void fetchNextPage()}>
          {isFetchingNextPage ? (
            <ButtonIcon icon={Loader} />
          ) : (
            <ButtonText>
              <Trans>Show more extensions</Trans>
            </ButtonText>
          )}
        </Button>
      )}

      <Button
        label={l`Continue`}
        variant="solid"
        size="large"
        color={selectedDomain ? 'primary' : 'secondary'}
        disabled={!selectedDomain}
        onPress={onContinue}>
        <ButtonText>
          <Trans>Continue</Trans>
        </ButtonText>
        <ButtonIcon icon={ArrowRightIcon} position="right" />
      </Button>
    </>
  )
}

function DomainResultRow({
  result,
  selected,
  onSelect,
}: {
  result: AvailabilityResult
  selected: boolean
  onSelect: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const available = !!result.available
  const price =
    result.isPremium && result.premiumPrice != null
      ? result.premiumPrice
      : result.price
  const showRenew =
    available &&
    !result.isPremium &&
    result.renewPrice != null &&
    price != null &&
    result.renewPrice !== price

  // Button forwards tabIndex at runtime, but its public props omit the type.
  const ResultButton = Button as React.ComponentType<
    React.ComponentProps<typeof Button> & {tabIndex?: number}
  >

  return (
    <ResultButton
      label={result.domain}
      variant="outline"
      color={selected ? 'primary' : available ? 'secondary' : 'secondary'}
      size="small"
      shape="rectangular"
      disabled={!available}
      onPress={onSelect}
      tabIndex={-1}
      style={[
        a.w_full,
        !available && {opacity: 0.5},
        selected && {backgroundColor: t.palette.primary_50},
      ]}>
      <View style={[a.flex_row, a.align_center, a.justify_between, a.flex_1]}>
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          {available ? (
            <CheckIcon
              fill={selected ? t.palette.primary_500 : t.palette.positive_500}
              size="xs"
            />
          ) : null}
          <Text style={[a.text_md]}>{result.domain}</Text>
          {result.isPremium && available && (
            <Text
              style={[
                a.text_xs,
                selected ? t.atoms.text : t.atoms.text_contrast_medium,
              ]}>
              <Trans>Premium</Trans>
            </Text>
          )}
        </View>
        <View style={[a.align_end]}>
          <Text
            style={[
              a.text_md,
              a.font_semi_bold,
              !available && t.atoms.text_contrast_low,
            ]}>
            {available
              ? price != null
                ? showRenew
                  ? `$${price}`
                  : `$${price}/yr`
                : l`Available`
              : l`Taken`}
          </Text>
          {showRenew && (
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              <Trans>renews ${result.renewPrice}/yr</Trans>
            </Text>
          )}
        </View>
      </View>
    </ResultButton>
  )
}

function ContactPage({
  domain,
  initialRegistrant,
  onBack,
  onContinue,
}: {
  domain: string
  initialRegistrant: Registrant | null
  onBack: () => void
  onContinue: (r: Registrant) => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()

  const [firstName, setFirstName] = useState(initialRegistrant?.firstName ?? '')
  const [lastName, setLastName] = useState(initialRegistrant?.lastName ?? '')
  const [email, setEmail] = useState(initialRegistrant?.email ?? '')
  const [phoneCountryCode, setPhoneCountryCode] = useState(
    initialRegistrant?.phoneCountryCode ?? '',
  )
  const [phoneSubscriber, setPhoneSubscriber] = useState(
    initialRegistrant?.phoneSubscriber ?? '',
  )
  const [street, setStreet] = useState(initialRegistrant?.street ?? '')
  const [city, setCity] = useState(initialRegistrant?.city ?? '')
  const [zipcode, setZipcode] = useState(initialRegistrant?.zipcode ?? '')
  const [country, setCountry] = useState(initialRegistrant?.country ?? '')
  const [region, setRegion] = useState(initialRegistrant?.state ?? '')
  const [nationalId, setNationalId] = useState(
    initialRegistrant?.passportNumber ??
      initialRegistrant?.socialSecurityNumber ??
      '',
  )
  const [companyRegistrationNumber, setCompanyRegistrationNumber] = useState(
    initialRegistrant?.companyRegistrationNumber ?? '',
  )
  const [taxIdType, setTaxIdType] = useState(initialRegistrant?.taxIdType ?? '')
  const [taxIdValue, setTaxIdValue] = useState(
    initialRegistrant?.taxIdValue ?? '',
  )
  const {
    data: requirements,
    isLoading: requirementsLoading,
    isError: requirementsError,
  } = useMarqueRequirementsQuery(domain)
  const normalizedCountry = country.trim().toUpperCase()
  const stateRequired = STATE_REQUIRED_COUNTRIES.has(normalizedCountry)

  const registrantValid =
    !!firstName.trim() &&
    !!lastName.trim() &&
    !!email.trim() &&
    !!phoneCountryCode.trim() &&
    !!phoneSubscriber.trim() &&
    !!street.trim() &&
    !!city.trim() &&
    !!zipcode.trim() &&
    normalizedCountry.length === 2 &&
    (!stateRequired || !!region.trim()) &&
    (!requirements?.passportNumberRequired || !!nationalId.trim()) &&
    (!requirements?.companyRegistrationNumberRequired ||
      !!companyRegistrationNumber.trim()) &&
    (!requirements?.taxNumberRequired || !!taxIdValue.trim()) &&
    !requirementsLoading &&
    !requirementsError

  const onSubmit = () => {
    if (!registrantValid) return
    onContinue({
      firstName,
      lastName,
      email,
      phoneCountryCode,
      phoneSubscriber,
      street,
      city,
      zipcode,
      country: normalizedCountry,
      state: region || undefined,
      passportNumber: nationalId || undefined,
      socialSecurityNumber: nationalId || undefined,
      companyRegistrationNumber: companyRegistrationNumber || undefined,
      taxIdType: taxIdType || undefined,
      taxIdValue: taxIdValue || undefined,
    })
  }

  return (
    <>
      <View style={[a.flex_row, a.align_center, a.gap_sm]}>
        <Button
          label={l`Back`}
          onPress={onBack}
          size="small"
          color="secondary"
          variant="ghost">
          <ButtonIcon icon={ArrowLeftIcon} position="left" />
          <ButtonText>
            <Trans>Back</Trans>
          </ButtonText>
        </Button>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>Registering {domain}</Trans>
        </Text>
      </View>

      <Text style={[a.leading_snug]}>
        <Trans>
          These details are sent to the registrar to register the domain in your
          name. We don’t store them.
        </Trans>
      </Text>

      <ScrollView
        style={[
          {maxHeight: 320},
          web({
            scrollbarWidth: 'thin',
            scrollbarColor: `${t.palette.contrast_100} transparent`,
          }),
        ]}
        contentContainerStyle={[a.gap_md]}
        keyboardShouldPersistTaps="handled">
        <TextFieldRow
          label={l`First name`}
          value={firstName}
          onChange={setFirstName}
        />
        <TextFieldRow
          label={l`Last name`}
          value={lastName}
          onChange={setLastName}
        />
        <TextFieldRow
          label={l`Email`}
          value={email}
          onChange={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View style={[a.flex_row, a.gap_sm]}>
          <View style={[a.flex_1]}>
            <TextFieldRow
              label={l`Country code`}
              value={phoneCountryCode}
              onChange={setPhoneCountryCode}
              placeholder={l`+1`}
              keyboardType="phone-pad"
            />
          </View>
          <View style={[a.flex_1, {flex: 2}]}>
            <TextFieldRow
              label={l`Phone`}
              value={phoneSubscriber}
              onChange={setPhoneSubscriber}
              keyboardType="phone-pad"
            />
          </View>
        </View>
        <TextFieldRow label={l`Street`} value={street} onChange={setStreet} />
        <View style={[a.flex_row, a.gap_sm]}>
          <View style={[a.flex_1]}>
            <TextFieldRow label={l`City`} value={city} onChange={setCity} />
          </View>
          <View style={[a.flex_1]}>
            <TextFieldRow
              label={l`Postal code`}
              value={zipcode}
              onChange={setZipcode}
            />
          </View>
        </View>
        <View style={[a.flex_row, a.gap_sm]}>
          <View style={[a.flex_1]}>
            <TextFieldRow
              label={l`Country (2 letters)`}
              value={country}
              onChange={setCountry}
              placeholder={l`US`}
              autoCapitalize="characters"
            />
          </View>
          <View style={[a.flex_1]}>
            <TextFieldRow
              label={
                stateRequired
                  ? l`State / Province`
                  : l`State / Province (optional)`
              }
              value={region}
              onChange={setRegion}
              placeholder={stateRequired ? l`Required` : l`Optional`}
            />
          </View>
        </View>
        {requirements?.passportNumberRequired && (
          <TextFieldRow
            label={l`National ID / passport number`}
            value={nationalId}
            onChange={setNationalId}
          />
        )}
        {requirements?.companyRegistrationNumberRequired && (
          <TextFieldRow
            label={l`Company registration number`}
            value={companyRegistrationNumber}
            onChange={setCompanyRegistrationNumber}
          />
        )}
        {requirements?.taxNumberRequired && (
          <>
            <TextFieldRow
              label={l`Tax ID type (optional)`}
              value={taxIdType}
              onChange={setTaxIdType}
              placeholder={l`Optional`}
            />
            <TextFieldRow
              label={l`Tax / VAT ID`}
              value={taxIdValue}
              onChange={setTaxIdValue}
            />
          </>
        )}
      </ScrollView>

      {requirementsLoading && (
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <Loader size="sm" />
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>Loading registry requirements…</Trans>
          </Text>
        </View>
      )}
      {requirementsError && (
        <Admonition type="error">
          <Trans>
            We couldn’t load this domain’s registry requirements. Please try
            again.
          </Trans>
        </Admonition>
      )}

      <Button
        label={l`Next`}
        variant="solid"
        size="large"
        color={registrantValid ? 'primary' : 'secondary'}
        disabled={!registrantValid}
        onPress={onSubmit}>
        <ButtonText>
          <Trans>Next</Trans>
        </ButtonText>
        <ButtonIcon icon={ArrowRightIcon} position="right" />
      </Button>
    </>
  )
}

function OverviewPage({
  domain,
  price,
  registrant,
  onBack,
  onCheckout,
}: {
  domain: string
  price: number | null
  registrant: Registrant
  onBack: () => void
  onCheckout: (orderId: string, checkoutUrl: string) => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const createCheckout = useCreateCheckoutMutation()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe')

  const years = 1
  const lineTotal = price ?? 0
  const total = lineTotal * years

  const onSubmit = () => {
    createCheckout.mutate(
      {
        items: [{domain, years, whoisPrivacy: true}],
        registrant,
        paymentMethod,
      },
      {
        onSuccess: res => onCheckout(res.orderId, res.checkoutUrl),
      },
    )
  }

  return (
    <>
      <View style={[a.flex_row, a.align_center, a.gap_sm]}>
        <Button
          label={l`Back`}
          onPress={onBack}
          size="small"
          color="secondary"
          variant="ghost">
          <ButtonIcon icon={ArrowLeftIcon} position="left" />
          <ButtonText>
            <Trans>Back</Trans>
          </ButtonText>
        </Button>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>Review your order</Trans>
        </Text>
      </View>

      <View
        style={[
          a.gap_sm,
          a.p_md,
          a.rounded_md,
          t.atoms.bg_contrast_25,
          a.border,
          t.atoms.border_contrast_low,
        ]}>
        <SummaryRow label={l`Domain`} value={domain} />
        <SummaryRow
          label={l`Registration`}
          value={l`${years} year${years > 1 ? 's' : ''}`}
        />
        <SummaryRow label={l`WHOIS privacy`} value={l`Included`} muted />
        <View style={[a.border_t, t.atoms.border_contrast_low, a.mt_xs]} />
        <SummaryRow
          label={l`Total due`}
          value={price != null ? `$${total}` : l`—`}
          bold
        />
      </View>

      <View style={[a.gap_xs]}>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Payment method</Trans>
        </Text>
        <View style={[a.flex_row, a.gap_sm]}>
          {PAYMENT_METHODS.map(m => {
            const selected = paymentMethod === m.value
            return (
              <Button
                key={m.value}
                label={m.label}
                size="small"
                variant={selected ? 'solid' : 'outline'}
                color={selected ? 'primary' : 'secondary'}
                onPress={() => setPaymentMethod(m.value)}>
                <ButtonText>
                  <Trans>{m.label}</Trans>
                </ButtonText>
              </Button>
            )
          })}
        </View>
      </View>

      {createCheckout.isError && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Admonition type="error">
            {cleanError(createCheckout.error)}
          </Admonition>
        </Animated.View>
      )}

      <Button
        label={l`Continue to payment`}
        variant="solid"
        size="large"
        color="primary"
        disabled={createCheckout.isPending}
        onPress={onSubmit}>
        {createCheckout.isPending ? (
          <ButtonIcon icon={Loader} />
        ) : (
          <ButtonText>
            <Trans>Continue to payment</Trans>
          </ButtonText>
        )}
      </Button>

      <Text style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>
          You’ll be redirected to the payment provider. We never see your card
          details. By continuing you agree to Marque’s{' '}
          <InlineLinkText
            label={l`Terms of Service`}
            to="https://marque.at/terms"
            style={[a.font_semi_bold]}
            disableMismatchWarning>
            <Trans>Terms of Service</Trans>
          </InlineLinkText>{' '}
          and{' '}
          <InlineLinkText
            label={l`Privacy Policy`}
            to="https://marque.at/privacy"
            style={[a.font_semi_bold]}
            disableMismatchWarning>
            <Trans>Privacy Policy</Trans>
          </InlineLinkText>
          .
        </Trans>
      </Text>
    </>
  )
}

function SummaryRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
}) {
  const t = useTheme()
  return (
    <View style={[a.flex_row, a.justify_between, a.align_center]}>
      <Text
        style={[
          a.text_sm,
          muted && t.atoms.text_contrast_medium,
          bold && a.font_semi_bold,
        ]}>
        {label}
      </Text>
      <Text
        style={[
          a.text_sm,
          muted && t.atoms.text_contrast_medium,
          bold && a.font_semi_bold,
        ]}>
        {value}
      </Text>
    </View>
  )
}

function PollingPage({
  orderId,
  domain,
  checkoutUrl,
  onProvisioned,
  onBack,
}: {
  orderId: string
  domain: string | null
  checkoutUrl: string | null
  onProvisioned: (p: Provisioned) => void
  onBack: () => void
}) {
  const {t: l} = useLingui()
  const openUrl = useOpenUrl()
  const {data: order, isError, error} = useOrderPollingQuery(orderId)

  const item = useMemo(
    () =>
      domain ? order?.items.find(i => i.domain === domain) : order?.items[0],
    [order, domain],
  )
  const resolvedDomain = item?.domain ?? domain ?? ''
  const resolvedCheckoutUrl = checkoutUrl ?? order?.checkoutUrl ?? null

  useEffect(() => {
    if (order?.status === ORDER_ACTIVE && item?.status === ITEM_ACTIVE) {
      onProvisioned({
        domain: item.domain,
        nameServers: item.nameServers ?? [],
        registeredAt: item.registeredAt,
        expiresAt: item.expiresAt,
      })
    }
  }, [order, item, onProvisioned])

  const failed =
    order?.status === ORDER_FAILED || (item && item.status === 'failed')

  return (
    <View style={[a.flex_1, a.gap_md, a.justify_center, a.align_center]}>
      {!failed && (
        <>
          <Loader size="xl" />
          <Text style={[a.text_md, a.text_center, a.leading_snug]}>
            {order?.status === 'awaitingPayment' ? (
              <Trans>
                Complete your payment in the browser, then come back.
              </Trans>
            ) : (
              <Trans>Registering {resolvedDomain}…</Trans>
            )}
          </Text>
          {resolvedCheckoutUrl && (
            <Button
              label={l`Pay now`}
              variant="solid"
              color="primary"
              size="large"
              onPress={() => openUrl(resolvedCheckoutUrl)}>
              <ButtonText>
                <Trans>Pay now</Trans>
              </ButtonText>
            </Button>
          )}
          <Button
            label={l`Cancel`}
            variant="ghost"
            color="secondary"
            size="small"
            onPress={onBack}>
            <ButtonText>
              <Trans>Cancel</Trans>
            </ButtonText>
          </Button>
        </>
      )}
      {failed && (
        <>
          <Admonition type="error">
            {order?.error ||
              item?.error ||
              l`The order could not be completed.`}
          </Admonition>
          <Button
            label={l`Back`}
            variant="solid"
            color="primary"
            size="large"
            onPress={onBack}>
            <ButtonText>
              <Trans>Back</Trans>
            </ButtonText>
          </Button>
        </>
      )}
      {isError && <Admonition type="error">{cleanError(error)}</Admonition>}
    </View>
  )
}

function DonePage({
  provisioned,
  onReset,
}: {
  provisioned: Provisioned
  onReset: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {currentAccount} = useSession()
  const pdsClient = usePdsClient()
  const fetchDid = useFetchDid()
  const control = Dialog.useDialogContext()
  const [subdomain, setSubdomain] = useState('')
  const normalizedSubdomain = subdomain
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, '')
  const handle = normalizedSubdomain
    ? `${normalizedSubdomain}.${provisioned.domain}`
    : provisioned.domain
  const isSubdomainValid =
    !normalizedSubdomain ||
    (handle.length <= 253 &&
      normalizedSubdomain.split('.').every(label => {
        return (
          label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
        )
      }))

  const changeHandle = useUpdateHandleMutation({
    onSuccess: () => {
      control.close(() => onReset())
    },
  })
  const finalize = useFinalizeDomainPurchaseMutation({
    onSuccess: () => {
      prepareHandle.mutate(handle)
    },
  })

  const prepareHandle = useMutation({
    mutationKey: ['prepare-purchased-marque-handle', handle],
    mutationFn: async (nextHandle: string) => {
      if (!currentAccount?.did) throw new Error('Not authenticated')
      const result = await ensureMarqueAtprotoRecord(
        pdsClient,
        currentAccount.did,
        nextHandle,
      )
      if (result === 'conflict') throw new PurchasedHandleDnsConflictError()
      if (result === 'not-owned') throw new Error('Domain is not Marque-owned')

      // Wait out transient negative DNS caches before calling updateHandle.
      let lastError: unknown
      for (let attempt = 0; attempt < 12; attempt++) {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
        try {
          const did = await fetchDid(nextHandle)
          if (did !== currentAccount.did) throw new Error('DID mismatch')
          return nextHandle
        } catch (error) {
          lastError = error
        }
      }
      throw new PurchasedHandleDnsPendingError(lastError)
    },
    onSuccess(nextHandle) {
      changeHandle.mutate({handle: nextHandle})
    },
  })

  const onSetHandle = () => {
    if (!isSubdomainValid) return
    finalize.mutate({
      domain: provisioned.domain,
      nameServers: provisioned.nameServers,
      registeredAt: provisioned.registeredAt,
      expiresAt: provisioned.expiresAt,
    })
  }

  // Only offer step-up for the explicit handle-scope failure.
  const handleErrorMessage =
    changeHandle.error instanceof Error ? changeHandle.error.message : ''
  const needsScopeUpgrade =
    changeHandle.isError &&
    currentAccount?.isOauthSession &&
    handleErrorMessage.includes('identity:handle')

  if (needsScopeUpgrade) {
    return (
      <HandleScopeUpgrade
        onError={() => {
          changeHandle.reset()
        }}
      />
    )
  }

  return (
    <View style={[a.flex_1, a.gap_md, a.justify_center, a.align_center]}>
      <View
        style={[
          {height: 40, width: 40},
          a.rounded_full,
          a.align_center,
          a.justify_center,
          {backgroundColor: t.palette.positive_500},
        ]}>
        <CheckIcon fill={t.palette.white} size="md" />
      </View>
      <Text style={[a.text_lg, a.font_bold, a.text_center]}>
        <Trans>{provisioned.domain} is registered!</Trans>
      </Text>
      <Text style={[a.text_md, a.text_center, a.leading_snug]}>
        <Trans>
          Choose the root domain or add a subdomain, then we’ll publish its AT
          Protocol DNS record and wait for it to resolve.
        </Trans>
      </Text>

      <View style={[a.w_full]}>
        <TextField.LabelText>
          <Trans>Subdomain (optional)</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={!isSubdomainValid}>
          <TextField.Icon icon={GlobeIcon} />
          <Dialog.Input
            label={l`Subdomain`}
            placeholder={l`Leave blank for the root domain`}
            defaultValue={subdomain}
            onChangeText={value => {
              setSubdomain(value)
              prepareHandle.reset()
              changeHandle.reset()
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField.SuffixText
            label={`.${provisioned.domain}`}
            style={[{maxWidth: '45%'}]}>
            .{provisioned.domain}
          </TextField.SuffixText>
        </TextField.Root>
        <Text style={[a.mt_sm, a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>
            Your handle will be{' '}
            <Text style={[a.font_semi_bold]}>@{handle}</Text>
          </Trans>
        </Text>
      </View>

      {(finalize.isError || prepareHandle.isError || changeHandle.isError) && (
        <Admonition type="error">
          {prepareHandle.error instanceof PurchasedHandleDnsPendingError ? (
            <Trans>
              The DNS record was created, but public resolvers can’t see it yet.
              Wait a few minutes, then try again.
            </Trans>
          ) : prepareHandle.error instanceof PurchasedHandleDnsConflictError ? (
            <Trans>
              This handle already has an AT Protocol DNS record for a different
              account.
            </Trans>
          ) : (
            cleanError(
              finalize.error ?? prepareHandle.error ?? changeHandle.error,
            )
          )}
        </Admonition>
      )}

      <Button
        label={l`Set as my handle`}
        variant="solid"
        size="large"
        color="primary"
        disabled={
          !isSubdomainValid ||
          finalize.isPending ||
          prepareHandle.isPending ||
          changeHandle.isPending
        }
        onPress={onSetHandle}
        style={[a.w_full]}>
        {finalize.isPending ||
        prepareHandle.isPending ||
        changeHandle.isPending ? (
          <ButtonIcon icon={Loader} />
        ) : (
          <ButtonText>
            <Trans>Set as my handle</Trans>
          </ButtonText>
        )}
      </Button>

      <Button
        label={l`Not now`}
        variant="ghost"
        color="secondary"
        size="large"
        onPress={onReset}>
        <ButtonText>
          <Trans>Not now</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

class PurchasedHandleDnsConflictError extends Error {
  constructor() {
    super('Conflicting AT Protocol DNS record')
    this.name = 'PurchasedHandleDnsConflictError'
  }
}

class PurchasedHandleDnsPendingError extends Error {
  constructor(cause: unknown) {
    super('AT Protocol DNS record has not propagated', {cause})
    this.name = 'PurchasedHandleDnsPendingError'
  }
}

function HandleScopeUpgrade({onError}: {onError: () => void}) {
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [redirectError, setRedirectError] = useState<string | undefined>(
    undefined,
  )

  const onUpgrade = async () => {
    if (!currentAccount?.did) return
    setRedirectError(undefined)
    setIsRedirecting(true)
    try {
      await oauthUpgradeForHandle(
        currentAccount.did,
        IS_WEB && typeof window !== 'undefined'
          ? window.location.href
          : undefined,
      )
    } catch {
      setIsRedirecting(false)
      setRedirectError(
        l`Your server does not support changing your handle from this app.`,
      )
    }
  }

  return (
    <View style={[a.gap_md]}>
      {redirectError ? (
        <Admonition type="error">{redirectError}</Admonition>
      ) : (
        <Admonition type="warning">
          <Trans>
            Your session needs an extra permission to change your handle.
          </Trans>
        </Admonition>
      )}
      <Text style={[a.text_md, a.leading_snug]}>
        <Trans>
          You’ll be sent to your server to approve the permission, then brought
          back here to try again.
        </Trans>
      </Text>
      <Button
        label={l`Continue`}
        variant="solid"
        color="primary"
        size="large"
        disabled={isRedirecting}
        onPress={() => void onUpgrade()}>
        {isRedirecting ? (
          <ButtonIcon icon={Loader} />
        ) : (
          <ButtonText>
            <Trans>Continue</Trans>
          </ButtonText>
        )}
      </Button>
      <Button
        label={l`Cancel`}
        variant="ghost"
        color="secondary"
        size="large"
        onPress={onError}>
        <ButtonText>
          <Trans>Cancel</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

function TextFieldRow({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
  autoCapitalize?: 'none' | 'characters' | 'sentences' | 'words'
}) {
  const {t: l} = useLingui()
  return (
    <View>
      <TextField.LabelText>{label}</TextField.LabelText>
      <TextField.Root>
        <Dialog.Input
          label={label}
          placeholder={placeholder ?? l`Required`}
          defaultValue={value}
          onChangeText={onChange}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'words'}
        />
      </TextField.Root>
    </View>
  )
}
