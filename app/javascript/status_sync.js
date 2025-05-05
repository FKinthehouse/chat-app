// Status Sync - Handles automatic status synchronization between browsers

// Keep track of the last status update we processed
let lastProcessedStatus = {};

// Request status updates periodically
function setupStatusSync() {
  console.log("Setting up status sync");

  // Request all statuses immediately when the page loads
  requestAllStatuses();

  // Setup periodic status sync (every 10 seconds)
  setInterval(() => {
    requestAllStatuses();
  }, 10000);
}

// Request all user statuses from the server
function requestAllStatuses() {
  if (
    window.statusSubscription &&
    typeof window.statusSubscription.requestAllStatuses === "function"
  ) {
    console.log("Requesting all statuses for sync");
    window.statusSubscription.requestAllStatuses();
  }
}

// Check for status changes in the UI
function checkCurrentStatus() {
  const currentStatusElement = document.getElementById("current-status");
  if (!currentStatusElement) return;

  const currentStatus = currentStatusElement.textContent.trim();
  const userId = document.querySelector(
    'meta[name="current-user-id"]'
  )?.content;

  if (!userId) return;

  // If our status differs from the last processed status, resync it
  if (
    !lastProcessedStatus[userId] ||
    lastProcessedStatus[userId] !== currentStatus
  ) {
    console.log(
      `Status mismatch detected: UI shows "${currentStatus}" but last processed was "${lastProcessedStatus[userId]}"`
    );

    // Update through WebSocket
    const online = currentStatus !== "Appear offline";
    if (window.updateUserStatus) {
      window.updateUserStatus(currentStatus, online);
      lastProcessedStatus[userId] = currentStatus;
    }
  }
}

// Set up initialization
document.addEventListener("DOMContentLoaded", setupStatusSync);
document.addEventListener("turbo:load", setupStatusSync);

// Check status every second to ensure UI consistency
setInterval(checkCurrentStatus, 1000);

// Export for testing
window.statusSync = {
  requestAllStatuses,
  checkCurrentStatus,
};
