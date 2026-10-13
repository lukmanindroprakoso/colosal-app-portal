// Splits a cover letter template into plain text and [prompt]...[/prompt] sections (markers kept),
// so the preview can highlight what the AI fills in. An unclosed [prompt] stays plain text.
export function splitPrompts(text: string): { text: string; prompt: boolean }[] {
  const parts: { text: string; prompt: boolean }[] = []
  const re = /\[prompt\][\s\S]*?\[\/prompt\]/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), prompt: false })
    parts.push({ text: m[0], prompt: true })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), prompt: false })
  return parts
}
