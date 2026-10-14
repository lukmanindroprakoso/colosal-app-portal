export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

  // The floating button on Upwork pages asks us to open the panel; this runs inside its click gesture.
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg?.type === "open-panel" && sender.tab?.id !== undefined) {
      chrome.sidePanel.open({ tabId: sender.tab.id })
    }
  })
})
