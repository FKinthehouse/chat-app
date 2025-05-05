import consumer from "./consumer";

// Keep track of received status updates to prevent duplicates
if (!window.statusUpdates) {
  window.statusUpdates = new Map();
}

// Track which users should be ignored due to ghost notifications
if (!window.ignoredStatusUsers) {
  window.ignoredStatusUsers = new Set();
}

// Store last known status of each user to prevent redundant notifications
if (!window.lastUserStatus) {
  window.lastUserStatus = new Map();
}

// Detect browser for notification adjustments
window.isChromeOrBrave =
  /Chrome/.test(navigator.userAgent) &&
  /Google Inc|Brave/.test(navigator.vendor);
console.log("Browser detection: Chrome/Brave:", window.isChromeOrBrave);

// Create a single global subscription to the status channel
window.statusSubscription = consumer.subscriptions.create("StatusChannel", {
  connected() {
    console.log("Connected to StatusChannel");

    // Request status updates for all users when connection is established
    this.requestAllStatuses();

    // Set a heartbeat to ensure connection stays alive
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, 30000); // every 30 seconds

    // Set up a periodic ghost notification cleanup
    this.cleanupInterval = setInterval(() => {
      cleanupGhostNotifications();
    }, 60000); // Check every minute
  },

  disconnected() {
    console.log("Disconnected from StatusChannel");

    // Clear heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  },

  received(data) {
    console.log("Status update received:", data);

    // Ensure we have the minimum required data
    if (!data.user_id || !data.status) {
      console.error("Received incomplete status data:", data);
      return;
    }

    // CRITICAL FIX: If user has been offline for 5+ min, permanently ignore their Available/Active notifications
    // Also ensure status broadcasts include our verification flag
    if (!data.is_verified_broadcast) {
      console.log(
        `Received unverified broadcast from user ${data.user_id}. Checking for validity...`
      );

      // Skip if status is available but online flag is false
      if (data.status === "Available" && data.online === false) {
        console.log(
          `GHOST NOTIFICATION detected from user ${data.user_id} (${data.name}). Adding to ignore list.`
        );
        window.ignoredStatusUsers.add(data.user_id);
        return;
      }
    }

    // AGGRESSIVE: Skip updates for users in the ignore list
    if (window.ignoredStatusUsers.has(data.user_id)) {
      console.log(
        `Ignoring status update from ignored user ${data.user_id} (${
          data.name || "unknown"
        })`
      );
      return;
    }

    // AGGRESSIVE: Check if this is a ghost notification (non-online user showing as available)
    if (data.status === "Available" && data.online === false) {
      console.log(
        `Detected ghost notification from user ${data.user_id} (${
          data.name || "unknown"
        }). Adding to ignore list.`
      );
      window.ignoredStatusUsers.add(data.user_id);
      data.status = "Appear offline";

      // Clear any existing ghost notifications for this user after a delay
      setTimeout(() => {
        removeGhostNotifications(data.name);
      }, 100);
    }

    // Add online status verification
    // Don't show a user as available if they're not actually online
    if (data.status === "Available" && data.online === false) {
      console.log(
        "Ignoring 'Available' status for offline user:",
        data.user_id
      );
      data.status = "Appear offline";
    }

    // Check if we've already processed this update
    const updateKey = `${data.user_id}-${data.timestamp || 0}`;
    if (window.statusUpdates.has(updateKey)) {
      console.log("Ignoring duplicate status update:", updateKey);
      return;
    }

    // Store this update
    window.statusUpdates.set(updateKey, true);

    // Limit the size of the updates map
    if (window.statusUpdates.size > 100) {
      const firstKey = Array.from(window.statusUpdates.keys())[0];
      window.statusUpdates.delete(firstKey);
    }

    // Check if this is a current user update
    const isCurrentUser =
      data.user_id ==
      document.querySelector('meta[name="current-user-id"]')?.content;

    // For current user, update the status UI directly in the navbar
    if (isCurrentUser) {
      updateCurrentUserStatus(data.status);
    }

    // Update status indicators for this user throughout the page
    updateUserStatus(data);

    // Show notification for status changes (skip for current user)
    if (!isCurrentUser) {
      showStatusNotification(data);
    }
  },

  // Request all user statuses
  requestAllStatuses() {
    console.log("Requesting all user statuses");
    this.perform("request_all_statuses");
  },

  // Send a heartbeat to keep the connection alive
  performHeartbeat() {
    this.perform("heartbeat");
  },

  // Update status directly from JavaScript
  updateStatus(status, online) {
    console.log(`Directly updating status to: ${status} (online: ${online})`);
    this.perform("update_status", { status, online });
  },
});

