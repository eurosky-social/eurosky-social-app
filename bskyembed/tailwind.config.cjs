const brand = require('../src/config/brand.json')

const accent = brand.colors.accents[brand.colors.defaultAccent]
const neutral = brand.colors.neutral
const subdued = {
  ...neutral,
  ...brand.colors.neutralSubduedOverrides,
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['variant', ['&:is(.dark *):not(:is(.dark .light *))']],
  theme: {
    extend: {
      colors: {
        brand: accent.primary_500,
        brandHover: accent.primary_25,
        brandHoverDark: accent.primary_975,
        brandLighten: accent.primary_400,
        textLight: neutral.contrast_700,
        textDimmed: neutral.contrast_300,
        textNeutral: neutral.contrast_500,
        dimmedBgLighten: subdued.contrast_900,
        dimmedBg: subdued.contrast_950,
        dimmedBgDarken: subdued.contrast_975,
      },
    },
  },
  plugins: [],
}
