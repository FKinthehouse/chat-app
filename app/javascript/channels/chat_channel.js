import consumer from "./consumer";

document.addEventListener("turbo:load", () => {
  console.log("🔄 Turbo:load event fired - initializing chat functionality");
  initializeChatChannel();
  initializeEmojiPicker();
});

// Also initialize on DOMContentLoaded to catch all possible load scenarios
document.addEventListener("DOMContentLoaded", () => {
  console.log(
    "📄 DOMContentLoaded event fired - initializing chat functionality"
  );
  initializeChatChannel();
  initializeEmojiPicker();
});

// Add an event listener for our custom ActionCable connection event
document.addEventListener("action-cable-connected", function () {
  console.log("🔄 ActionCable connected event received - reinitializing chat");
  // When ActionCable reconnects, reinitialize chat channel
  initializeChatChannel();
  initializeEmojiPicker();
});

// For Chrome/Brave browsers, check if we need to manually fetch messages
document.addEventListener("visibilitychange", function () {
  if (!document.hidden && window.isChromeBrave) {
    console.log(
      "🔍 Chrome/Brave tab became visible - checking for missed messages"
    );
    fetchLatestMessages();
  }
});

// === Global Notifications Across All Chats ===
function initializeGlobalNotifications() {
  const metaChatIds = document.querySelector('meta[name="user-chat-ids"]');
  const metaUserId = document.querySelector('meta[name="current-user-id"]');
  if (!metaChatIds || !metaUserId) return;

  const currentUserId = metaUserId.content;
  const chatIds = metaChatIds.content.split(",").filter((id) => id);

  chatIds.forEach((chatId) => {
    consumer.subscriptions.create(
      { channel: "ChatChannel", id: chatId },
      {
        received(data) {
          // Skip own messages
          if (data.sender_id == currentUserId) return;

          // Parse message HTML to extract sender name and content
          const temp = document.createElement("div");
          temp.innerHTML = data.html;
          const sender =
            temp.querySelector(".message-user")?.textContent.trim() ||
            "New message";
          const content =
            temp.querySelector(".message-content")?.textContent.trim() || "";

          // Only show notifications when user is not on this chat page
          const currentChat =
            document.getElementById("chat-container")?.dataset.chatId;
          if (currentChat === chatId) return;

          // Request permission if needed
          if (Notification.permission === "default") {
            Notification.requestPermission();
          }
          if (Notification.permission === "granted") {
            new Notification(sender, {
              body: content,
              icon: "/icon.png",
              tag: `chat_notification_${chatId}`,
            });
          }
        },
      }
    );
  });
}

document.addEventListener("DOMContentLoaded", initializeGlobalNotifications);
// === End Global Notifications ===

