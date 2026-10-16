/** Runtime schemas for Marque's third-party partner lexicons. */
import {l} from '@atproto/lex'

const listPricingNsid = 'at.marque.partner.listPricing'

export const listPricingParams = l.params()

export const listPricingOutput = l.jsonPayload({
  tlds: l.array(
    l.object({
      tld: l.string(),
      registerPrice: l.integer(),
      renewPrice: l.integer(),
      transferPrice: l.integer(),
      popular: l.optional(l.boolean()),
      transferAddsYear: l.optional(l.boolean()),
      whoisPrivacyAllowed: l.optional(l.boolean()),
      minPeriod: l.optional(l.integer()),
      maxPeriod: l.optional(l.integer()),
    }),
  ),
})

/** List offered TLDs and standard pricing. */
export const listPricing = l.query(
  listPricingNsid,
  listPricingParams,
  listPricingOutput,
)

const checkAvailabilityNsid = 'at.marque.partner.checkAvailability'

export const checkAvailabilityParams = l.params({
  domains: l.array(l.string(), {minLength: 1, maxLength: 500}),
})

export const checkAvailabilityOutput = l.jsonPayload({
  results: l.array(
    l.object({
      domain: l.string(),
      available: l.optional(l.boolean()),
      status: l.optional(
        l.string({knownValues: ['free', 'premium', 'active']}),
      ),
      price: l.optional(l.integer()),
      renewPrice: l.optional(l.integer()),
      transferPrice: l.optional(l.integer()),
      premiumPrice: l.optional(l.integer()),
      isPremium: l.optional(l.boolean()),
      transferAddsYear: l.optional(l.boolean()),
      minPeriod: l.optional(l.integer()),
      maxPeriod: l.optional(l.integer()),
      whoisPrivacyAllowed: l.optional(l.boolean()),
      error: l.optional(l.string()),
    }),
  ),
})

/** Check up to 500 domains with live premium pricing. */
export const checkAvailability = l.query(
  checkAvailabilityNsid,
  checkAvailabilityParams,
  checkAvailabilityOutput,
)

const requirementSpec = l.object({
  name: l.string(),
  description: l.string(),
  required: l.boolean(),
  type: l.string(),
  pattern: l.optional(l.string()),
  syntax: l.optional(l.string()),
  options: l.optional(
    l.array(
      l.object({
        description: l.string(),
        value: l.string(),
        requires: l.optional(l.array(l.string())),
      }),
    ),
  ),
})

export const getRequirements = l.query(
  'at.marque.partner.getRequirements',
  l.params({domains: l.array(l.string(), {minLength: 1, maxLength: 50})}),
  l.jsonPayload({
    results: l.array(
      l.object({
        domain: l.string(),
        passportNumberRequired: l.boolean(),
        companyRegistrationNumberRequired: l.boolean(),
        taxNumberRequired: l.boolean(),
        additionalData: l.array(requirementSpec),
        customerAdditionalData: l.array(requirementSpec),
      }),
    ),
  }),
)

const createCheckoutNsid = 'at.marque.partner.createCheckout'

export const createCheckoutInput = l.jsonPayload({
  items: l.array(
    l.object({
      domain: l.string(),
      years: l.optional(l.integer()),
      whoisPrivacy: l.optional(l.boolean()),
      autoRenew: l.optional(l.boolean()),
    }),
    {minLength: 1, maxLength: 50},
  ),
  registrant: l.object({
    firstName: l.string(),
    lastName: l.string(),
    email: l.string(),
    phoneCountryCode: l.string(),
    phoneSubscriber: l.string(),
    street: l.string(),
    city: l.string(),
    zipcode: l.string(),
    country: l.string(),
    state: l.optional(l.string()),
    organization: l.optional(l.string()),
    phoneAreaCode: l.optional(l.string()),
    taxIdType: l.optional(l.string()),
    taxIdValue: l.optional(l.string()),
    companyRegistrationNumber: l.optional(l.string()),
    passportNumber: l.optional(l.string()),
    socialSecurityNumber: l.optional(l.string()),
  }),
  paymentMethod: l.optional(
    l.string({knownValues: ['stripe', 'paypal', 'nowpayments']}),
  ),
  successUrl: l.string(),
  cancelUrl: l.string(),
})

export const createCheckoutOutput = l.jsonPayload({
  orderId: l.string(),
  checkoutUrl: l.string(),
  subtotalCents: l.integer(),
  taxCents: l.optional(l.integer()),
  totalCents: l.integer(),
  currency: l.string(),
  paymentMethod: l.optional(l.string()),
})

/** Validate an order and create a hosted payment checkout. */
export const createCheckout = l.procedure(
  createCheckoutNsid,
  l.params(),
  createCheckoutInput,
  createCheckoutOutput,
  [
    'Unavailable',
    'InvalidRegistrant',
    'InvalidCallback',
    'InvalidPaymentMethod',
    'PaymentAmountTooLow',
    'PaymentProviderError',
  ],
)

const getOrderNsid = 'at.marque.partner.getOrder'

export const getOrderParams = l.params({
  orderId: l.string(),
})

export const getOrderOutput = l.jsonPayload({
  orderId: l.string(),
  status: l.string({
    knownValues: [
      'awaitingPayment',
      'processing',
      'paid',
      'provisioning',
      'provisioned',
      'failed',
    ],
  }),
  paidAt: l.optional(l.string({format: 'datetime'})),
  checkoutUrl: l.optional(l.string({format: 'uri'})),
  error: l.optional(l.string()),
  items: l.array(
    l.object({
      domain: l.string(),
      status: l.string({knownValues: ['active', 'failed']}),
      registeredAt: l.optional(l.string({format: 'datetime'})),
      expiresAt: l.optional(l.string({format: 'datetime'})),
      nameServers: l.optional(l.array(l.string())),
      error: l.optional(l.string()),
    }),
  ),
})

/** Poll payment and provisioning status. */
export const getOrder = l.query(getOrderNsid, getOrderParams, getOrderOutput)
