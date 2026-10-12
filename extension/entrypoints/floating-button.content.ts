import { FAB_ICON } from "../lib/fab-icon"

const POS_KEY = "fabPosition"
const SIZE = 44
const MARGIN = 4

type Pos = { right: number; bottom: number }

// Floating launcher on Upwork pages: click opens the side panel, drag moves the button.
// ponytail: plain DOM in a shadow root (no React); position is remembered per browser, not per site.
export default defineContentScript({
  matches: ["https://*.upwork.com/*"],
  async main() {
    if (window.top !== window) return

    const host = document.createElement("div")
    host.id = "colosal-fab-host"
    const root = host.attachShadow({ mode: "open" })
    root.innerHTML = `
      <style>
        .fab { position: fixed; z-index: 2147483647; width: ${SIZE}px; height: ${SIZE}px; border-radius: 999px;
          border: 0; padding: 0; display: grid; place-items: center; color: #fff; background: #1e6df6;
          box-shadow: 0 4px 14px rgba(0,0,0,.3); cursor: grab; touch-action: none; transition: transform 150ms ease, box-shadow 150ms ease; }
        .fab:hover { transform: scale(1.08); box-shadow: 0 6px 18px rgba(0,0,0,.35); }
        .fab:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
        .fab.drag { cursor: grabbing; transform: scale(1.08); transition: none; }
      </style>
      <button class="fab" type="button" aria-label="Open Colosal" title="Open Colosal">${FAB_ICON}</button>`
    document.documentElement.append(host)
    const btn = root.querySelector<HTMLButtonElement>(".fab")!

    const saved = (await chrome.storage.local.get(POS_KEY))[POS_KEY] as Pos | undefined
    let pos: Pos = saved ?? { right: 20, bottom: 100 }

    const clamp = (p: Pos): Pos => ({
      right: Math.min(Math.max(MARGIN, p.right), window.innerWidth - SIZE - MARGIN),
      bottom: Math.min(Math.max(MARGIN, p.bottom), window.innerHeight - SIZE - MARGIN),
    })
    const apply = () => {
      pos = clamp(pos)
      btn.style.right = `${pos.right}px`
      btn.style.bottom = `${pos.bottom}px`
    }
    apply()
    window.addEventListener("resize", apply)

    let start: { x: number; y: number; pos: Pos } | null = null
    let moved = false

    btn.addEventListener("pointerdown", (e) => {
      start = { x: e.clientX, y: e.clientY, pos }
      moved = false
      btn.setPointerCapture(e.pointerId)
    })
    btn.addEventListener("pointermove", (e) => {
      if (!start) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return
      moved = true
      btn.classList.add("drag")
      pos = { right: start.pos.right - dx, bottom: start.pos.bottom - dy }
      apply()
    })
    btn.addEventListener("pointerup", () => {
      start = null
      btn.classList.remove("drag")
      if (moved) chrome.storage.local.set({ [POS_KEY]: pos })
    })
    // A drag also fires click; only a plain click opens the panel.
    btn.addEventListener("click", () => {
      if (moved) return
      chrome.runtime.sendMessage({ type: "open-panel" })
    })
  },
})
