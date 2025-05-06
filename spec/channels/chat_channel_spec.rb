require 'rails_helper'

RSpec.describe ChatChannel, type: :channel do
  let(:user) { create(:user) }
  let(:chat) { create(:chat) }

  before do
    # Add the user to the chat
    chat.users << user

    # Stub the connection
    stub_connection current_user: user
  end

  it "subscribes to a chat stream when the user is a member" do
    # Create a membership for the user
    ChatMembership.find_or_create_by(user: user, chat: chat)

    # Subscribe to the chat channel
    subscribe(id: chat.id)

    # Subscription should be confirmed
    expect(subscription).to be_confirmed

    # Stream name should be specific to the chat
    expect(subscription).to have_stream_from("chat_#{chat.id}")
  end

  it "rejects subscription when user doesn't belong to the chat" do
    other_chat = create(:chat)
    subscribe(id: other_chat.id)
    expect(subscription).to be_rejected
  end

  describe "#speak" do
    before do
      subscribe(id: chat.id)
    end

    it "creates a new message" do
      expect {
        perform :speak, message: "Hello, world!"
      }.to change(Message, :count).by(1)
    end

    it "creates message with correct attributes" do
      perform :speak, message: "Hello, world!"
      message = Message.last
      expect(message.content).to eq "Hello, world!"
      expect(message.user).to eq user
      expect(message.chat).to eq chat
    end
  end

  describe "#typing" do
    before do
      subscribe(id: chat.id)
    end

    it "broadcasts typing status" do
      expect {
        perform :typing
      }.to have_broadcasted_to("chat_#{chat.id}").with(hash_including(typing: true))
    end
  end

  describe "#ping" do
    before do
      subscribe(id: chat.id)
    end

    it "responds with pong" do
      expect {
        perform :ping
      }.to have_broadcasted_to("chat_#{chat.id}").with(hash_including(pong: true))
    end
  end
end
