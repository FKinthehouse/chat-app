// Chat member management functionality

document.addEventListener("DOMContentLoaded", initMemberManagement);
document.addEventListener("turbo:load", initMemberManagement);

function initMemberManagement() {
  console.log("Initializing member management");

  // Add member form toggle
  const addMemberButton = document.getElementById("add-member-button");
  const addMemberForm = document.getElementById("add-member-form");
  const cancelAddButton = document.getElementById("cancel-add-button");

  if (addMemberButton) {
    addMemberButton.addEventListener("click", function () {
      console.log("Add member button clicked");
      addMemberForm.classList.remove("hidden");
      addMemberButton.classList.add("hidden");
    });
  }

  if (cancelAddButton) {
    cancelAddButton.addEventListener("click", function () {
      console.log("Cancel add button clicked");
      addMemberForm.classList.add("hidden");
      addMemberButton.classList.remove("hidden");
    });
  }
}
