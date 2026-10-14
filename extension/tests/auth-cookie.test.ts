import { describe, expect, it } from "vitest"
import { isAuthCookieFor } from "../lib/auth-cookie"

describe("isAuthCookieFor", () => {
  it("matches the Supabase auth cookie, including chunked ones", () => {
    expect(isAuthCookieFor({ name: "sb-jgnaaxrlepednwihigkp-auth-token", domain: "localhost" }, "localhost")).toBe(true)
    expect(isAuthCookieFor({ name: "sb-jgnaaxrlepednwihigkp-auth-token.0", domain: "localhost" }, "localhost")).toBe(true)
    expect(isAuthCookieFor({ name: "sb-jgnaaxrlepednwihigkp-auth-token.1", domain: "localhost" }, "localhost")).toBe(true)
  })

  it("matches host-only and parent-domain cookies of the Colosal host", () => {
    expect(isAuthCookieFor({ name: "sb-abc-auth-token", domain: "app.colosal.xyz" }, "app.colosal.xyz")).toBe(true)
    expect(isAuthCookieFor({ name: "sb-abc-auth-token", domain: ".colosal.xyz" }, "app.colosal.xyz")).toBe(true)
  })

  it("ignores other cookies and other sites", () => {
    expect(isAuthCookieFor({ name: "sb-abc-auth-token-code-verifier", domain: "localhost" }, "localhost")).toBe(false)
    expect(isAuthCookieFor({ name: "theme", domain: "localhost" }, "localhost")).toBe(false)
    expect(isAuthCookieFor({ name: "sb-abc-auth-token", domain: ".upwork.com" }, "app.colosal.xyz")).toBe(false)
    expect(isAuthCookieFor({ name: "sb-abc-auth-token", domain: "evilcolosal.xyz" }, "app.colosal.xyz")).toBe(false)
  })
})
