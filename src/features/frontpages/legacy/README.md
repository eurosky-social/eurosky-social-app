# Original newsroom adapter

With `NEWS_V2_ENABLED` off, `NewsroomScreen.tsx` resolves publications from
`publishers.ts` and renders the same `../PublicationScreen.tsx` editorial detail
page as news v2. The publisher switcher stays above the selected masthead.

The original registry, post link chip, reporter conversation and contextual rail
remain here. The superseded RSS detail renderer, masthead and their private
queries were removed; shared news RSS, explore and article functionality remains.
See [the frontpages README](../README.md) for routes and the shared renderer.
