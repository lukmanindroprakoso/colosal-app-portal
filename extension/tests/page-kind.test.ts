import { describe, expect, it } from "vitest"
import { pageKind } from "../lib/page-kind"

describe("pageKind", () => {
  it("detects a freelancer profile page", () => {
    expect(pageKind("https://www.upwork.com/freelancers/~01b607f6de6b5d4785")).toBe("profile")
    expect(pageKind("https://www.upwork.com/freelancers/~01b607f6de6b5d4785?mp_source=share")).toBe("profile")
  })

  it("detects job detail pages in every URL shape seen on Upwork", () => {
    expect(
      pageKind(
        "https://www.upwork.com/jobs/~022109535876375922640?referrer_url_path=%2Fnx%2Fsearch%2Fjobs%2Fdetails%2F~022109535876375922640"
      )
    ).toBe("job")
    expect(
      pageKind("https://www.upwork.com/freelance-jobs/apply/Senior-Full-Stack-Software-Developer-Remote_~022109535876375922640/")
    ).toBe("job")
    expect(pageKind("https://www.upwork.com/nx/search/jobs/details/~022109535876375922640")).toBe("job")
  })

  it("treats other Upwork pages as other-upwork", () => {
    expect(pageKind("https://www.upwork.com/nx/find-work/")).toBe("other-upwork")
    expect(pageKind("https://www.upwork.com/nx/search/jobs/?q=react")).toBe("other-upwork")
    expect(pageKind("https://www.upwork.com/freelancers/")).toBe("other-upwork")
  })

  it("treats everything outside upwork.com as outside", () => {
    expect(pageKind(undefined)).toBe("outside")
    expect(pageKind("chrome://newtab/")).toBe("outside")
    expect(pageKind("https://example.com/jobs/~022109535876375922640")).toBe("outside")
    expect(pageKind("https://upwork.com.evil.example/jobs/~022109535876375922640")).toBe("outside")
    expect(pageKind("http://www.upwork.com/jobs/~022109535876375922640")).toBe("outside")
    expect(pageKind("not a url")).toBe("outside")
  })
})
