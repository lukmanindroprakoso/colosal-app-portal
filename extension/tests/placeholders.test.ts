import { describe, expect, it } from "vitest"
import { hasPlaceholders } from "../lib/placeholders"

describe("hasPlaceholders", () => {
  it("detects [add: ...] placeholders in any of the given texts", () => {
    expect(hasPlaceholders(["Delivered [add: number of projects] apps"])).toBe(true)
    expect(hasPlaceholders(["fine", "also [ADD: result]"])).toBe(true)
  })

  it("ignores text without placeholders, including other brackets", () => {
    expect(hasPlaceholders(["Plain text", "[prompt]x[/prompt]", "array[0]"])).toBe(false)
    expect(hasPlaceholders([])).toBe(false)
  })
})
