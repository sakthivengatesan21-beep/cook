// COOK Chrome Extension Background Service Worker (Manifest V3)

const API_BASE = "http://127.0.0.1:8000";

// Register context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "cook_highlight_idea",
    title: "COOK THIS → (Save Highlight to Idea Bank)",
    contexts: ["selection"]
  });
});

// Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "cook_highlight_idea" && info.selectionText) {
    const selectedText = info.selectionText.trim();
    const pageUrl = tab?.url || "";
    const pageTitle = tab?.title || "Web Highlight";
    
    // Identify platform
    let platform = "general";
    if (pageUrl.includes("youtube.com") || pageUrl.includes("youtu.be")) platform = "youtube";
    else if (pageUrl.includes("instagram.com")) platform = "instagram";
    else if (pageUrl.includes("tiktok.com")) platform = "tiktok";
    else if (pageUrl.includes("linkedin.com")) platform = "linkedin";
    else if (pageUrl.includes("twitter.com") || pageUrl.includes("x.com")) platform = "x";

    try {
      const response = await fetch(`${API_BASE}/api/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedText.length > 80 ? selectedText.substring(0, 80) + "..." : selectedText,
          notes: selectedText,
          url: pageUrl,
          platform: platform,
          creator: pageTitle.substring(0, 50),
          tags: ["highlight", platform, "web_clip"]
        })
      });

      if (response.ok) {
        // Send message to content script to display success toast
        chrome.tabs.sendMessage(tab.id, {
          action: "show_toast",
          message: "⚡ Saved to COOK Idea Bank!"
        });
      }
    } catch (err) {
      console.error("[COOK Extension] Failed to save idea:", err);
    }
  }
});
