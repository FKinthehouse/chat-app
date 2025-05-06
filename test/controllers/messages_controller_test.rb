require "test_helper"

class MessagesControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    @user = users(:one)
    @other_user = users(:two)
    @chat = Chat.create(name: "Test Chat", is_group: true)

    # Add users to chat
    ChatMembership.create(user: @user, chat: @chat, admin: true)
    ChatMembership.create(user: @other_user, chat: @chat, admin: false)

    sign_in @user
  end

  test "should create message" do
    assert_difference('Message.count') do
      post chat_messages_path(@chat), params: {
        message: { content: "Test message" }
      }
    end

    assert_redirected_to chat_path(@chat)
  end
end