function initializeChatChannel() {
  const chatContainer = document.getElementById("chat-container");

  if (chatContainer) {
    const chatId = chatContainer.dataset.chatId;
    console.log(`🔗 Initializing chat channel for chat ID: ${chatId}`);

    // Detect browser type for specialized handling
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isChrome =
      /chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent);
    const isBrave = isChrome && navigator.brave?.isBrave;

    // Store browser detection globally for use elsewhere
    window.isChromeBrave = isChrome || isBrave;

    console.log(
      `🌐 Browser detection in chat channel: Safari: ${isSafari}, Chrome: ${isChrome}, Brave: ${isBrave}`
    );

    // Global set to keep track of processed messages across page loads
    // This helps prevent duplicates caused by turbo
    if (!window.processedMessageIds) {
      window.processedMessageIds = new Set();
    }

    // Initialize typing users tracking
    if (!window.typingUsers) {
      window.typingUsers = new Map();
    }

    // Check if we already have a subscription to avoid duplicates
    if (window.currentChatSubscription) {
      console.log(
        "⚠️ Existing chat subscription found, cleaning up before creating new one"
      );
      consumer.subscriptions.remove(window.currentChatSubscription);
    }

    // Create and store the subscription
    window.currentChatSubscription = consumer.subscriptions.create(
      { channel: "ChatChannel", id: chatId },
      {
        connected() {
          console.log("✅ Connected to ChatChannel for chat ID:", chatId);
          this.scrollMessagesToBottom();

          // For Chrome/Brave, immediately request a ping to verify connection
          if (isChrome || isBrave) {
            console.log(
              "🔍 Chrome/Brave detected: Verifying connection with ping"
            );
            setTimeout(() => {
              try {
                this.perform("ping", {});
              } catch (e) {
                console.error("⚠️ Error sending ping on Chrome/Brave:", e);
              }
            }, 500);
          }
        },

        disconnected() {
          console.log("❌ Disconnected from ChatChannel");
        },

        received(data) {
          console.log("📩 Message received:", data);

          // Check if we've already processed this message using more reliable tracking
          if (data.message_id) {
            const messageKey = `${data.message_id}-${chatId}`;

            if (window.processedMessageIds.has(messageKey)) {
              console.log("🔄 Ignoring duplicate message:", messageKey);
              return;
            }

            // Add to processed list with a compound key of message_id and chat_id
            window.processedMessageIds.add(messageKey);
            console.log("✅ Added message to processed list:", messageKey);

            // Limit size to prevent memory issues
            if (window.processedMessageIds.size > 200) {
              // Remove the oldest entry
              const firstItem = window.processedMessageIds
                .values()
                .next().value;
              window.processedMessageIds.delete(firstItem);
            }
          }

          if (data.typing) {
            // Important: Log detailed typing data for debugging
            console.log("📝 Typing indicator received:", data);
            this.displayTypingIndicator(data);
          } else if (data.html) {
            // Always display messages intended for this user
            const currentUserId = document.body.dataset.currentUserId;
            console.log(
              `🧑‍💻 Current user ID: ${currentUserId}, Recipient ID: ${data.recipient_id}`
            );

            // Trust server-side broadcast filtering; do not skip any messages

            console.log("📝 Appending message to chat");
            this.appendMessage(data.html);
            this.scrollMessagesToBottom();
            this.notifyNewMessage(data);
          }
        },

        speak(message) {
          this.perform("speak", { message: message });
        },

        typing() {
          console.log("🖊️ User is typing, sending notification");
          try {
            this.perform("typing", {
              user_id: document.body.dataset.currentUserId,
              chat_id: chatId,
            });
          } catch (error) {
            console.error("Error sending typing notification:", error);
          }
        },

        appendMessage(messageHTML) {
          const messagesContainer = document.getElementById("messages");
          if (messagesContainer) {
            // Check if user is already at the bottom of the chat
            const isAtBottom = this.isUserAtBottom(messagesContainer);

            // Append the message
            messagesContainer.insertAdjacentHTML("beforeend", messageHTML);

            // Only auto-scroll if user was already at the bottom or if it's our own message
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = messageHTML;
            const messageId = tempDiv.querySelector(".message")?.id;

            // Check if this is the current user's message
            const isOwnMessage =
              tempDiv.querySelector(".message.flex.justify-end") !== null;

            if (isAtBottom || isOwnMessage) {
              // In Chrome/Brave, add extra delay to ensure rendering completes
              if (window.isChromeBrave) {
                setTimeout(() => this.scrollMessagesToBottom(), 50);
              } else {
                this.scrollMessagesToBottom();
              }
            } else {
              // Show "new messages" indicator
              this.showNewMessageIndicator();
            }
          }
        },

        scrollMessagesToBottom() {
          const messagesContainer = document.getElementById("messages");
          if (messagesContainer) {
            // Add smooth scroll behavior
            messagesContainer.style.scrollBehavior = "smooth";

            // Force a complete scroll to the very bottom with stronger timing for Chrome/Brave
            // Using longer timeouts to ensure rendering is complete
            const delay = window.isChromeBrave ? 100 : 10;

            setTimeout(() => {
              const scrollHeight = messagesContainer.scrollHeight;
              messagesContainer.scrollTop = scrollHeight + 2000; // More pixels to ensure we're at the bottom

              // Additional scroll checks with increasing timeouts
              const delays = window.isChromeBrave
                ? [50, 150, 300, 500]
                : [50, 100];

              delays.forEach((ms) => {
                setTimeout(() => {
                  if (messagesContainer) {
                    messagesContainer.scrollTop =
                      messagesContainer.scrollHeight + 2000;
                  }
                }, ms);
              });
            }, delay);

            // Reset scroll behavior after animation
            setTimeout(() => {
              if (messagesContainer) {
                messagesContainer.style.scrollBehavior = "auto";
              }
            }, 600);
          }
        },

        isUserAtBottom(container) {
          // Check if the user is already at the bottom (within 100px)
          const scrollPosition = container.scrollTop + container.clientHeight;
          const scrollThreshold = container.scrollHeight - 100;
          return scrollPosition >= scrollThreshold;
        },

        showNewMessageIndicator() {
          // Create or get new message indicator
          let indicator = document.getElementById("new-message-indicator");

          if (!indicator) {
            indicator = document.createElement("div");
            indicator.id = "new-message-indicator";
            indicator.className =
              "fixed bottom-24 right-8 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg cursor-pointer z-50 animate-bounce";
            indicator.innerHTML = "New messages ↓";
            indicator.onclick = () => this.scrollMessagesToBottom();
            document.body.appendChild(indicator);

            // Auto-hide after 5 seconds
            setTimeout(() => {
              if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
              }
            }, 5000);
          }
        },

        displayTypingIndicator(data) {
          console.log("🔤 Display typing indicator for:", data.user_name);
          const typingIndicator = document.getElementById("typing-indicator");

          if (typingIndicator) {
            const currentUserId = document.body.dataset.currentUserId;

            if (data.user_id != currentUserId) {
              // Store the typing user with timestamp
              if (!window.typingUsers) {
                window.typingUsers = new Map();
              }

              window.typingUsers.set(data.user_id, {
                name: data.user_name,
                timestamp: Date.now(),
              });

              // Update typing indicator text with all current users
              this.updateTypingIndicatorText(typingIndicator);

              // Hide the typing indicator after 3 seconds of inactivity
              clearTimeout(this.typingTimeout);
              this.typingTimeout = setTimeout(() => {
                // Remove this user from typing list
                window.typingUsers.delete(data.user_id);

                // If no one is typing, hide indicator
                if (window.typingUsers.size === 0) {
                  typingIndicator.classList.add("hidden");
                } else {
                  // Otherwise update with remaining typing users
                  this.updateTypingIndicatorText(typingIndicator);
                }
              }, 3000);
            }
          } else {
            console.warn("⚠️ Typing indicator element not found in the DOM");
          }
        },

        updateTypingIndicatorText(typingIndicator) {
          // Get all typing users
          const typingUserNames = Array.from(window.typingUsers.values()).map(
            (user) => user.name
          );

          // Clean up stale typing indicators (older than 3 seconds)
          const now = Date.now();
          window.typingUsers.forEach((userData, userId) => {
            if (now - userData.timestamp > 3000) {
              window.typingUsers.delete(userId);
            }
          });

          // Create appropriate typing message
          let typingMessage = "";
          if (typingUserNames.length === 1) {
            // One user typing
            typingMessage = `${typingUserNames[0]} is typing<span class="typing-dots">...</span>`;
          } else if (typingUserNames.length === 2) {
            // Two users typing
            typingMessage = `${typingUserNames[0]} and ${typingUserNames[1]} are typing<span class="typing-dots">...</span>`;
          } else if (typingUserNames.length > 2) {
            // More than two users typing
            const othersCount = typingUserNames.length - 2;
            typingMessage = `${typingUserNames[0]}, ${typingUserNames[1]} and ${othersCount} more are typing<span class="typing-dots">...</span>`;
          }

          // Update indicator text and show it
          if (typingMessage) {
            typingIndicator.innerHTML = typingMessage;
            typingIndicator.classList.remove("hidden");
            typingIndicator.style.display = "block";
            typingIndicator.style.opacity = "1";
          }
        },

        shouldShowNotification() {
          // Use the global function from status_manager.js if available
          if (window.shouldShowNotifications) {
            return window.shouldShowNotifications();
          }

          // Fall back to the previous implementation
          const currentStatus = document
            .getElementById("current-status")
            ?.textContent.trim();

          // Don't show notifications when status is "Do not disturb"
          if (currentStatus === "Do not disturb") {
            console.log(
              "Not showing notification because user status is 'Do not disturb'"
            );
            return false;
          }

          return true;
        },

        notifyNewMessage(data) {
          console.log("📢 Preparing to notify for new message:", data);

          // Store message info for badge display
          const chatContainer = document.getElementById("chat-container");
          const chatId = chatContainer?.dataset.chatId;

          // Add explicit support for group messages
          const isGroupChat = data.is_group_chat;
          console.log(
            `Message is for ${
              isGroupChat ? "group chat" : "direct chat"
            }: ${chatId}`
          );

          if (chatId) {
            // CHROME/BRAVE CRITICAL FIX: Force badge update in session and localStorage
            localStorage.setItem(`chat_${chatId}_unread`, "true");
            sessionStorage.setItem(`chat_${chatId}_unread`, "true");

            // Ensure we mark group chats too
            if (isGroupChat) {
              localStorage.setItem(`group_${chatId}_unread`, "true");
              sessionStorage.setItem(`group_${chatId}_unread`, "true");
            }

            // Store the time to ensure we can detect truly new messages
            const messageTimestamp = Date.now();
            localStorage.setItem(
              `chat_${chatId}_last_message`,
              messageTimestamp.toString()
            );

            console.log(`💾 Stored unread status for chat ${chatId}`);

            // If this is Chrome/Brave, use optimized approach
            if (window.isChromeOrBrave) {
              // Force update badges immediately
              forceUpdateBadgesInChrome(chatId);

              // CRITICAL FIX FOR CHROME: Try notification with permission check first
              if (Notification.permission === "granted") {
                // Use the faster direct notification creation approach
                this.createFastNotification(data);
              } else if (Notification.permission !== "denied") {
                // Request permission and then show notification
                Notification.requestPermission().then((permission) => {
                  if (permission === "granted") {
                    this.createFastNotification(data);
                  }
                });
              }
            }
          }

          // Determine if this is a message that requires notification
          const shouldShowDesktopNotification = this.shouldShowNotification();
          // Skip notifications for own messages
          const isOwnMessage =
            data.sender_id == document.body.dataset.currentUserId;

          if (shouldShowDesktopNotification && !isOwnMessage) {
            try {
              // Standard notification path - skipped for Chrome/Brave which uses the fast path
              if (!window.isChromeOrBrave) {
                this.createNotification(data);
              }
            } catch (e) {
              console.error("Error creating notification:", e);
            }
          }

          // Update unread count and badge even if we don't show notification
          if (!isOwnMessage && document.hidden) {
            // Update our unread counter
            let currentCount = parseInt(
              localStorage.getItem("unread_messages") || "0"
            );
            currentCount += 1;
            localStorage.setItem("unread_messages", currentCount.toString());

            // Also increment the specific chat unread count
            if (chatId) {
              let chatUnreadCount = parseInt(
                localStorage.getItem(`chat_${chatId}_unread_count`) || "0"
              );
              chatUnreadCount += 1;
              localStorage.setItem(
                `chat_${chatId}_unread_count`,
                chatUnreadCount.toString()
              );

              // Remove the 'read' flag since there are new messages
              localStorage.removeItem(`chat_${chatId}_read`);
            }

            // Update tab favicon to show unread messages
            this.updateTabBadge(currentCount);

            // When window gets focus, reset counters
            window.addEventListener("focus", function onFocus() {
              localStorage.removeItem("unread_messages");
              window.removeEventListener("focus", onFocus);
            });
          }
        },

        // Fast notification function optimized for Chrome/Brave
        createFastNotification(data) {
          // Extract user name from message HTML if possible
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = data.html;

          const senderName =
            tempDiv.querySelector(".message-user")?.textContent.trim() ||
            "New message";
          const messageContent =
            tempDiv.querySelector(".message-content")?.textContent.trim() || "";

          try {
            // Create a notification with minimal processing
            const notificationOptions = {
              body: `${senderName}: ${messageContent}`,
              icon: "/icon.png",
              tag: "chat-message-" + Date.now(), // Use unique tag
              requireInteraction: false, // Don't require interaction for faster display
              silent: false,
            };

            // Create and show notification immediately
            const notification = new Notification(
              "New Message",
              notificationOptions
            );

            // Set up a simple click handler
            notification.onclick = () => {
              window.focus();
              notification.close();
            };

            // Auto-close after 5 seconds
            setTimeout(() => notification.close(), 5000);

            // Try to play notification sound
            this.playNotificationSound();
          } catch (e) {
            console.error("Fast notification creation failed:", e);
          }
        },

        // Special method for Chrome/Brave to force badge updating
        forceUpdateBadgesInChrome(chatId) {
          if (!window.isChromeOrBrave) return;

          console.log(
            `🔔 Force updating Chrome/Brave badges for chat ${chatId}`
          );

          // Find existing badge for this chat - add support for group chats
          const chatLink = document.querySelector(
            `a[href*="/chats/${chatId}"]`
          );
          if (!chatLink) {
            console.log(
              `No link found for chat ${chatId}, looking for group links`
            );

            // Try finding group chat links
            document.querySelectorAll('a[href*="/chats/"]').forEach((link) => {
              const href = link.getAttribute("href");
              console.log(`Checking link: ${href}`);
              if (href && href.includes(`/chats/${chatId}`)) {
                updateBadge(link);
              }
            });

            return;
          }

          updateBadge(chatLink);

          function updateBadge(chatLink) {
            // Look for an existing badge
            let badge = chatLink.querySelector(".ml-2.bg-red-500");

            // If no badge exists, we need to create one
            if (!badge) {
              const badgeHTML = `<span class="ml-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">1</span>`;

              // Try different approaches to find where to place the badge
              const h3 = chatLink.querySelector("h3");
              const title =
                chatLink.querySelector(".font-medium") ||
                chatLink.querySelector(".text-gray-900");

              if (h3) {
                h3.insertAdjacentHTML("beforeend", badgeHTML);
              } else if (title) {
                title.insertAdjacentHTML("beforeend", badgeHTML);
              } else {
                chatLink.insertAdjacentHTML("beforeend", badgeHTML);
              }

              badge = chatLink.querySelector(".ml-2.bg-red-500");
            }

            // Update badge count or create it
            if (badge) {
              // Get current count
              let count = parseInt(badge.textContent.trim()) || 0;
              count += 1;
              badge.textContent = count > 9 ? "9+" : count.toString();

              // Force display with !important styles
              badge.style.cssText =
                "display: inline-flex !important; visibility: visible !important; opacity: 1 !important";
              badge.classList.remove("hidden");

              console.log(`Updated badge count to ${count} for chat ${chatId}`);
            }
          }
        },

        createNotification(data) {
          // Extract user name from message HTML if possible
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = data.html;

          const senderName =
            tempDiv.querySelector(".message-user")?.textContent.trim() ||
            "New message";
          const messageContent =
            tempDiv.querySelector(".message-content")?.textContent.trim() || "";

          try {
            // For Chrome/Brave, use a more direct notification method
            if (window.isChromeBrave) {
              console.log("🔔 Creating notification for Chrome/Brave");

              // Prepare the notification options in advance for faster creation
              const notificationOptions = {
                body: `${senderName}: ${messageContent}`,
                icon: "/icon.png",
                tag: "chat-message-" + Date.now(), // Use unique tag to ensure new notification
                renotify: true,
                requireInteraction: true,
                silent: false,
              };

              // Create browser notification immediately
              const notification = new Notification(
                "Chat App",
                notificationOptions
              );

              // Set up click handler
              notification.onclick = function () {
                console.log("🔔 Notification clicked");
                window.focus();
                this.close();

                // For Chrome/Brave, force a message check when notification is clicked
                if (window.isChromeBrave) {
                  fetchLatestMessages();
                }
              };

              // Close notification after 10 seconds
              setTimeout(() => {
                notification.close();
              }, 10000);
            } else {
              // Regular notification for other browsers
              const notification = new Notification("Chat App", {
                body: `${senderName}: ${messageContent}`,
                icon: "/icon.png",
              });

              // Close notification after 5 seconds
              setTimeout(() => {
                notification.close();
              }, 5000);

              // Focus on chat window when notification is clicked
              notification.onclick = function () {
                window.focus();
                this.close();
              };
            }
          } catch (e) {
            console.error("Error creating notification:", e);
          }
        },

        playNotificationSound() {
          // Special handling for Chrome/Brave - they require user interaction before playing audio
          const isChrome =
            /chrome/i.test(navigator.userAgent) &&
            !/edge/i.test(navigator.userAgent);
          const isBrave = isChrome && navigator.brave?.isBrave;

          // Create audio element
          const audio = new Audio();
          audio.src = "/notification.mp3"; // Make sure you have this file in public folder
          audio.volume = 0.5; // Lower volume for Chrome/Brave

          // Handle browsers that require user interaction
          if (isChrome || isBrave) {
            // For Chrome/Brave, we need to handle the potential rejection
            console.log(
              "🔊 Attempting to play notification sound on Chrome/Brave"
            );
            const playPromise = audio.play();

            if (playPromise !== undefined) {
              playPromise.catch((error) => {
                console.log("🔇 Chrome/Brave audio play failed:", error);
                // Store that we wanted to play a sound - will use this in future user interactions
                window.pendingNotificationSounds = true;
              });
            }
          } else {
            // For other browsers, just play normally
            audio.play().catch((error) => {
              console.log("Audio play failed:", error);
            });
          }
        },

        // Add a ping method for Chrome/Brave connection verification
        ping() {
          this.perform("ping", {});
        },

        // Helper to get chat ID from the page
        getChatId() {
          // Try to get from the container element
          const chatContainer = document.getElementById("chat-container");
          if (chatContainer && chatContainer.dataset.chatId) {
            return chatContainer.dataset.chatId;
          }

          // Try to extract from URL
          const chatIdMatch = window.location.pathname.match(/\/chats\/(\d+)/);
          if (chatIdMatch && chatIdMatch[1]) {
            return chatIdMatch[1];
          }

          // Return from identifier as fallback
          const identifier = JSON.parse(this.identifier);
          return identifier.id;
        },
      }
    );

    // For Chrome/Brave, set up a timer to verify the connection is still active
    if (isChrome || isBrave) {
      console.log("⏱️ Setting up Chrome/Brave connection verification timer");

      // Clear any existing interval
      if (window.chromeConnectionTimer) {
        clearInterval(window.chromeConnectionTimer);
      }

      // Check every 30 seconds if connection is still alive
      window.chromeConnectionTimer = setInterval(() => {
        if (window.currentChatSubscription) {
          try {
            console.log("🔍 Chrome/Brave connection check...");
            window.currentChatSubscription.ping();
          } catch (e) {
            console.error("⚠️ Chrome/Brave connection check failed:", e);

            // Try to reconnect
            console.log("🔄 Attempting to reconnect for Chrome/Brave...");
            if (consumer && consumer.connection) {
              consumer.connection.reopen();
            }
          }
        }
      }, 30000);

      // Handle page visibility changes for Chrome/Brave
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && (isChrome || isBrave)) {
          console.log(
            "📱 Page became visible in Chrome/Brave - verifying connection"
          );

          // When page becomes visible again, verify the connection
          setTimeout(() => {
            if (window.currentChatSubscription) {
              try {
                window.currentChatSubscription.ping();
              } catch (e) {
                console.log(
                  "⚠️ Connection verification on visibility change failed:",
                  e
                );

                // If ping fails, try to reconnect
                if (consumer && consumer.connection) {
                  consumer.connection.reopen();
                }
              }
            }
          }, 1000);

          // Try to play any pending notification sounds now that we have user interaction
          if (window.pendingNotificationSounds) {
            const audio = new Audio();
            audio.src = "/notification.mp3";
            audio.volume = 0.3;
            audio
              .play()
              .catch((e) => console.log("Still can't play audio:", e));
            window.pendingNotificationSounds = false;
          }
        }
      });
    }

    // Handle message form submission
    const messageForm = document.getElementById("message-form");
    if (messageForm) {
      messageForm.addEventListener("submit", (e) => {
        const messageInput = document.getElementById("message_content");
        if (messageInput.value.trim() === "") {
          e.preventDefault();
          return false;
        }
      });

      // Improved typing event handling
      const messageInput = document.getElementById("message_content");
      let typingTimer;
      let lastTypingTime = 0;

      messageInput.addEventListener("input", () => {
        const now = Date.now();
        clearTimeout(typingTimer);

        // Only send typing notification if enough time has passed since last one
        if (now - lastTypingTime > 2000) {
          lastTypingTime = now;

          if (window.currentChatSubscription) {
            console.log("📤 Sending typing notification");
            window.currentChatSubscription.typing();
          } else {
            console.warn("⚠️ Chat subscription not found for typing");
          }
        }

        typingTimer = setTimeout(() => {
          // Stop typing event
        }, 1000);
      });
    }

    // Create typing indicator div if it doesn't exist
    if (!document.getElementById("typing-indicator")) {
      const messagesContainer = document.getElementById("messages");
      if (messagesContainer) {
        const typingIndicator = document.createElement("div");
        typingIndicator.id = "typing-indicator";
        typingIndicator.className = "text-gray-500 text-sm pl-4 italic hidden";
        typingIndicator.style.cssText =
          "margin-top: 8px; margin-bottom: 8px; font-style: italic; color: #6b7280;";
        messagesContainer.parentNode.insertBefore(
          typingIndicator,
          messagesContainer.nextSibling
        );
      }
    }
  }
}