// Function to remove ghost notifications for a specific user
function removeGhostNotifications(userName) {
  if (!userName) return;

  // Find any status notifications showing this user as available
  const notifications = document.querySelectorAll(".status-notification");

  notifications.forEach((notification) => {
    const text = notification.textContent || "";
    if (text.includes(userName) && text.includes("Available")) {
      console.log(`Removing ghost notification for ${userName}`);
      notification.remove();
    }
  });
}

// Function to show a notification when a user's status changes
function showStatusNotification(data) {
  const userId = data.user_id;
  const status = data.status;
  const userName = data.name;
  const isOnline = data.online;

  // CRITICAL FIX: Only send notification if status actually changed
  const previousStatus = window.lastUserStatus.get(userId);
  if (previousStatus === status) {
    console.log(
      `Suppressing redundant status notification for ${userName}, status unchanged: ${status}`
    );
    return;
  }

  // Store the current status for future comparison
  window.lastUserStatus.set(userId, status);

  // CRITICAL FIX: Only show notifications from verified broadcasts
  if (!data.is_verified_broadcast) {
    console.log(
      `Blocked notification from unverified broadcast for user ${userId}`
    );
    return;
  }

  // AGGRESSIVE: Skip notifications for users that we've ignored
  if (window.ignoredStatusUsers.has(userId)) {
    console.log(`Blocked notification from ignored user ${userName}`);
    return;
  }

  // AGGRESSIVE: Verify that status and online state are consistent
  // Don't show "available" notifications for users who aren't online
  if (!isOnline && (status === "Available" || status === "Be right back")) {
    console.log(
      "Suppressing inconsistent status notification for offline user:",
      userName
    );
    // Add to ignored list to prevent future ghost notifications
    window.ignoredStatusUsers.add(userId);
    return;
  }

  // Don't display notifications for users who have been offline for 5+ minutes
  if (
    data.last_seen_at &&
    new Date(data.last_seen_at) < new Date(Date.now() - 5 * 60 * 1000)
  ) {
    console.log(
      `Suppressing notification for inactive user ${userName} (inactive for 5+ minutes)`
    );
    // Add to ignored list
    window.ignoredStatusUsers.add(userId);
    return;
  }

  // Don't notify for your own status changes
  if (
    userId == document.querySelector('meta[name="current-user-id"]')?.content
  ) {
    return;
  }

  // AGGRESSIVE: Remove any existing notifications for this user
  const existingNotifications = document.querySelectorAll(
    ".status-notification"
  );
  existingNotifications.forEach((notification) => {
    const text = notification.textContent || "";
    if (text.includes(userName)) {
      console.log(`Removing existing notification for ${userName}`);
      notification.remove();
    }
  });

  // Create notification element if it doesn't exist
  let notification = document.getElementById("status-notification");
  if (!notification) {
    notification = document.createElement("div");
    notification.id = "status-notification";
    notification.className = "status-notification";
    notification.dataset.userId = userId; // Add user ID for easier tracking
    document.body.appendChild(notification);
  }

  // Determine notification color based on status
  let dotColor = "";
  let displayStatus = "";

  if (status === "Available") {
    // AGGRESSIVE: Double check online status before showing available
    if (!isOnline) {
      console.log(
        `Blocking inconsistent Available status for ${userName} who is offline`
      );
      return;
    }
    dotColor = "bg-green-500";
    displayStatus = "Available";
  } else if (status === "Busy") {
    dotColor = "bg-red-500";
    displayStatus = "Busy";
  } else if (status === "Do not disturb") {
    dotColor = "bg-red-500";
    displayStatus = "Do not disturb";
  } else if (status === "Be right back") {
    dotColor = "bg-yellow-500";
    displayStatus = "Be right back";
  } else if (status === "Appear away") {
    dotColor = "bg-yellow-500";
    displayStatus = "Away";
  } else if (status === "Appear offline") {
    dotColor = "bg-gray-400";
    displayStatus = "Offline";
  } else {
    dotColor = "bg-gray-400";
    displayStatus = status;
  }

  // Set notification content
  notification.innerHTML = `
    <div class="status-notification-dot ${dotColor}"></div>
    <div class="status-notification-message">
      <strong>${userName}</strong> is now <strong>${displayStatus}</strong>
    </div>
  `;

  // BROWSER-SPECIFIC: Add extra classes for Chrome/Brave to ensure visibility
  if (window.isChromeOrBrave) {
    notification.classList.add("chrome-fix");
    // Force high z-index to ensure visibility in Chrome/Brave
    notification.style.zIndex = "9999";

    // Force show in Chrome even without animation
    notification.style.display = "flex";
    notification.style.opacity = "1";

    // Create an audio element for notification sound (requires user interaction first)
    try {
      // Check if we can play audio (needs user interaction in some browsers)
      const canPlayAudio = document.documentElement.hasAttribute(
        "data-user-interacted"
      );

      if (canPlayAudio && status === "Available") {
        const notificationSound = new Audio();
        notificationSound.src = "/notification.mp3"; // Make sure this file exists
        notificationSound.volume = 0.3;
        notificationSound
          .play()
          .catch((e) =>
            console.log("Audio play prevented by browser policy:", e)
          );
      }
    } catch (e) {
      console.log("Error playing notification sound:", e);
    }
  }

  // Show notification
  notification.classList.add("show");

  // Add creation timestamp
  markNotificationCreationTime(notification);

  // Hide notification after 3 seconds
  setTimeout(() => {
    notification.classList.remove("show");

    // CHROME/BRAVE FIX: Force-remove styles that might prevent hiding
    if (window.isChromeOrBrave) {
      notification.style.display = "none";

      // Force remove from DOM after a delay to prevent stuck notifications
      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 500);
    }
  }, 3000);
}

