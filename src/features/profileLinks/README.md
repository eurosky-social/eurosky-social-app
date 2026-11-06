# Profile links and legacy websites

The fork uses Bluesky's `app.bsky.actor.link` records and the profile's ordered
`links` refs. The former standalone `website` UI has been removed. Links are
available independently of the upstream rollout flag; age restrictions on
adding/editing native links still apply.

## Compatibility and migration

- Display and edit a legacy `profile.website` in the same Links row as native
  links, appended unless the owner reorders it.
- Deduplicate against all known native destinations, before moderation filtering,
  so a hidden native link cannot reappear as an unmoderated compatibility entry.
- Read the owner's website and refs directly from their repo, not the potentially
  delayed AppView. Keep all original refs, including records the editor parser
  omits, to avoid deleting invisible links when saving another field.
- Viewing a profile or opening/canceling Edit Profile never migrates it.
- The header keeps the same pill component, geometry and canonical URL key while
  owner edit records load. Repo arrival preserves the displayed order and reuses
  the same favicon URL for unchanged records; legacy/native duplicates share a
  slot. Editing resolves the record by identity, not by its displayed index.
  Explicit local saves can update the order immediately, and that override is
  retained through refetches of the unchanged repo state.
- On the next actual profile or inline link save, create a native record and
  clear `website` in the same profile update. Existing native metadata wins when
  the website is already represented. Migration itself does not dirty the editor.
- An untouched incompatible, Safelink-blocked or overflowing website remains in
  the old field. Never upgrade HTTP automatically or drop an eleventh link. The
  owner can repair or remove it from Links. Restricted accounts may remove the
  compatibility entry, but cannot create/edit native links or auto-migrate it.
- Optional migration preparation failures do not prevent an unrelated profile
  edit. If links change after preparation or during a CAS retry, the callback
  skips optional migration and preserves the latest link fields while saving the
  ordinary profile fields. Explicit link edits still reject conflicts.
- The editor checks otherwise-migratable legacy destinations with Safelink and
  shows a specific warning when blocked. Saving shares that short-lived result.

The editor freezes its repo snapshot on the first link interaction (form open,
drag or edit), rather than copying query state in an effect. Saves check the
current website and ordered refs before writing records and again inside the
profile's CAS update, refusing to overwrite concurrent link edits. The dialog
can reload links after a conflict, explicitly discarding only link drafts while
keeping other unsaved profile fields.

`write.ts` journals acknowledged record writes independently of the frozen
snapshot. On retry, it verifies the staged CID is still current, reuses identical
writes, and uses that CID for further edits or undo. It never accepts a different
client's CID. All sibling writes settle before a failed attempt returns, so a
retry cannot race the previous attempt. New records use valid TID keys; both the
draft-key map and confirmed-write journal clear after commit.

Failed profile writes or skipped migrations can leave unreferenced records, as
with the upstream save implementation. Only applied, committed link changes
update the owner cache or run removed-record cleanup. Empty ordinary profile
fields are normalized to undefined on both save paths. The shared profile
mutation checks ordinary fields/images for callback updates via `commitFields`,
without waiting for link refs that the AppView may filter.

## Analytics and latency

Link metrics describe the unified UI, including compatibility entries, rather
than native-record counts. Opening the section counts as an editor open even
when an account can only remove its old website. Explicitly removing that entry
counts as a link removal. Storage-only migration of the same destination does
not count as an add/remove. Existing event schemas are unchanged.

While an account still has a website, a profile save may perform a cached
Safelink lookup, a repo read and a staged record write. This is the deliberate
cost of migration on the next save; no migration writes happen merely on view.

## Tests

```sh
pnpm test --runInBand src/features/profileLinks src/state/queries/profile-commit.test.ts
```

`legacy.test.ts` covers display, deduplication, compatibility, capacity, explicit
repair/removal and conflict detection. `state.test.tsx` exercises repo reads and
both save paths, including partial failures, draft-key lifecycle, shared Safelink
feedback and restricted account removal. `profileSave.test.ts` covers empty-field
normalization, post-preparation conflicts and CAS retries for optional versus
explicit link edits. `write.test.ts` enforces CID preconditions and exercises
profile-write failures, partially failed sibling writes, edits/undo between
retries and genuine concurrent changes. `header.test.ts` covers stable loading
order, duplicate handoff, favicon reuse and explicit-save order changes. `profile-commit.test.ts` covers the
shared field/image readiness check.
