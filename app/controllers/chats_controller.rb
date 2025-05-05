class ChatsController < ApplicationController
  before_action :set_chat, only: [:show, :update, :destroy, :add_member, :remove_member]
  before_action :validate_chat_member, only: [:show, :update]
  before_action :validate_chat_admin, only: [:destroy, :add_member, :remove_member]

  def index
    # Get all user's chats
    all_chats = current_user.chats.includes(:users, :messages)

    # Separate group and direct chats
    group_chats = all_chats.where(is_group: true)
    direct_chats = all_chats.where(is_group: false)

    # Deduplicate direct chats - keep only one chat per other user
    unique_user_ids = {}
    unique_direct_chats = []

    direct_chats.each do |chat|
      other_user = chat.users.where.not(id: current_user.id).first

      # Skip if we already have a chat with this user
      next if other_user.nil? || unique_user_ids[other_user.id]

      unique_user_ids[other_user.id] = true
      unique_direct_chats << chat
    end

    # Combine group chats and unique direct chats
    combined_chats = group_chats + unique_direct_chats

    # Sort chats by the most recent message
    @chats = combined_chats.sort_by do |chat|
      last_message = chat.messages.order(created_at: :desc).first
      last_message ? last_message.created_at : chat.created_at
    end.reverse # Reverse to get newest first

    # Get unread messages count for each chat
    @unread_counts = {}
    @chats.each do |chat|
      @unread_counts[chat.id] = chat.messages.where(read: false).where.not(user_id: current_user.id).count
    end

    @users = User.where.not(id: current_user.id)
  end

  def show
    @messages = @chat.messages.includes(:user).order(created_at: :asc)
    @message = Message.new
    @chat_members = @chat.users
  end

  def create
    # For direct messages, check if a chat already exists between these users
    if !params[:chat][:is_group] && params[:user_id].present?
      other_user = User.find(params[:user_id])
      existing_chat = find_direct_chat(current_user, other_user)

      if existing_chat
        return redirect_to chat_path(existing_chat)
      end
    end

    @chat = Chat.new(chat_params)

    respond_to do |format|
      if @chat.save
        # Add creator as member and admin
        ChatMembership.create(user: current_user, chat: @chat, admin: true)

        # Add other members if it's a group chat
        if @chat.is_group? && params[:user_ids].present?
          params[:user_ids].each do |user_id|
            ChatMembership.create(user_id: user_id, chat: @chat, admin: false)
          end
        elsif !@chat.is_group? && params[:user_id].present?
          # For direct messages, add the other user
          ChatMembership.create(user_id: params[:user_id], chat: @chat, admin: false)
        end

        format.html { redirect_to chat_path(@chat), notice: "Chat was successfully created." }
        format.json { render :show, status: :created, location: @chat }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @chat.errors, status: :unprocessable_entity }
      end
    end
  end

  def update
    respond_to do |format|
      if @chat.update(chat_params)
        format.html { redirect_to chat_path(@chat), notice: "Chat was successfully updated." }
        format.json { render :show, status: :ok, location: @chat }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @chat.errors, status: :unprocessable_entity }
      end
    end
  end

  def destroy
    @chat.destroy!

    respond_to do |format|
      format.html { redirect_to chats_path, notice: "Chat was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  def add_member
    user = User.find(params[:user_id])

    if @chat.users.include?(user)
      redirect_to chat_path(@chat), alert: "User is already a member of this chat."
    else
      ChatMembership.create(user: user, chat: @chat)
      redirect_to chat_path(@chat), notice: "Member added successfully."
    end
  end

  def remove_member
    user = User.find(params[:user_id])

    if user == current_user
      redirect_to chat_path(@chat), alert: "You cannot remove yourself. Leave the chat instead."
    elsif !@chat.users.include?(user)
      redirect_to chat_path(@chat), alert: "User is not a member of this chat."
    else
      ChatMembership.find_by(user: user, chat: @chat).destroy
      redirect_to chat_path(@chat), notice: "Member removed successfully."
    end
  end

  # GET /chats/:id/latest_messages
  # Endpoint to manually fetch the latest messages (used as a fallback for Chrome/Brave)
  def latest_messages
    @chat = Chat.find(params[:id])

    # Ensure user is a member of this chat
    unless @chat.users.include?(current_user)
      return render json: { error: "Unauthorized" }, status: :unauthorized
    end

    # Get the latest messages (last 20 by default)
    limit = params[:limit] || 20
    @messages = @chat.messages.order(created_at: :desc).limit(limit)

    # Format the messages for the response
    messages_data = @messages.map do |message|
      {
        id: message.id,
        content: message.content,
        user_id: message.user_id,
        created_at: message.created_at,
        html: render_to_string(partial: 'messages/message', locals: { message: message, current_user: current_user })
      }
    end

    render json: { messages: messages_data }
  end

  private

  def set_chat
    @chat = Chat.find(params[:id])
  end

  def validate_chat_member
    unless @chat.users.include?(current_user)
      redirect_to chats_path, alert: "You are not authorized to view this chat."
    end
  end

  def validate_chat_admin
    unless @chat.admin?(current_user)
      redirect_to chat_path(@chat), alert: "You must be an admin to perform this action."
    end
  end

  def chat_params
    params.require(:chat).permit(:name, :is_group)
  end

  def find_direct_chat(user1, user2)
    # Find chats that both users are members of
    common_chats = Chat.joins(:chat_memberships)
                      .where(is_group: false)
                      .where(chat_memberships: { user_id: user1.id })
                      .where(id: ChatMembership.where(user_id: user2.id).select(:chat_id))

    # Return the first common chat, if any
    common_chats.first
  end
end