// Detect user interaction to enable audio in Chrome/Brave
document.addEventListener("click", function () {
  document.documentElement.setAttribute("data-user-interacted", "true");
});

// Function to clean up ghost notifications by scanning the DOM for inconsistent status indicators
function cleanupGhostNotifications() {
  console.log("Running ghost notification cleanup");

  // Find all user status indicators in the DOM
  const statusIndicators = document.querySelectorAll(".user-status-indicator");

  statusIndicators.forEach((indicator) => {
    // Get the user ID from the indicator
    const userId = indicator.dataset.userId;
    if (!userId) return;

    // Find status text element
    const statusText = indicator.querySelector(".user-status-text");
    if (!statusText) return;

    // Find online dot
    const onlineDot =
      indicator.closest("[data-user-id]")?.querySelector(".user-online-dot") ||
      indicator.querySelector(".user-online-dot");

    // Check for inconsistency: status shows Available but dot is gray (offline)
    const isStatusAvailable = statusText.textContent.includes("Available");
    const isDotOffline =
      onlineDot && onlineDot.classList.contains("bg-gray-400");

    if (isStatusAvailable && isDotOffline) {
      console.log(`Fixing inconsistent status display for user ${userId}`);

      // Update the status text to show Offline
      statusText.innerHTML = "";
      const icon = document.createElement("span");
      icon.className = "status-offline-icon user-status-icon";
      statusText.appendChild(icon);
      statusText.appendChild(document.createTextNode(" Offline"));

      // Update status class
      statusText.className = statusText.className
        .replace(/status-\w+/g, "")
        .trim();
      statusText.classList.add("status-offline");

      // Add this user to the ignored list
      window.ignoredStatusUsers.add(parseInt(userId));
    }
  });

  // Also clean up any status notifications still showing in the UI
  const notifications = document.querySelectorAll(".status-notification");
  const currentTime = Date.now();

  notifications.forEach((notification) => {
    // Check if notification is for an Available user
    const text = notification.textContent || "";
    if (text.includes("Available")) {
      // Get creation time from data attribute, or assume it's old
      const creationTime = parseInt(notification.dataset.createdAt || "0");

      // If notification is older than 3 seconds, remove it
      if (currentTime - creationTime > 3000) {
        notification.remove();
      }
    }
  });
}

