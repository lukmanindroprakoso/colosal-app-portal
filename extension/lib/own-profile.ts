const norm = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()

// Heuristic: the freelancer's own profile page contains their API headline, someone else's does not.
// true/false = looks like / does not look like the connected account's profile; null = cannot tell.
// Only the start of the headline is compared, since pages may truncate or reflow long titles.
export function looksLikeOwnProfile(pageText: string, headline: string | null | undefined): boolean | null {
  if (!headline) return null
  const head = norm(headline).slice(0, 40)
  if (head.length < 8) return null
  return norm(pageText).includes(head)
}
