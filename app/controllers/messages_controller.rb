class MessagesController < ApplicationController
  before_action :set_chat
  before_action :validate_chat_member

  def create
    @message = @chat.messages.new(message_params)
    @message.user = current_user
    @message.read = false  # Always start as unread for other users

    respond_to do |format|
      if @message.save
        format.html { redirect_to chat_path(@chat) }
        format.turbo_stream
      else
        format.html { redirect_to chat_path(@chat), alert: "Message could not be sent." }
      end
    end
  end

  # Mark messages as read for the current user
  def mark_as_read
    # Find all unread messages in this chat that were not sent by the current user
    unread_messages = @chat.messages.where(read: false).where.not(user_id: current_user.id)

    # Mark them as read
    unread_messages.update_all(read: true)

    # Return success response
    render json: { success: true, count: unread_messages.count }
  end

  private

  def set_chat
    @chat = Chat.find(params[:chat_id])
  end

  def validate_chat_member
    unless @chat.users.include?(current_user)
      redirect_to chats_path, alert: "You are not authorized to access this chat."
    end
  end

  def message_params
    params.require(:message).permit(:content)
  end
end