// When a notification is created, store its creation time
function markNotificationCreationTime(notification) {
  if (!notification) return;
  notification.dataset.createdAt = Date.now().toString();
}

// Update current user's status directly through the channel
window.updateUserStatus = function (status, online = true) {
  if (window.statusSubscription) {
    window.statusSubscription.updateStatus(status, online);
    return true;
  }
  return false;
};

// Update current user's status in the navbar
function updateCurrentUserStatus(status) {
  const currentStatus = document.getElementById("current-status");
  const statusButton = document.getElementById("status-dropdown-button");
  const onlineDot = document.querySelector(
    ".relative .rounded-full + .absolute"
  );

  if (!currentStatus || !statusButton || !onlineDot) {
    console.warn("Could not find current user status elements");
    return;
  }

  console.log("Updating current user status UI to:", status);

  // Update the status text
  currentStatus.textContent = status;

  // Remove existing status classes from button
  statusButton.classList.remove(
    "text-green-500",
    "text-red-500",
    "text-yellow-500",
    "text-gray-400"
  );

  // Remove existing status classes from dot
  onlineDot.classList.remove(
    "bg-green-500",
    "bg-red-500",
    "bg-yellow-500",
    "bg-gray-500"
  );

  // Add appropriate classes based on status
  if (status === "Available") {
    statusButton.classList.add("text-green-500");
    onlineDot.classList.add("bg-green-500");
  } else if (status === "Busy" || status === "Do not disturb") {
    statusButton.classList.add("text-red-500");
    onlineDot.classList.add("bg-red-500");
  } else if (status === "Be right back" || status === "Appear away") {
    statusButton.classList.add("text-yellow-500");
    onlineDot.classList.add("bg-yellow-500");
  } else if (status === "Appear offline") {
    statusButton.classList.add("text-gray-400");
    onlineDot.classList.add("bg-gray-500");
  } else {
    statusButton.classList.add("text-green-500");
    onlineDot.classList.add("bg-green-500");
  }
}

// Function to update a user's status throughout the UI
function updateUserStatus(data) {
  const userId = data.user_id;
  const status = data.status;
  const isOnline = data.online;
  const statusClass = data.status_class;

  console.log(
    `Updating status for user ${userId} to ${status} (${
      isOnline ? "online" : "offline"
    })`
  );

  // Check for inconsistent state - available user who is not online
  if (!isOnline && status === "Available") {
    console.log(
      "User marked as Available but is not online - correcting status display"
    );
    data.status = "Appear offline";
  }

  // First update the member list in the sidebar
  updateSidebarMemberStatus(userId, status, isOnline);

  // Then update all status indicators across the UI
  updateAllStatusIndicators(userId, status, isOnline, statusClass);

  // Update chat header if applicable
  updateChatHeaderStatus(userId, status, isOnline);

  // Force refresh all status elements for this user
  forceRefreshAllStatusElements(userId, status, isOnline);

  // Force the UI to reflect the change
  forceUIRefresh();
}

// Function to force refresh all status elements for a specific user
function forceRefreshAllStatusElements(userId, status, isOnline) {
  console.log(`Force refreshing all status elements for user ${userId}`);

  // Find ALL elements that might contain status information for this user
  const allElements = document.querySelectorAll(`
    [data-user-id="${userId}"],
    [data-user-id="${userId}"] *,
    .members-list [data-user-id="${userId}"],
    .members-list [data-user-id="${userId}"] *,
    .user-status-indicator[data-user-id="${userId}"],
    .user-status-indicator[data-user-id="${userId}"] *
  `);

  console.log(
    `Found ${allElements.length} potential elements to refresh for user ${userId}`
  );

  // Process each element to update relevant status classes
  allElements.forEach((element) => {
    // Update status text elements
    if (
      element.classList.contains("user-status-text") ||
      element.classList.contains("status-available") ||
      element.classList.contains("status-busy") ||
      element.classList.contains("status-dnd") ||
      element.classList.contains("status-away") ||
      element.classList.contains("status-brb") ||
      element.classList.contains("status-offline")
    ) {
      // Clear the element and rebuild it
      let displayStatus = status;
      if (status === "Appear offline") displayStatus = "Offline";
      if (status === "Appear away") displayStatus = "Away";

      element.innerHTML = "";

      // Add icon
      const icon = document.createElement("span");
      icon.className = getStatusIconClass(status) + " user-status-icon";
      element.appendChild(icon);

      // Add text
      element.appendChild(document.createTextNode(" " + displayStatus));

      // Update class
      element.className = element.className.replace(/status-\w+/g, "").trim();
      element.classList.add(getStatusColorClass(status));

      console.log(
        `Refreshed status element for user ${userId} to ${displayStatus}`
      );
    }

    // Update online dot elements
    if (
      element.classList.contains("user-online-dot") ||
      element.classList.contains("header-online-dot") ||
      element.classList.contains("bg-green-500") ||
      element.classList.contains("bg-red-500") ||
      element.classList.contains("bg-yellow-500") ||
      element.classList.contains("bg-gray-400")
    ) {
      element.className = element.className.replace(/bg-\w+-\d+/g, "").trim();
      element.classList.add(getStatusDotClass(status, isOnline));
    }
  });
}

