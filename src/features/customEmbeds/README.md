# Custom embeds

Compile-time extensions of external link embeds (`app.bsky.embed.external`).
The host integration uses the portable contracts from
`@social-app-community/embed-kit`; app-specific record access, ALF components,
navigation, and translations stay in this directory as host adapters.

The ordered registry in `registry.ts` contains both app-owned handlers and
handlers created by community packages. A failed or malformed matcher is
isolated by embed-kit, and an unmatched embed continues through the upstream
Standard Site, chat-invite, or generic external-card paths.

## Local community-package development

The sibling `social-app-community-packages` repository is included in this
app's pnpm workspace. UI packages are injected rather than symlinked so Metro
and Webpack resolve React, React Native, and TanStack Query from this app. Metro
also conditionally watches the sibling repository for workspace links. This
avoids duplicate React instances while still testing the package's built
publishable output.

After changing the sibling packages, rebuild and reinject them:

```sh
pnpm -C ../social-app-community-packages check
pnpm install --ignore-scripts
```

The first command builds each package's `dist` directory. The second command,
run from `eurosky-social-app`, refreshes the injected copies in `node_modules`.
Once the packages are published, replace the `workspace:*` dependency ranges
with released versions and remove the sibling package globs and
`dependenciesMeta` injection settings.

## Integration points

- Post embeds: `src/components/Post/Embed/index.tsx` calls
  `matchCustomEmbed(view)` at the top of the external-link path.
- Composer: `src/view/com/composer/ExternalEmbed.tsx` calls
  `matchCustomEmbedPreview(view)` before the normal preview renderers.
- Host adapters: each packaged handler is configured in its feature directory.

## Handlers

### atmoRsvp

An app-owned handler for [atmo.rsvp](https://atmo.rsvp) events
(`community.lexicon.calendar.event`) with in-app RSVP controls. It implements
the embed-kit handler contract directly.

### tangledString

`@social-app-community/embed-tangled-string` owns Tangled URL/associated-record
matching, trust-boundary validation, querying, card layout, and composer
preview. The files under `tangledString/` supply Eurosky's PDS record reader,
ALF components and theme, syntax-highlighted `CodeBlock`, profile byline, links,
and Lingui strings; `index.ts` only assembles those adapters into the handler.
