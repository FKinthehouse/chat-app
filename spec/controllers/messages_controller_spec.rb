require 'rails_helper'

RSpec.describe MessagesController, type: :controller do
  let(:user) { create(:user) }
  let(:chat) { create(:chat) }
  let(:valid_attributes) { { content: "Hello, world!" } }
  let(:invalid_attributes) { { content: "" } }

  before do
    # Add users to chat
    chat.users << user
    sign_in user
  end

  describe "POST #create" do
    context "with valid params" do
      it "creates a new Message" do
        expect {
          post :create, params: { chat_id: chat.id, message: valid_attributes }
        }.to change(Message, :count).by(1)
      end

      it "assigns the created message to the current user" do
        post :create, params: { chat_id: chat.id, message: valid_attributes }
        expect(Message.last.user).to eq(user)
      end

      it "assigns the message to the chat" do
        post :create, params: { chat_id: chat.id, message: valid_attributes }
        expect(Message.last.chat).to eq(chat)
      end

      it "returns a success response with turbo stream format" do
        post :create, params: { chat_id: chat.id, message: valid_attributes, format: :turbo_stream }
        expect(response).to be_successful
        expect(response.content_type).to include("text/vnd.turbo-stream.html")
      end
    end

    context "with invalid params" do
      it "does not create a new Message" do
        expect {
          post :create, params: { chat_id: chat.id, message: invalid_attributes }
        }.not_to change(Message, :count)
      end
    end
  end

  describe "POST #mark_as_read" do
    let!(:message) { create(:message, chat: chat, user: create(:user), read: false) }

    it "marks messages as read" do
      post :mark_as_read, params: { chat_id: chat.id }
      message.reload
      expect(message.read).to be_truthy
    end

    it "returns a success response" do
      post :mark_as_read, params: { chat_id: chat.id }
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to include("success" => true)
    end
  end
end
