// Action Cable provides the framework to deal with WebSockets in Rails.
// You can generate new channels where WebSocket features live using the `bin/rails generate channel` command.

import { createConsumer } from "@rails/actioncable";

// Create a more resilient consumer with reconnection strategy
const createResilientConsumer = () => {
  console.log("🔌 Creating ActionCable consumer with browser optimizations");

  // Detect browser type
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isChrome =
    /chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent);
  const isBrave = isChrome && navigator.brave?.isBrave;

  console.log(
    `🌐 Browser detection: Safari: ${isSafari}, Chrome: ${isChrome}, Brave: ${isBrave}`
  );

  // Set global flag for Chrome/Brave
  window.isChromeBrave = isChrome || isBrave;

  // Create consumer with specific configuration
  let consumer;

  try {
    // For Chrome/Brave, use a completely different strategy
    if (isChrome || isBrave) {
      console.log("⚙️ Using aggressive Chrome/Brave WebSocket optimization");

      // Create the consumer
      consumer = createConsumer();

      // Override the connection protocol for Chrome/Brave
      if (consumer && consumer.connection) {
        // Store the original methods
        const originalConnect = consumer.connection.connect;
        const originalDisconnect = consumer.connection.disconnect;
        const originalReconnect = consumer.connection.reconnect;

        // Override the connect method
        consumer.connection.connect = function () {
          console.log("🔌 Chrome/Brave enhanced connect called");
          // Force disconnect first to ensure clean connection
          if (this.webSocket) {
            try {
              this.webSocket.onclose = function () {};
              this.webSocket.close();
            } catch (e) {
              console.error("Error closing websocket:", e);
            }
            this.webSocket = null;
          }
          return originalConnect.apply(this, arguments);
        };

        // Override the reconnect method with more aggressive approach
        consumer.connection.reconnect = function () {
          console.log("🔄 Chrome/Brave aggressive reconnection activated");

          // Force clean disconnection
          try {
            if (this.webSocket) {
              this.webSocket.onclose = function () {};
              this.webSocket.close();
              this.webSocket = null;
            }
          } catch (e) {
            console.error("Error during forced disconnection:", e);
          }

          // Force a delay before reconnecting
          setTimeout(() => {
            try {
              originalConnect.apply(this);
              console.log("🔄 Chrome/Brave reconnection attempted");

              // Double check connection after a short delay
              setTimeout(() => {
                if (!this.isActive()) {
                  console.log("🔄 Connection still not active, trying again");
                  originalConnect.apply(this);
                }
              }, 500);
            } catch (e) {
              console.error("Error during reconnection:", e);
            }
          }, 200);
        };

        // Setup automatic periodic reconnection for Chrome/Brave
        window.chromeBraveReconnectInterval = setInterval(() => {
          if (consumer.connection && !consumer.connection.isActive()) {
            console.log(
              "🔄 Periodic reconnection check - connection not active"
            );
            try {
              consumer.connection.reconnect();
            } catch (e) {
              console.error("Error during periodic reconnection:", e);
            }
          }
        }, 5000); // Check every 5 seconds
      }
    } else {
      // Standard consumer for other browsers
      consumer = createConsumer();
    }

    // Add browser compatibility event listeners
    if (consumer && consumer.connection) {
      consumer.connection.addEventListener("connected", () => {
        console.log("🟢 ActionCable connected successfully");
        // Set global flag for connection status
        window.actionCableConnected = true;

        // For Chrome/Brave, enhance notification support
        if (isChrome || isBrave) {
          // Create notification fix for Chrome
          window.chromeBraveNotificationFix = () => {
            // Fix all visible notification elements
            const notifications = document.querySelectorAll(
              ".status-notification"
            );
            notifications.forEach((notification) => {
              if (notification.classList.contains("show")) {
                // Re-apply the show class to force redraw
                notification.classList.remove("show");
                setTimeout(() => {
                  notification.classList.add("show");
                  notification.style.display = "flex";
                  notification.style.opacity = "1";
                  notification.style.zIndex = "9999";
                  notification.style.visibility = "visible";
                }, 10);
              }
            });

            // ULTRA AGGRESSIVE: Find ALL possible badge elements
            const allBadges = document.querySelectorAll(
              ".ml-2.bg-red-500, .rounded-full, .text-white, .text-xs, .font-bold"
            );

            // Force all badges to be visible
            allBadges.forEach((badge) => {
              // Check if it's actually a notification badge (contains a number)
              if (
                badge.textContent &&
                /^[0-9+]+$/.test(badge.textContent.trim())
              ) {
                console.log("Found badge with content:", badge.textContent);
                // Forcefully show the badge with !important styles
                badge.style.cssText =
                  "display: inline-flex !important; visibility: visible !important; opacity: 1 !important";
                badge.classList.remove("hidden");

                // Check if badge is inside a chat link
                const chatLink = badge.closest('a[href*="/chats/"]');
                if (chatLink) {
                  const chatId = chatLink
                    .getAttribute("href")
                    .match(/\/chats\/(\d+)/)?.[1];
                  if (chatId) {
                    // Only show if not marked as read
                    if (
                      localStorage.getItem(`chat_${chatId}_read`) !== "true"
                    ) {
                      console.log(
                        `Forcing display of badge for chat ${chatId}`
                      );
                      badge.style.cssText =
                        "display: inline-flex !important; visibility: visible !important; opacity: 1 !important";
                    }
                  }
                }
              }
            });
          };

          // Run the fix immediately and periodically
          window.chromeBraveNotificationFix();
          window.chromeBraveNotificationFixInterval = setInterval(
            window.chromeBraveNotificationFix,
            200 // More frequent checks (was 2000)
          );

          // CRITICAL: Monitor DOM changes to instantly fix any new badges
          if (!window.badgeObserver) {
            window.badgeObserver = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (
                  mutation.type === "childList" &&
                  mutation.addedNodes.length > 0
                ) {
                  // Check if any badges were added
                  setTimeout(window.chromeBraveNotificationFix, 10);
                }
              });
            });

            // Start observing the document for badge changes
            window.badgeObserver.observe(document.body, {
              childList: true,
              subtree: true,
            });

            console.log("Started aggressive badge monitoring for Chrome/Brave");
          }
        }

        // Dispatch a custom event that our chat can listen for
        document.dispatchEvent(new CustomEvent("action-cable-connected"));
      });

      consumer.connection.addEventListener("disconnected", () => {
        console.log("🔴 ActionCable disconnected");
        window.actionCableConnected = false;

        // Force immediate reconnection for Chrome/Brave
        if ((isChrome || isBrave) && consumer.connection) {
          console.log(
            "🔄 Forcing immediate reconnection for Chrome/Brave after disconnect"
          );
          setTimeout(() => {
            try {
              consumer.connection.reconnect();
            } catch (e) {
              console.error("Error during disconnect reconnection:", e);

              // If that fails, try reopening
              setTimeout(() => {
                try {
                  consumer.connection.reopen();
                } catch (e) {
                  console.error("Error during reopen:", e);
                }
              }, 500);
            }
          }, 100);
        }
      });

      consumer.connection.addEventListener("rejected", () => {
        console.log("❌ ActionCable connection rejected");
        window.actionCableConnected = false;
      });
    }

    return consumer;
  } catch (error) {
    console.error("❌ Error creating ActionCable consumer:", error);
    // Fall back to basic consumer
    return createConsumer();
  }
};

export default createResilientConsumer();