// Function to manually fetch the latest messages for Chrome/Brave
function fetchLatestMessages() {
  const chatContainer = document.getElementById("chat-container");
  if (!chatContainer) return;

  const chatId = chatContainer.dataset.chatId;
  if (!chatId) return;

  console.log("📥 Fetching latest messages for chat ID:", chatId);

  // Make an AJAX request to get the latest messages
  fetch(`/chats/${chatId}/latest_messages`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      console.log("📦 Received latest messages:", data.messages.length);

      if (data.messages && data.messages.length > 0) {
        // Get the current messages
        const messagesContainer = document.getElementById("messages");
        if (!messagesContainer) return;

        // Get current message IDs to avoid duplicates
        const currentMessageIds = new Set();
        document.querySelectorAll(".message").forEach((msgEl) => {
          const id = msgEl.id.replace("message-", "");
          if (id) currentMessageIds.add(id);
        });

        // Append any new messages
        let newMessagesAdded = false;
        data.messages.forEach((message) => {
          if (!currentMessageIds.has(message.id.toString())) {
            messagesContainer.insertAdjacentHTML("beforeend", message.html);
            newMessagesAdded = true;
            console.log("➕ Added missed message:", message.id);
          }
        });

        // Scroll to bottom if new messages were added
        if (newMessagesAdded) {
          scrollMessagesToBottom();
        }
      }
    })
    .catch((error) => {
      console.error("Error fetching latest messages:", error);
    });
}