// Force small UI changes to ensure the browser renders the updates
function forceUIRefresh() {
  // This creates a slight layout shift which forces browser to repaint
  document.body.classList.add("force-repaint");
  setTimeout(() => {
    document.body.classList.remove("force-repaint");
  }, 10);
}

// Update sidebar member status
function updateSidebarMemberStatus(userId, status, isOnline) {
  console.log(`Updating sidebar status for user ${userId} to ${status}`);

  // Find ALL elements related to this user in the sidebar or any lists
  // Using multiple selector strategies to ensure we catch all instances
  const selectors = [
    `.members-list [data-user-id="${userId}"]`,
    `[data-user-id="${userId}"]`,
    `.flex.items-center p[data-user-id="${userId}"]`,
    `.flex.items-center div[data-user-id="${userId}"]`,
  ];

  // Combine selectors for a single query
  const combinedSelector = selectors.join(", ");
  const memberElements = document.querySelectorAll(combinedSelector);

  console.log(
    `Found ${memberElements.length} elements matching user ${userId}`
  );

  memberElements.forEach((memberEl) => {
    // Find ALL possible status elements
    // This includes both direct children and any nested status elements
    const statusTextElements = [
      ...memberEl.querySelectorAll(".user-status-text"),
      ...memberEl.querySelectorAll("[class*='status-']"),
      ...document.querySelectorAll(
        `.user-status-text[data-user-id="${userId}"]`
      ),
      ...document.querySelectorAll(
        `[class*='status-'][data-user-id="${userId}"]`
      ),
    ];

    const onlineDots = [
      ...memberEl.querySelectorAll(".user-online-dot"),
      ...document.querySelectorAll(
        `.user-online-dot[data-user-id="${userId}"]`
      ),
    ];

    // Update each status text element found
    statusTextElements.forEach((statusText) => {
      if (!statusText) return;

      let displayStatus = status;
      if (status === "Appear offline") displayStatus = "Offline";
      if (status === "Appear away") displayStatus = "Away";

      // Clear existing content and rebuild
      statusText.innerHTML = "";

      // Add icon
      const icon = document.createElement("span");
      icon.className = getStatusIconClass(status) + " user-status-icon";
      statusText.appendChild(icon);

      // Add status text
      statusText.appendChild(document.createTextNode(" " + displayStatus));

      // Update status text color
      statusText.className = statusText.className
        .replace(/status-\w+/g, "")
        .trim();
      statusText.classList.add(getStatusColorClass(status));

      console.log(`Updated status text for user ${userId} to ${displayStatus}`);
    });

    // Update all online dots
    onlineDots.forEach((onlineDot) => {
      if (!onlineDot) return;

      onlineDot.className = onlineDot.className
        .replace(/bg-\w+-\d+/g, "")
        .trim();
      onlineDot.classList.add(getStatusDotClass(status, isOnline));
    });
  });

  // Also directly query for any stand-alone status elements for this user
  // that might not be directly under a user element
  const standaloneStatusElements = document.querySelectorAll(
    `[data-user-id="${userId}"] .user-status-text, [data-user-id="${userId}"] [class*='status-']`
  );

  standaloneStatusElements.forEach((statusText) => {
    if (!statusText) return;

    let displayStatus = status;
    if (status === "Appear offline") displayStatus = "Offline";
    if (status === "Appear away") displayStatus = "Away";

    // Rebuild status text
    statusText.innerHTML = "";

    // Add icon
    const icon = document.createElement("span");
    icon.className = getStatusIconClass(status) + " user-status-icon";
    statusText.appendChild(icon);

    // Add text
    statusText.appendChild(document.createTextNode(" " + displayStatus));

    // Update class
    statusText.className = statusText.className
      .replace(/status-\w+/g, "")
      .trim();
    statusText.classList.add(getStatusColorClass(status));

    console.log(`Updated standalone status for user ${userId}`);
  });
}

