/**
 * Whether every viewer gets **Edit front page** on any publication, for
 * demos. Others still only get a local draft: publishing stays limited to
 * the publication owner. Opt-in per build with
 * EXPO_PUBLIC_ENABLE_FRONTPAGE_DEMO_EDIT=true; otherwise only the signed-in
 * owner sees the edit button.
 */
export const FRONTPAGE_DEMO_EDIT =
  process.env.EXPO_PUBLIC_ENABLE_FRONTPAGE_DEMO_EDIT === 'true'
