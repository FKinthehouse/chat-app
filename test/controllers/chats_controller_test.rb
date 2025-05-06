require "test_helper"

class ChatsControllerTest < ActionDispatch::IntegrationTest
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

  test "should get index" do
    get chats_path
    assert_response :success
  end

  test "should get show" do
    get chat_path(@chat)
    assert_response :success
  end

  test "should create chat" do
    assert_difference('Chat.count') do
      post chats_path, params: {
        chat: { name: "New Chat", is_group: true },
        user_ids: [@other_user.id]
      }
    end
    assert_redirected_to chat_path(Chat.last)
  end

  test "should update chat" do
    patch chat_path(@chat), params: { chat: { name: "Updated Chat" } }
    assert_redirected_to chat_path(@chat)
    @chat.reload
    assert_equal "Updated Chat", @chat.name
  end

  test "should destroy chat" do
    assert_difference('Chat.count', -1) do
      delete chat_path(@chat)
    end
    assert_redirected_to chats_path
  end

  test "should add member" do
    @third_user = users(:admin)
    assert_difference('ChatMembership.count') do
      post add_member_chat_path(@chat), params: { user_id: @third_user.id }
    end
    assert_redirected_to chat_path(@chat)
  end

  test "should remove member" do
    assert_difference('ChatMembership.count', -1) do
      delete remove_member_chat_path(@chat), params: { user_id: @other_user.id }
    end
    assert_redirected_to chat_path(@chat)
  end
end
