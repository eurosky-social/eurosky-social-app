# Upstream sync runbook

This document describes how to merge the upstream-synced `main` branch into the
Eurosky/mu fork. It is a conflict-resolution runbook, not a general Git guide.

## Branch model

- `main` tracks the upstream Bluesky application and should remain free of fork
  changes.
- `eurosky/fork` is the integration branch for Eurosky/mu changes.
- Upstream syncs are prepared on a short-lived branch created from
  `eurosky/fork`, then merged through a PR.
- Use a merge commit. Do not rebase the shared fork branch onto `main`.

## 1. Prepare the branches

Start with a clean working tree. Update both local branches from `origin`, then
create a sync branch:

```bash
git status --short
git fetch origin

git switch main
git merge --ff-only origin/main

git switch eurosky/fork
git merge --ff-only origin/eurosky/fork

git switch -c <name>/sync-upstream-YYYY-MM-DD
```

Confirm the expected divergence before merging:

```bash
git rev-list --left-right --count HEAD...main
git log --oneline --decorate -5 main
```

## 2. Start the merge

```bash
git merge main
```

In this workflow, `HEAD`/`ours` is the fork and `main`/`theirs` is upstream.
That distinction only applies to this merge direction.

List unresolved files:

```bash
git diff --name-only --diff-filter=U
```

## 3. Resolve source conflicts first

Resolve normal source files before generated catalogs or the lockfile. For each
conflict:

1. Read the base, fork, and upstream versions rather than selecting a side from
   the conflict markers alone.
2. Preserve intentional fork behavior.
3. Port upstream API changes, bug fixes, analytics, moderation behavior, and
   accessibility changes into the fork implementation.
4. Remove conflict markers and stage the resolved file.

Useful commands:

```bash
git diff --cc -- path/to/file
git show :1:path/to/file # merge base
git show :2:path/to/file # fork / ours
git show :3:path/to/file # main / theirs
git add path/to/file
```

### Known high-risk areas

These areas intentionally diverge and should receive semantic review instead of
an automatic `ours` or `theirs` resolution:

- Post thread and reader view
- Web OAuth sign-in versus native password sign-in
- mu age assurance and the no-access screen
- Branding, logos, splash screens, and logged-out navigation
- Custom settings, routes, pets, and profile decorations
- Fork-owned links, hosts, app identifiers, and services

When upstream changes adjacent files without producing a conflict, review those
auto-merges as well. Type checking is particularly useful for detecting API
changes that Git merged textually but incorrectly.

## 4. Resolve `package.json` and the lockfile

Treat `pnpm-lock.yaml` as generated output. Do not hand-merge its conflict
markers.

1. Resolve `package.json`, preserving fork-only scripts and dependencies while
   accepting compatible upstream upgrades.
2. Validate the JSON.
3. Take upstream's lockfile as the regeneration base.
4. Regenerate it from the resolved manifests.

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json'))"
git checkout --theirs -- pnpm-lock.yaml
corepack pnpm install --lockfile-only --ignore-scripts
git add package.json pnpm-lock.yaml
```

Review dependency version changes before continuing. If the merge changes the
required pnpm version, use the version declared by `packageManager` through
Corepack.

## 5. Resync language catalogs

The catalog workflow is documented in more detail in
[localization.md](./localization.md#fork-merging-upstream--adding-strings).

Never hand-merge a `.po` conflict. After all translatable source conflicts have
been resolved, run:

```bash
pnpm intl:resync
```

The command takes upstream's version of conflicted catalogs, re-extracts
messages from the merged source, recompiles the runtime catalogs, and stages the
result. Review the generated changes before committing.

## 6. Check generated branding

```bash
pnpm brand:check
```

If the check reports stale generated assets, regenerate them with:

```bash
pnpm brand
```

Review and stage the generated files.

## 7. Verify the merge

Confirm that no unresolved paths or conflict markers remain:

```bash
git diff --name-only --diff-filter=U
rg -n '^<<<<<<<|^=======|^>>>>>>>' --glob '!node_modules/**'
git status --short
```

Run the project checks:

```bash
pnpm lint
pnpm typecheck
pnpm prettier
pnpm test
pnpm brand:check
```

Service-specific tests use their own runtimes and commands. In particular,
Deno service tests should not be run through the app's Jest configuration.

Review the staged result relative to both parents, paying special attention to
the known high-risk areas:

```bash
git diff --cached --stat
git diff --cached -- path/to/high-risk-file
```

## 8. Commit and open the PR

Let the pre-commit hooks run; do not bypass them:

```bash
git commit
```

The result should be a merge commit whose first parent is the fork and whose
second parent is `main`:

```bash
git show -s --format='%H%n%P%n%s' HEAD
git status --short --branch
```

Push the sync branch and open a PR into `eurosky/fork`. In the PR description,
include:

- The merged `main` commit
- Important semantic conflict resolutions
- Fork behavior deliberately preserved
- Validation commands and results
- Any upstream behavior intentionally deferred