// Global scroll function
function scrollMessagesToBottom() {
  const messagesContainer = document.getElementById("messages");
  if (messagesContainer) {
    messagesContainer.style.scrollBehavior = "smooth";
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight + 1000;
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight + 1000;
      }, 50);
    }, 10);
  }
}

// Updated emoji picker function with simple fallback panel
function initializeEmojiPicker() {
  console.log("🙂 Initializing emoji picker");

  // Only proceed if we're on a page with a message form
  const messageForm = document.getElementById("message-form");
  if (!messageForm) return;

  // Define a set of common emojis for the simple picker
  const commonEmojis = [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "🤣",
    "😂",
    "🙂",
    "🙃",
    "😉",
    "😊",
    "😇",
    "😍",
    "🥰",
    "😘",
    "😗",
    "☺️",
    "😚",
    "😙",
    "👍",
    "👎",
    "❤️",
    "🔥",
    "😎",
    "🥳",
    "😭",
    "😡",
    "👏",
    "🙏",
    "🤔",
    "🤯",
    "😱",
    "🥺",
    "😳",
    "🤪",
    "😴",
    "🤮",
    "🤦‍♂️",
    "💪",
  ];

  // Helper function to create a simple emoji picker
  function createSimpleEmojiPicker() {
    // Skip if button already exists
    if (document.getElementById("emoji-button")) return;

    console.log("Creating simple emoji picker");

    const messageInput = document.getElementById("message_content");
    if (!messageInput) return;

    // Create emoji button
    const emojiButton = document.createElement("button");
    emojiButton.id = "emoji-button";
    emojiButton.type = "button";
    emojiButton.className = "emoji-button-visible";
    emojiButton.innerHTML = "😀";
    emojiButton.style.cssText =
      "position: absolute; right: 66px; bottom: 10px; width: 36px; height: 36px; font-size: 20px; background: #e0e7ff; border-radius: 50%; border: 2px solid #4f46e5; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 1000;";

    // Insert directly next to the message input
    messageInput.parentNode.style.position = "relative";
    messageInput.parentNode.appendChild(emojiButton);

    // Create simple emoji panel
    const emojiPanel = document.createElement("div");
    emojiPanel.id = "simple-emoji-panel";
    emojiPanel.style.cssText =
      "position: fixed; bottom: 70px; right: 90px; width: 300px; height: auto; max-height: 200px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; display: none; padding: 10px; overflow-y: auto; flex-wrap: wrap; justify-content: center;";

    // Populate with common emojis
    commonEmojis.forEach((emoji) => {
      const emojiSpan = document.createElement("span");
      emojiSpan.textContent = emoji;
      emojiSpan.style.cssText =
        "font-size: 24px; margin: 5px; cursor: pointer; display: inline-block; width: 36px; height: 36px; text-align: center; line-height: 36px; border-radius: 5px; transition: background-color 0.2s;";

      // Hover effect
      emojiSpan.addEventListener("mouseover", () => {
        emojiSpan.style.backgroundColor = "#f3f4f6";
      });

      emojiSpan.addEventListener("mouseout", () => {
        emojiSpan.style.backgroundColor = "transparent";
      });

      // Click handler to insert emoji
      emojiSpan.addEventListener("click", () => {
        // Insert at cursor position
        const cursorPos = messageInput.selectionStart;
        const text = messageInput.value;
        const newText =
          text.substring(0, cursorPos) + emoji + text.substring(cursorPos);

        messageInput.value = newText;
        messageInput.focus();
        messageInput.selectionStart = cursorPos + emoji.length;
        messageInput.selectionEnd = cursorPos + emoji.length;

        // Hide panel
        emojiPanel.style.display = "none";

        // Trigger input event for typing indicator
        messageInput.dispatchEvent(new Event("input"));
      });

      emojiPanel.appendChild(emojiSpan);
    });

    document.body.appendChild(emojiPanel);

    // Toggle emoji panel
    emojiButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("Emoji button clicked");

      if (
        emojiPanel.style.display === "none" ||
        emojiPanel.style.display === ""
      ) {
        emojiPanel.style.display = "flex";
      } else {
        emojiPanel.style.display = "none";
      }
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
      if (
        e.target !== emojiButton &&
        !emojiButton.contains(e.target) &&
        e.target !== emojiPanel &&
        !emojiPanel.contains(e.target)
      ) {
        emojiPanel.style.display = "none";
      }
    });

    console.log("Simple emoji picker created");
  }

  // Just use our simple emoji picker which is guaranteed to work
  createSimpleEmojiPicker();
}

