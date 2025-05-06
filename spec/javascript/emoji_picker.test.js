/**
 * @jest-environment jsdom
 */

// Import the module to test - adjust the path if needed
const emojiModule = require("../../app/javascript/channels/chat_channel");

describe("Emoji Picker", () => {
  // Set up DOM for each test
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="chat-container" data-chat-id="123"></div>
      <form id="message-form">
        <input id="message_content" type="text" value="">
        <button type="submit">Send</button>
      </form>
    `;
  });

  // Clean up after tests
  afterEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  describe("initializeEmojiPicker", () => {
    it("creates an emoji button when initialized", () => {
      // Call the function
      emojiModule.initializeEmojiPicker();

      // Check if button was created
      const emojiButton = document.getElementById("emoji-button");
      expect(emojiButton).not.toBeNull();
    });

    it("creates a panel with emojis", () => {
      // Call the function
      emojiModule.initializeEmojiPicker();

      // Check if panel was created
      const emojiPanel = document.getElementById("simple-emoji-panel");
      expect(emojiPanel).not.toBeNull();
    });
  });

  describe("Emoji selection", () => {
    it("inserts emoji when clicked", () => {
      // Initialize
      emojiModule.initializeEmojiPicker();

      // Get input element and set initial value
      const messageInput = document.getElementById("message_content");
      messageInput.value = "Hello ";

      // Get the first emoji in the panel
      const emojiPanel = document.getElementById("simple-emoji-panel");
      const firstEmoji = emojiPanel.querySelector("span");

      // Simulate click on emoji
      firstEmoji.click();

      // Check if emoji was added to the input
      expect(messageInput.value).toContain("Hello ");

      // Panel should be hidden after selection
      expect(emojiPanel.style.display).toBe("none");
    });
  });

  describe("Emoji panel toggle", () => {
    it("toggles panel visibility when emoji button is clicked", () => {
      // Initialize
      emojiModule.initializeEmojiPicker();

      // Get elements
      const emojiButton = document.getElementById("emoji-button");
      const emojiPanel = document.getElementById("simple-emoji-panel");

      // Initial state - panel should be hidden
      expect(emojiPanel.style.display).toBe("none");

      // Click the button
      emojiButton.click();

      // Panel should be visible
      expect(emojiPanel.style.display).toBe("flex");

      // Click again
      emojiButton.click();

      // Panel should be hidden again
      expect(emojiPanel.style.display).toBe("none");
    });
  });
});
