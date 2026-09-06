// COOK Chrome Extension Popup Logic

const API_BASE = "http://127.0.0.1:8000";

let currentTab = null;
let currentPlatform = "general";

document.addEventListener("DOMContentLoaded", async () => {
  // Get active tab details
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs.length > 0) {
    currentTab = tabs[0];
    const url = currentTab.url || "";
    const title = currentTab.title || "";

    if (url.includes("youtube.com") || url.includes("youtu.be")) currentPlatform = "youtube";
    else if (url.includes("instagram.com")) currentPlatform = "instagram";
    else if (url.includes("tiktok.com")) currentPlatform = "tiktok";
    else if (url.includes("linkedin.com")) currentPlatform = "linkedin";
    else if (url.includes("twitter.com") || url.includes("x.com")) currentPlatform = "x";

    document.getElementById("platform-badge").innerText = currentPlatform.toUpperCase();
    document.getElementById("page-title").innerText = title;
  }

  // Save Idea Button
  document.getElementById("btn-save-idea").addEventListener("click", async () => {
    const notes = document.getElementById("idea-notes").value;
    const statusMsg = document.getElementById("status-msg");

    try {
      statusMsg.style.display = "block";
      statusMsg.innerText = "Saving to COOK...";
      statusMsg.className = "status-msg loading";

      const res = await fetch(`${API_BASE}/api/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: currentTab?.title || "Web Inspiration",
          url: currentTab?.url || "",
          platform: currentPlatform,
          notes: notes,
          creator: currentTab?.title?.substring(0, 40) || "",
          tags: ["extension", currentPlatform]
        })
      });

      if (res.ok) {
        statusMsg.innerText = "✓ Saved to Idea Bank!";
        statusMsg.className = "status-msg success";
        setTimeout(() => window.close(), 1500);
      } else {
        throw new Error("Failed to save.");
      }
    } catch (err) {
      statusMsg.innerText = "Error connecting to COOK backend.";
      statusMsg.className = "status-msg error";
    }
  });

  // Generate Angles Button
  document.getElementById("btn-generate-angles").addEventListener("click", async () => {
    const title = currentTab?.title || "Content Idea";
    const notes = document.getElementById("idea-notes").value;
    const textToAnalyze = notes.trim() || title;

    const anglesContainer = document.getElementById("angles-container");
    const anglesList = document.getElementById("angles-list");

    try {
      anglesContainer.style.display = "block";
      anglesList.innerHTML = "<div class='loading-spinner'>Cooking hook angles...</div>";

      const res = await fetch(`${API_BASE}/api/ideas/generate-angles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToAnalyze,
          platform: currentPlatform
        })
      });

      const data = await res.json();
      if (data.generated_angles) {
        anglesList.innerHTML = data.generated_angles
          .map((angle) => `<div class="angle-item">${angle}</div>`)
          .join("");
      }
    } catch (err) {
      anglesList.innerHTML = "<div class='error-text'>Failed to generate angles.</div>";
    }
  });
});
