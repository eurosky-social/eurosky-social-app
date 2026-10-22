const path = require('node:path')

const root = path.resolve(__dirname, '..')

/** Missing translations may fall back to English, but never to a raw ID. */
function assertMessages(locale, messages, ids) {
  for (const id of ids) {
    const message = messages[id]
    if (
      !Array.isArray(message) ||
      !message.length ||
      (message.length === 1 && message[0] === id)
    ) {
      throw new Error(
        `Missing or uncompiled release translation: ${locale}/${id}`,
      )
    }
  }
}

function checkReleaseI18n() {
  const {locales} = require('../lingui.config.ts').default
  const {messages: english} = require('../src/locale/locales/en/messages.ts')
  // Every locale must include all source messages, even if still untranslated.
  const ids = new Set(Object.keys(english))
  for (const locale of locales) {
    const {messages} = require(
      path.join(root, 'src/locale/locales', locale, 'messages.ts'),
    )
    assertMessages(locale, messages, ids)
  }
  console.log(
    `Release translations verified: ${ids.size} messages in ${locales.length} locales.`,
  )
}

module.exports = {assertMessages, checkReleaseI18n}

if (require.main === module) checkReleaseI18n()
