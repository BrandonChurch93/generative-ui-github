/**
 * A machine account. GitHub Apps end in `[bot]`; many projects also run plain user accounts for automation
 * (`nextjs-bot`, `vercel-release-bot`) that GitHub reports as people, so a `-bot` or `_bot` suffix counts too.
 */
export function isBotLogin(login: string): boolean {
  return /(\[bot\]|[-_]bot)$/i.test(login)
}
