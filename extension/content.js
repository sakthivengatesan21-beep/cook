// COOK Chrome Extension Content Script

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "show_toast") {
    showToast(request.message || "Saved to COOK!");
    sendResponse({ success: true });
  }
});

function showToast(message) {
  const existingToast = document.getElementById("cook-extension-toast");
  if (existingToast) existingToast.remove();

  const toast = document.createElement("div");
  toast.id = "cook-extension-toast";
  toast.innerText = message;
  
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    backgroundColor: "#D2E823",
    color: "#09090B",
    padding: "12px 20px",
    borderRadius: "12px",
    border: "2px solid #09090B",
    boxShadow: "4px 4px 0px #09090B",
    fontFamily: "monospace",
    fontWeight: "bold",
    fontSize: "13px",
    zIndex: "999999999",
    transition: "all 0.3s ease",
    cursor: "pointer"
  });

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
