require "test_helper"

class UsersControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    @user = users(:one)
    @other_user = users(:two)
    sign_in @user
  end

  test "should get index" do
    get users_path
    assert_response :success
  end

  test "should get show" do
    get user_path(@other_user)
    assert_response :redirect # Redirects to chat
  end

  test "should update status" do
    patch update_status_path, params: { status: "Busy" }
    assert_redirected_to root_path
    @user.reload
    assert_equal "Busy", @user.status
  end
end
