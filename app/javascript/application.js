// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import "@hotwired/turbo-rails";
import "controllers";
import "channels";
import "status_manager";
import "status_sync";

// Add this to handle chat button functionality across the app
document.addEventListener("turbo:load", function () {
  console.log("Turbo Load event fired - initializing UI components");

  // Initialize chat form controls
  const newChatButton = document.getElementById("new-chat-button");
  if (newChatButton) {
    console.log("New Chat button found - adding event listener");
    newChatButton.addEventListener("click", function () {
      console.log("New Chat button clicked");
      const newChatForm = document.getElementById("new-chat-form");
      if (newChatForm) {
        newChatForm.classList.remove("hidden");
        newChatButton.classList.add("hidden");
      } else {
        console.error("New Chat form not found");
      }
    });
  }
});
