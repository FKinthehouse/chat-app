// Status Manager - Handles status updates and notification preferences

// This will be run on every page load
document.addEventListener("DOMContentLoaded", initStatusManager);
document.addEventListener("turbo:load", initStatusManager);

function initStatusManager() {
  console.log("Status Manager initialized");

  // Fix dropdown toggling issues
  fixStatusDropdownToggle();

  // Set up notification preferences based on user status
  updateNotificationPreferences();

  // Add status option click handlers
  setupStatusOptionHandlers();
}

// Fix the dropdown toggle issues
function fixStatusDropdownToggle() {
  const statusButton = document.getElementById("status-dropdown-button");
  const statusMenu = document.getElementById("status-dropdown-menu");

  if (!statusButton || !statusMenu) return;

  console.log("Fixing status dropdown toggle");

  // Custom click handler for the status button
  const handleStatusButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Toggle the menu visibility
    if (statusMenu.classList.contains("hidden")) {
      // Open the menu
      statusMenu.classList.remove("hidden");
      console.log("Status menu opened");

      // Add a click handler to the document to close the menu when clicking outside
      setTimeout(() => {
        document.addEventListener("click", closeMenuOnClickOutside);
      }, 10);
    } else {
      // Close the menu
      closeStatusMenu();
    }
  };

  // Close menu when clicking outside
  const closeMenuOnClickOutside = (e) => {
    if (!statusButton.contains(e.target) && !statusMenu.contains(e.target)) {
      closeStatusMenu();
    }
  };

  // Function to close the status menu
  const closeStatusMenu = () => {
    statusMenu.classList.add("hidden");
    console.log("Status menu closed");
    document.removeEventListener("click", closeMenuOnClickOutside);
  };

  // Remove any existing event listeners to prevent duplicates
  // This is a cleaner approach than trying to redefine the event handler
  const newStatusButton = statusButton.cloneNode(true);
  statusButton.parentNode.replaceChild(newStatusButton, statusButton);

  // Add the event listener to the new button
  newStatusButton.addEventListener("click", handleStatusButtonClick);
}

// Setup handlers for status option clicks
function setupStatusOptionHandlers() {
  const statusOptions = document.querySelectorAll(".status-option");
  const statusField = document.getElementById("status-field");
  const onlineStatusField = document.getElementById("online-status-field");
  const currentStatus = document.getElementById("current-status");
  const statusForm = document.getElementById("status-form");

  if (
    !statusOptions.length ||
    !statusField ||
    !onlineStatusField ||
    !currentStatus ||
    !statusForm
  ) {
    console.log("Missing required elements for status updates");
    return;
  }

  console.log("Setting up status option handlers");

  statusOptions.forEach((option) => {
    // Replace existing listeners by cloning the element
    const newOption = option.cloneNode(true);
    option.parentNode.replaceChild(newOption, option);

    newOption.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const status = this.getAttribute("data-status");
      console.log("Status option clicked:", status);

      // Determine online status based on selected status
      const online = status !== "Appear offline";

      // Update form fields
      statusField.value = status;
      onlineStatusField.value = online.toString();

      // Update UI immediately for better feedback
      updateStatusUI(status);

      // Close the dropdown
      const statusMenu = document.getElementById("status-dropdown-menu");
      if (statusMenu) {
        statusMenu.classList.add("hidden");
      }

      // Try to update via WebSocket first for instant updates across clients
      if (window.updateUserStatus && window.updateUserStatus(status, online)) {
        console.log("Status updated via WebSocket");
      } else {
        // Fall back to form submission if WebSocket isn't available
        console.log("Falling back to form submission for status update");
        statusForm.submit();
      }
    });
  });
}

// Function to update status UI
function updateStatusUI(status) {
  const currentStatus = document.getElementById("current-status");
  if (!currentStatus) return;

  // Update the status text
  currentStatus.textContent = status;

  // Update the status color
  updateStatusStyle(status);

  // Update the online indicator
  updateOnlineIndicator(status);

  console.log("Updated status UI to:", status);
}

// Function to update status text color
function updateStatusStyle(status) {
  const currentStatus = document.getElementById("current-status");
  if (!currentStatus) return;

  // Remove all status classes
  currentStatus.classList.remove(
    "status-available",
    "status-busy",
    "status-dnd",
    "status-away",
    "status-brb",
    "status-offline"
  );

  // Add appropriate class based on status
  switch (status) {
    case "Available":
      currentStatus.classList.add("status-available");
      break;
    case "Busy":
      currentStatus.classList.add("status-busy");
      break;
    case "Do not disturb":
      currentStatus.classList.add("status-dnd");
      break;
    case "Be right back":
      currentStatus.classList.add("status-brb");
      break;
    case "Appear away":
      currentStatus.classList.add("status-away");
      break;
    case "Appear offline":
      currentStatus.classList.add("status-offline");
      break;
    default:
      currentStatus.classList.add("status-available");
  }
}

// Update the online indicator dot
function updateOnlineIndicator(status) {
  // Find the online status indicator dot near the user avatar
  const onlineDot = document.querySelector(
    ".relative .rounded-full + .absolute"
  );
  const statusButton = document.getElementById("status-dropdown-button");

  if (!onlineDot || !statusButton) return;

  // Remove current status classes from the button
  statusButton.classList.remove(
    "text-green-500",
    "text-red-500",
    "text-yellow-500",
    "text-gray-400"
  );

  // Remove current status classes from the dot
  onlineDot.classList.remove(
    "bg-green-500",
    "bg-red-500",
    "bg-yellow-500",
    "bg-gray-500"
  );

  // Add appropriate class based on status
  if (status === "Available") {
    onlineDot.classList.add("bg-green-500");
    statusButton.classList.add("text-green-500");
  } else if (status === "Busy" || status === "Do not disturb") {
    onlineDot.classList.add("bg-red-500");
    statusButton.classList.add("text-red-500");
  } else if (status === "Be right back" || status === "Appear away") {
    onlineDot.classList.add("bg-yellow-500");
    statusButton.classList.add("text-yellow-500");
  } else if (status === "Appear offline") {
    onlineDot.classList.add("bg-gray-500");
    statusButton.classList.add("text-gray-400");
  } else {
    onlineDot.classList.add("bg-green-500");
    statusButton.classList.add("text-green-500");
  }
}

// Update notification preferences based on user status
function updateNotificationPreferences() {
  const currentStatus = document.getElementById("current-status");

  if (!currentStatus) return;

  const status = currentStatus.textContent.trim();
  console.log("Current status:", status);

  // Set notification preferences based on status
  let shouldNotify = true;

  if (status === "Do not disturb") {
    shouldNotify = false;
  }

  // Store this preference in localStorage so other scripts can check it
  localStorage.setItem(
    "chatapp_notifications_enabled",
    shouldNotify.toString()
  );
  console.log("Notifications enabled:", shouldNotify);
}

// Function to check if notifications are enabled based on user status
// This can be called from other scripts
window.shouldShowNotifications = function () {
  // Get from localStorage
  const enabled = localStorage.getItem("chatapp_notifications_enabled");

  // Default to true if not set
  return enabled === null ? true : enabled === "true";
};

// Initialize status color on page load
document.addEventListener("DOMContentLoaded", function () {
  const currentStatus = document.getElementById("current-status");
  if (currentStatus) {
    updateStatusUI(currentStatus.textContent.trim());
  }
});

// Also initialize on Turbo navigation
document.addEventListener("turbo:load", function () {
  const currentStatus = document.getElementById("current-status");
  if (currentStatus) {
    updateStatusUI(currentStatus.textContent.trim());
  }
});
