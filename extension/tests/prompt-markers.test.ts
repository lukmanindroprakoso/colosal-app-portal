import { describe, expect, it } from "vitest"
import { splitPrompts } from "../lib/prompt-markers"

describe("splitPrompts", () => {
  it("splits plain text and [prompt] sections, keeping the markers in the section", () => {
    expect(splitPrompts("Hi,\n[prompt]Open line[/prompt] bye")).toEqual([
      { text: "Hi,\n", prompt: false },
      { text: "[prompt]Open line[/prompt]", prompt: true },
      { text: " bye", prompt: false },
    ])
  })

  it("handles several sections and multi-line prompts", () => {
    const parts = splitPrompts("[prompt]a\nb[/prompt]x[prompt]c[/prompt]")
    expect(parts.map((p) => p.prompt)).toEqual([true, false, true])
    expect(parts[0]!.text).toBe("[prompt]a\nb[/prompt]")
  })

  it("treats an unclosed marker as plain text", () => {
    expect(splitPrompts("Hello [prompt]never closed")).toEqual([{ text: "Hello [prompt]never closed", prompt: false }])
  })

  it("returns nothing for empty text and one plain part when there are no markers", () => {
    expect(splitPrompts("")).toEqual([])
    expect(splitPrompts("Just text")).toEqual([{ text: "Just text", prompt: false }])
  })
})