// Update all status indicators across the UI
function updateAllStatusIndicators(userId, status, isOnline, statusClass) {
  console.log(`Thoroughly updating all status indicators for user ${userId}`);

  // Define multiple selectors to catch all possible status indicators
  const selectors = [
    `.user-status-indicator[data-user-id="${userId}"]`,
    `[data-user-id="${userId}"] .user-status-indicator`,
    `[data-user-id="${userId}"]`,
    `.user-status-text[data-user-id="${userId}"]`,
    `[data-user-id="${userId}"] .user-status-text`,
  ];

  // Combine selectors and query all matching elements
  const combinedSelector = selectors.join(", ");
  const statusElements = document.querySelectorAll(combinedSelector);

  console.log(
    `Found ${statusElements.length} status indicators for user ${userId}`
  );

  // Process each element
  statusElements.forEach((statusEl) => {
    // Look for status text elements both within this element and this element itself
    const statusTextElements = [
      ...statusEl.querySelectorAll(".user-status-text"),
      ...(statusEl.classList.contains("user-status-text") ? [statusEl] : []),
    ];

    // Look for online dots
    const onlineDots = [
      ...statusEl.querySelectorAll(".user-online-dot"),
      ...(statusEl.classList.contains("user-online-dot") ? [statusEl] : []),
    ];

    // Update each status text element
    statusTextElements.forEach((statusText) => {
      if (!statusText) return;

      // Display appropriate status message to other users
      let displayStatus;
      if (status === "Appear offline") {
        displayStatus = "Offline";
      } else if (status === "Appear away") {
        displayStatus = "Away";
      } else if (status === "Be right back") {
        displayStatus = "Be right back";
      } else {
        displayStatus = status;
      }

      // Completely rebuild the status text element
      statusText.innerHTML = "";

      // Add icon
      const iconSpan = document.createElement("span");
      iconSpan.className = getStatusIconClass(status);
      statusText.appendChild(iconSpan);

      // Add status text
      statusText.appendChild(document.createTextNode(" " + displayStatus));

      // Update status color classes
      statusText.className = statusText.className
        .replace(/status-\w+/g, "")
        .trim();
      statusText.classList.add(getStatusColorClass(status));

      console.log(`Updated status text indicator to "${displayStatus}"`);
    });

    // Update each online dot
    onlineDots.forEach((onlineDot) => {
      if (!onlineDot) return;

      onlineDot.className = onlineDot.className
        .replace(/bg-\w+-\d+/g, "")
        .trim();
      onlineDot.classList.add(getStatusDotClass(status, isOnline));
    });
  });

  // Also update the header status if this is for the other user in a direct chat
  updateChatHeaderStatus(userId, status, isOnline);
}

// Update chat header status if needed
function updateChatHeaderStatus(userId, status, isOnline) {
  // Check if we're in a chat view with this user
  const chatHeader = document.querySelector(".chat-header");
  if (!chatHeader) return;

  // If this is a direct chat with the user whose status changed
  const headerStatusIndicator = chatHeader.querySelector(
    `.user-status-indicator[data-user-id="${userId}"]`
  );
  if (headerStatusIndicator) {
    // Update the header status text
    const headerStatusText = headerStatusIndicator.querySelector(
      ".chat-header-status"
    );
    if (headerStatusText) {
      let displayStatus = status;
      if (status === "Appear offline") displayStatus = "Offline";
      if (status === "Appear away") displayStatus = "Away";

      // Clear existing content
      headerStatusText.innerHTML = "";

      // Add icon
      const iconSpan = document.createElement("span");
      iconSpan.className = getStatusIconClass(status);
      headerStatusText.appendChild(iconSpan);

      // Add text
      headerStatusText.appendChild(
        document.createTextNode(" " + displayStatus)
      );

      // Update color class
      headerStatusText.className = headerStatusText.className
        .replace(/status-\w+/g, "")
        .trim();
      headerStatusText.classList.add(getStatusColorClass(status));
    }

    // Update the online indicator
    const headerOnlineDot =
      headerStatusIndicator.querySelector(".header-online-dot");
    if (headerOnlineDot) {
      headerOnlineDot.className = headerOnlineDot.className
        .replace(/bg-\w+-\d+/g, "")
        .trim();
      headerOnlineDot.classList.add(getStatusDotClass(status, isOnline));
    }
  }
}

