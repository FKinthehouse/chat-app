class UsersController < ApplicationController
  def index
    @users = User.where.not(id: current_user.id)
  end

  def show
    @user = User.find(params[:id])

    # Find or create a direct chat with this user
    @chat = find_or_create_direct_chat(@user)

    redirect_to chat_path(@chat)
  end

  def update_status
    status = params[:status]
    online = params[:online_status] == "true"

    # Handle "Reset status" option
    if status == "Reset status"
      status = "Available"
      online = true
    end

    # Update the user's status
    if current_user.update(status: status, online_status: online)
      # Broadcast the status change immediately
      StatusBroadcastJob.perform_now(current_user)

      # Successfully updated
      flash[:notice] = "Status updated to '#{status}'"
    else
      # Failed to update
      flash[:alert] = "Could not update status"
    end

    # Redirect back to the previous page
    redirect_back(fallback_location: root_path)
  end

  private

  def find_or_create_direct_chat(user)
    # Find chats that both users are members of
    common_chats = current_user.chats.joins(:chat_memberships)
                             .where(chat_memberships: { user_id: user.id })
                             .where(is_group: false)

    # If there's already a direct chat, return it
    return common_chats.first if common_chats.exists?

    # Otherwise, create a new direct chat
    chat = Chat.create(is_group: false)

    # Add both users to the chat
    ChatMembership.create(user: current_user, chat: chat, admin: true)
    ChatMembership.create(user: user, chat: chat, admin: false)

    chat
  end
end