// Create a direct link to the module to ensure it's loaded
document.addEventListener("DOMContentLoaded", () => {
  // Create a script element to load the emoji picker module directly
  const script = document.createElement("script");
  script.src =
    "https://cdn.jsdelivr.net/npm/emoji-picker-element@1.26.3/index.js";
  script.async = true;
  script.onload = () => {
    console.log("Emoji picker script loaded from CDN");
  };
  document.head.appendChild(script);
});

// Add this event listener to listen for the first user interaction
document.addEventListener(
  "click",
  function enableAudio() {
    // Set a flag for user interaction
    document.documentElement.setAttribute("data-user-interacted", "true");

    // Try to play a silent sound to enable audio
    try {
      const silentSound = new Audio(
        "data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU="
      );
      silentSound
        .play()
        .catch((e) => console.log("Silent sound failed but that's OK"));
    } catch (e) {
      console.log("Silent sound error:", e);
    }

    document.removeEventListener("click", enableAudio);
  },
  { once: true }
);

// Always create typing indicator when needed
document.addEventListener("DOMContentLoaded", createTypingIndicator);
document.addEventListener("turbo:load", createTypingIndicator);
document.addEventListener("turbo:frame-load", createTypingIndicator);

function createTypingIndicator() {
  // Ensure there's a typing indicator
  if (!document.getElementById("typing-indicator")) {
    console.log("Creating typing indicator element");
    const messagesContainer = document.getElementById("messages");
    if (messagesContainer) {
      const typingIndicator = document.createElement("div");
      typingIndicator.id = "typing-indicator";
      typingIndicator.className = "text-gray-500 text-sm pl-4 italic";
      typingIndicator.style.cssText =
        "margin-top: 8px; margin-bottom: 8px; font-style: italic; color: #6b7280; display: none;";
      messagesContainer.parentNode.insertBefore(
        typingIndicator,
        messagesContainer.nextSibling
      );
    }
  }
}

