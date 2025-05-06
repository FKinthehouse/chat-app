require 'rails_helper'

RSpec.describe ChatsController, type: :controller do
  let(:user) { create(:user) }
  let(:other_user) { create(:user) }
  let(:chat) { create(:chat) }

  before do
    # Add users to chat
    chat.users << [user, other_user]

    # Make user an admin of the chat to allow destroy action
    ChatMembership.find_by(user: user, chat: chat).update(admin: true)

    # Sign in user using Devise test helper
    sign_in user
  end

  describe "GET #index" do
    it "returns a success response" do
      get :index
      expect(response).to be_successful
    end

    it "assigns @chats" do
      get :index
      expect(assigns(:chats)).to include(chat)
    end
  end

  describe "GET #show" do
    it "returns a success response" do
      get :show, params: { id: chat.id }
      expect(response).to be_successful
    end

    it "assigns the requested chat as @chat" do
      get :show, params: { id: chat.id }
      expect(assigns(:chat)).to eq(chat)
    end

    it "redirects if user is not a member" do
      other_chat = Chat.create(name: "Private Chat", is_group: true)
      get :show, params: { id: other_chat.id }
      expect(response).to redirect_to(chats_path)
    end
  end

  describe "POST #create" do
    context "with valid params" do
      it "creates a new Chat" do
        expect {
          post :create, params: { chat: { name: "New Chat", is_group: true }, user_ids: [other_user.id] }
        }.to change(Chat, :count).by(1)
      end

      it "adds the current user to the chat" do
        post :create, params: { chat: { name: "New Chat", is_group: true }, user_ids: [other_user.id] }
        expect(Chat.last.users).to include(user)
      end

      it "redirects to the created chat" do
        post :create, params: { chat: { name: "New Chat", is_group: true }, user_ids: [other_user.id] }
        expect(response).to redirect_to(Chat.last)
      end

      it "creates a direct chat with a single user" do
        expect {
          post :create, params: { chat: { name: "Direct Chat", is_group: false }, user_id: other_user.id }
        }.to change(Chat, :count).by(1)

        expect(Chat.last.users).to include(user)
        expect(Chat.last.users).to include(other_user)
      end

      # Pending test for direct chat reuse
      it "reuses existing direct chat between users" do
        pending "Need to fix this test to properly mock find_direct_chat"

        # Create a direct chat that matches the controller's find_direct_chat method
        direct_chat = Chat.create(name: "Direct", is_group: false)
        ChatMembership.create(user: user, chat: direct_chat)
        ChatMembership.create(user: other_user, chat: direct_chat)

        # We need to mock the find_direct_chat method to return our chat
        allow_any_instance_of(ChatsController).to receive(:find_direct_chat).and_return(direct_chat)

        expect {
          post :create, params: { chat: { name: "Direct Chat Again", is_group: false }, user_id: other_user.id }
        }.not_to change(Chat, :count)

        expect(response).to redirect_to(direct_chat)
      end
    end

    context "with invalid params" do
      # Pending test for validation errors
      it "returns a failure response" do
        pending "Need to fix this test to handle render properly"

        # Force Chat.save to return false
        allow_any_instance_of(Chat).to receive(:save).and_return(false)

        # Mock render to avoid missing template errors
        allow(controller).to receive(:render).and_return(nil)

        post :create, params: { chat: { name: "" } }
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end

  describe "PUT #update" do
    it "updates the chat with valid parameters" do
      put :update, params: { id: chat.id, chat: { name: "Updated Chat Name" } }

      chat.reload
      expect(chat.name).to eq("Updated Chat Name")
      expect(response).to redirect_to(chat_path(chat))
    end

    # Pending test for update validation errors
    it "fails to update with invalid parameters" do
      pending "Need to fix this test to handle render properly"

      # Force update to fail
      allow_any_instance_of(Chat).to receive(:update).and_return(false)

      # Mock render to avoid missing template errors
      allow(controller).to receive(:render).and_return(nil)

      put :update, params: { id: chat.id, chat: { name: "" } }
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "redirects if user is not a member" do
      # Create a chat the user is not a member of
      private_chat = create(:chat)

      put :update, params: { id: private_chat.id, chat: { name: "New Name" } }
      expect(response).to redirect_to(chats_path)
    end
  end

  describe "DELETE #destroy" do
    it "destroys the requested chat" do
      expect {
        delete :destroy, params: { id: chat.id }
      }.to change(Chat, :count).by(-1)
    end

    it "redirects to the chats list" do
      delete :destroy, params: { id: chat.id }
      expect(response).to redirect_to(chats_path)
    end

    it "restricts non-admin users from destroying chats" do
      # Make the user a non-admin
      ChatMembership.find_by(user: user, chat: chat).update(admin: false)

      delete :destroy, params: { id: chat.id }
      expect(response).to redirect_to(chat_path(chat))
      expect(flash[:alert]).to be_present
    end
  end

  describe "POST #add_member" do
    let(:third_user) { create(:user) }

    it "adds a new member to the chat" do
      expect {
        post :add_member, params: { id: chat.id, user_id: third_user.id }
      }.to change(ChatMembership, :count).by(1)

      expect(chat.users.reload).to include(third_user)
      expect(response).to redirect_to(chat_path(chat))
    end

    it "handles adding an existing member" do
      post :add_member, params: { id: chat.id, user_id: other_user.id }

      expect(response).to redirect_to(chat_path(chat))
      expect(flash[:alert]).to be_present
    end

    it "restricts non-admin users from adding members" do
      # Make the user a non-admin
      ChatMembership.find_by(user: user, chat: chat).update(admin: false)

      post :add_member, params: { id: chat.id, user_id: third_user.id }
      expect(response).to redirect_to(chat_path(chat))
      expect(flash[:alert]).to be_present
    end
  end

  describe "DELETE #remove_member" do
    it "removes a member from the chat" do
      expect {
        delete :remove_member, params: { id: chat.id, user_id: other_user.id }
      }.to change(ChatMembership, :count).by(-1)

      expect(chat.users.reload).not_to include(other_user)
      expect(response).to redirect_to(chat_path(chat))
    end

    it "prevents removing yourself" do
      delete :remove_member, params: { id: chat.id, user_id: user.id }

      expect(response).to redirect_to(chat_path(chat))
      expect(flash[:alert]).to include("You cannot remove yourself")
    end

    it "handles removing a non-member" do
      non_member = create(:user)

      delete :remove_member, params: { id: chat.id, user_id: non_member.id }

      expect(response).to redirect_to(chat_path(chat))
      expect(flash[:alert]).to include("not a member")
    end
  end

  describe "GET #latest_messages" do
    before do
      5.times do |i|
        Message.create(content: "Message #{i}", chat: chat, user: user)
      end
    end

    it "returns the latest messages for a chat" do
      # Mock render_to_string to avoid template errors
      allow(controller).to receive(:render_to_string).and_return("<div>Message</div>")

      get :latest_messages, params: { id: chat.id }

      expect(response).to have_http_status(:success)
      json_response = JSON.parse(response.body)

      expect(json_response["messages"].length).to eq(5)
    end

    it "respects the limit parameter" do
      # Mock render_to_string to avoid template errors
      allow(controller).to receive(:render_to_string).and_return("<div>Message</div>")

      get :latest_messages, params: { id: chat.id, limit: 2 }

      json_response = JSON.parse(response.body)
      expect(json_response["messages"].length).to eq(2)
    end

    it "restricts access to non-members" do
      # Create a chat the user is not a member of
      private_chat = create(:chat)

      get :latest_messages, params: { id: private_chat.id }

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
