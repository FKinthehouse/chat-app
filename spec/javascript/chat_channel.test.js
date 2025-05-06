/**
 * @jest-environment jsdom
 */

// Mock imports
jest.mock("../../app/javascript/channels/consumer", () => ({
  subscriptions: {
    create: jest.fn().mockReturnValue({
      connected: jest.fn(),
      disconnected: jest.fn(),
      received: jest.fn(),
      speak: jest.fn(),
      typing: jest.fn(),
    }),
  },
}));

// Import the module to test
const chatModule = require("../../app/javascript/channels/chat_channel");

describe("Chat Channel", () => {
  // Set up DOM before each test
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="chat-container" data-chat-id="123"></div>
      <div id="messages"></div>
      <div id="typing-indicator" class="hidden"></div>
      <form id="message-form">
        <input id="message_content" type="text">
        <button type="submit">Send</button>
      </form>
    `;

    // Set up body dataset
    document.body.dataset.currentUserId = "1";

    // Create global variables
    global.window = Object.create(window);
    global.window.processedMessageIds = new Set();
    global.window.typingUsers = new Map();
    global.window.isChromeBrave = false;

    // Mock Notification API
    global.Notification = {
      permission: "granted",
      requestPermission: jest.fn().mockResolvedValue("granted"),
    };
    global.Notification.prototype = {
      close: jest.fn(),
    };
    global.Notification = jest.fn(() => ({
      onclick: null,
      close: jest.fn(),
    }));
  });

  // Clean up after tests
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initializeChatChannel", () => {
    it("initializes a chat channel with proper parameters", () => {
      // Call the function
      chatModule.initializeChatChannel();

      // Check if consumer.subscriptions.create was called with correct params
      expect(consumer.subscriptions.create).toHaveBeenCalledWith(
        { channel: "ChatChannel", id: "123" },
        expect.any(Object)
      );
    });
  });

  describe("notifyNewMessage", () => {
    it("shows notification for other users messages", () => {
      // Set up data object
      const data = {
        html: '<div class="message"><span class="message-user">Bob</span><div class="message-content">Hello!</div></div>',
        sender_id: "2", // Different from current user ID
        is_group_chat: false,
      };

      // Call the function
      chatModule.notifyNewMessage(data);

      // Check if notification was created
      expect(global.Notification).toHaveBeenCalled();
    });

    it("does not show notification for own messages", () => {
      // Set up data for own message
      const data = {
        html: '<div class="message"><span class="message-user">Alice</span><div class="message-content">Hi!</div></div>',
        sender_id: "1", // Same as current user ID
        is_group_chat: false,
      };

      // Call the function
      chatModule.notifyNewMessage(data);

      // Check no notification was created
      expect(global.Notification).not.toHaveBeenCalled();
    });

    it("shows notification for group chat messages", () => {
      // Set up data for group message
      const data = {
        html: '<div class="message"><span class="message-user">Bob</span><div class="message-content">Team update!</div></div>',
        sender_id: "2",
        is_group_chat: true,
      };

      // Call the function
      chatModule.notifyNewMessage(data);

      // Check notification was created for group message
      expect(global.Notification).toHaveBeenCalled();
    });
  });

  describe("initializeGlobalNotifications", () => {
    beforeEach(() => {
      // Add meta tags for testing global notifications
      document.head.innerHTML = `
        <meta name="current-user-id" content="1">
        <meta name="user-chat-ids" content="10,20,30">
      `;
    });

    it("subscribes to all user chats", () => {
      // Call the function
      chatModule.initializeGlobalNotifications();

      // Should create subscriptions for all chat IDs
      expect(consumer.subscriptions.create).toHaveBeenCalledTimes(3);
      expect(consumer.subscriptions.create).toHaveBeenCalledWith(
        { channel: "ChatChannel", id: "10" },
        expect.any(Object)
      );
      expect(consumer.subscriptions.create).toHaveBeenCalledWith(
        { channel: "ChatChannel", id: "20" },
        expect.any(Object)
      );
      expect(consumer.subscriptions.create).toHaveBeenCalledWith(
        { channel: "ChatChannel", id: "30" },
        expect.any(Object)
      );
    });
  });
});