// Also add typing dots animation style if needed
function addTypingDotsStyle() {
  if (!document.getElementById("typing-dots-style")) {
    const style = document.createElement("style");
    style.id = "typing-dots-style";
    style.textContent = `
      @keyframes typingDots {
        0% { opacity: 0.3; }
        50% { opacity: 1; }
        100% { opacity: 0.3; }
      }
      .typing-dots {
        display: inline-block;
        animation: typingDots 1.4s infinite;
        margin-left: 2px;
        letter-spacing: 2px;
        font-weight: bold;
      }
      #typing-indicator {
        transition: opacity 0.3s ease;
      }
      #typing-indicator.hidden {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

document.addEventListener("DOMContentLoaded", addTypingDotsStyle);
document.addEventListener("turbo:load", addTypingDotsStyle);

// Fix typing events on the input
function setupTypingEvents() {
  const messageInput = document.getElementById("message_content");
  if (!messageInput) return;

  console.log("Setting up typing event listeners");

  let typingTimer;
  let lastTypingTime = 0;

  messageInput.addEventListener("input", () => {
    const now = Date.now();
    clearTimeout(typingTimer);

    // Only send typing notification if enough time has passed
    if (now - lastTypingTime > 1000) {
      lastTypingTime = now;

      if (window.currentChatSubscription) {
        console.log("📤 Sending typing notification");
        window.currentChatSubscription.typing();
      } else {
        console.warn("⚠️ Chat subscription not found for typing");
      }
    }

    typingTimer = setTimeout(() => {
      // Typing stopped
      console.log("User stopped typing");
    }, 1000);
  });
}

// Apply typing event setup when page loads
document.addEventListener("DOMContentLoaded", setupTypingEvents);
document.addEventListener("turbo:load", setupTypingEvents);
document.addEventListener("turbo:frame-load", setupTypingEvents);
