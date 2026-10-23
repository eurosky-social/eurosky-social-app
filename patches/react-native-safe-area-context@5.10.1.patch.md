## react-native-safe-area-context Patch

### Web: bound provider-relative insets to the window safe area

Version 5.10.1 measures the provider's viewport-relative bounding rectangle
and subtracts its position from the CSS `env(safe-area-inset-*)` values. A
provider can extend past the viewport, especially when the whole page scrolls.
Without an upper bound, a negative `rect.top` becomes extra top inset.

On iOS Safari, showing or hiding the browser toolbar triggers a resize while
the page is scrolled. At a scroll offset of 4,500px, the provider reports a
4,500px top inset even when the CSS safe-area inset is zero. `Layout.Screen`
and the fixed Home header then apply that as padding, making the feed jump
or disappear into a blank page.

Clamp each provider-relative inset to `[0, windowInsets[edge]]`. Providers
inside the viewport still receive reduced insets; providers extending beyond
it cannot turn scrolling or overflow into extra padding. Provider frame
coordinates and native implementations are unchanged.

Patch source, ESM and CommonJS entries so Metro and other consumers agree.
Regression coverage: `__tests__/lib/web-safe-area.test.tsx` exercises the
actual web provider through window resize and ResizeObserver callbacks.

**TODO: Remove when upstream bounds web provider insets to the window safe area.**
