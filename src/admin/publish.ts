// "Publish now or later?" for changes to a live tarana. The public site is static and only
// rebuilds when asked; otherwise the change waits for Dashboard → Publish site.

/** Returns '?publish=now' when the admin chooses to update the live site immediately. */
export function askPublish(live: boolean, what: string): string {
  if (!live) return '';
  return confirm(`${what}\n\nThis tarana is live. Update the public site now?\n\nOK: publish now (about 2 minutes)\nCancel: later, with Dashboard → Publish site`)
    ? '?publish=now' : '';
}

/** Toast text for a save result that may carry a site status. */
export function siteNote(base: string, r: { site?: string; note?: string } | undefined): [string, 'ok' | 'err'] {
  if (r?.site === 'rebuilding') return [`${base}. The live site updates in about 2 minutes.`, 'ok'];
  if (r?.site === 'pending') return [`${base}. Goes live when you press Publish site on the dashboard.`, 'ok'];
  if (r?.site === 'not-connected') return [`${base}, but the site could not be rebuilt: ${r.note || 'GitHub is not connected'}`, 'err'];
  return [base, 'ok'];
}
