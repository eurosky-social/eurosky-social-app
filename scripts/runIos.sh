#!/usr/bin/env bash
set -o errexit
set -o nounset
set -o pipefail

configuration=""
expect_configuration=false

for arg in "$@"; do
  if [[ "$expect_configuration" == true ]]; then
    configuration="$arg"
    expect_configuration=false
    continue
  fi

  case "$arg" in
    --configuration)
      expect_configuration=true
      ;;
    --configuration=*)
      configuration="${arg#--configuration=}"
      ;;
  esac
done

case "$configuration" in
  Release | release)
    # Lingui removes source messages from production bundles, so release builds
    # must refresh the catalogs or new strings render as generated IDs.
    catalog_backup="$(mktemp -d)"
    for catalog in src/locale/locales/*/messages.po; do
      locale="$(basename "$(dirname "$catalog")")"
      mkdir -p "$catalog_backup/$locale"
      cp "$catalog" "$catalog_backup/$locale/messages.po"
    done

    restore_catalogs() {
      trap - EXIT
      for catalog in "$catalog_backup"/*/messages.po; do
        locale="$(basename "$(dirname "$catalog")")"
        cp "$catalog" "src/locale/locales/$locale/messages.po"
      done
      rm -rf "$catalog_backup"
    }

    # Extraction updates the tracked PO files. Restore their exact prior state
    # after compiling while retaining the ignored generated TypeScript catalogs.
    trap restore_catalogs EXIT
    pnpm intl:build
    restore_catalogs
    ;;
esac

exec expo run:ios "$@"