// Helper function to get status color class
function getStatusColorClass(status) {
  switch (status) {
    case "Available":
      return "status-available";
    case "Busy":
      return "status-busy";
    case "Do not disturb":
      return "status-dnd";
    case "Be right back":
      return "status-brb";
    case "Appear away":
      return "status-away";
    case "Appear offline":
      return "status-offline";
    default:
      return "status-available";
  }
}

// Helper function to get status icon class
function getStatusIconClass(status) {
  switch (status) {
    case "Available":
      return "status-available-icon";
    case "Busy":
      return "status-busy-icon";
    case "Do not disturb":
      return "status-dnd-icon";
    case "Be right back":
      return "status-brb-icon";
    case "Appear away":
      return "status-away-icon";
    case "Appear offline":
      return "status-offline-icon";
    default:
      return "status-available-icon";
  }
}

// Helper function to get status dot class
function getStatusDotClass(status, isOnline) {
  if (!isOnline) return "bg-gray-400";

  switch (status) {
    case "Available":
      return "bg-green-500";
    case "Busy":
    case "Do not disturb":
      return "bg-red-500";
    case "Be right back":
    case "Appear away":
      return "bg-yellow-500";
    case "Appear offline":
      return "bg-gray-400";
    default:
      return "bg-green-500";
  }
}

// Function to force update notification badges (especially for Chrome/Brave)
function forceUpdateBadges() {
  if (!window.isChromeOrBrave) return;

  console.log("Force updating notification badges for Chrome/Brave browser");

  // Find all chat links with potential badges
  const chatLinks = document.querySelectorAll('a[href^="/chats/"]');

  chatLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const chatIdMatch = href.match(/\/chats\/(\d+)/);

    if (chatIdMatch && chatIdMatch[1]) {
      const chatId = chatIdMatch[1];

      // Skip if marked as read in localStorage
      if (localStorage.getItem(`chat_${chatId}_read`) === "true") {
        // Find badge element and hide if needed
        const badge = link.querySelector(
          ".ml-2.bg-red-500.text-white.text-xs.font-bold.rounded-full"
        );
        if (badge) {
          badge.classList.add("hidden");
          badge.style.display = "none";
          console.log(`Forced badge hide for chat ${chatId}`);
        }
      }
    }
  });
}

// Set up a timer to periodically update badges in Chrome/Brave
if (window.isChromeOrBrave) {
  console.log("Setting up Chrome/Brave badge update timer");
  // Run immediately
  forceUpdateBadges();

  // Then run periodically
  setInterval(forceUpdateBadges, 2000);

  // Also run after page events that might affect the DOM
  document.addEventListener("turbo:load", forceUpdateBadges);
  document.addEventListener("turbo:frame-load", forceUpdateBadges);
  document.addEventListener("turbo:render", forceUpdateBadges);

  // Listen for connection status and re-run when connection is restored
  document.addEventListener("action-cable-connected", () => {
    console.log("ActionCable connected, updating badges");
    setTimeout(forceUpdateBadges, 500);
  });
}

// Ensure Chrome browser knows when documents are fully loaded
window.addEventListener("load", function () {
  if (window.isChromeOrBrave) {
    document.documentElement.setAttribute("data-chrome-loaded", "true");
    console.log("Page fully loaded in Chrome/Brave - optimizing notifications");

    // Force rendering all status indicators
    setTimeout(() => {
      forceUpdateBadges();

      // Also force refresh the notification display
      const notification = document.getElementById("status-notification");
      if (notification) {
        const parent = notification.parentNode;
        if (parent) {
          const clone = notification.cloneNode(true);
          parent.replaceChild(clone, notification);
        }
      }
    }, 500);
  }
});
