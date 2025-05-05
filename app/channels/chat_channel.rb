class ChatChannel < ApplicationCable::Channel
  def subscribed
    # Stream from the chat room if user is a member
    chat = Chat.find(params[:id])
    if chat.users.include?(current_user)
      stream_from "chat_#{params[:id]}"

      # Update user's online status
      current_user.update_last_seen
    else
      reject
    end
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end

  def speak(data)
    # Create a new message when user speaks
    chat = Chat.find(params[:id])
    return unless chat.users.include?(current_user)

    Message.create!(
      content: data['message'],
      chat_id: chat.id,
      user_id: current_user.id
    )
  end

  def typing(data)
    # Broadcast that a user is typing
    ActionCable.server.broadcast("chat_#{params[:id]}", {
      typing: true,
      user_id: current_user.id,
      user_name: current_user.name
    })
  end

  # Handle ping requests for connection verification (especially for Chrome/Brave)
  def ping(data)
    Rails.logger.debug "Ping received from user #{current_user.id} for chat #{params[:id]}"

    # Send a pong response to confirm the connection is working
    ActionCable.server.broadcast("chat_#{params[:id]}", {
      pong: true,
      timestamp: Time.current.to_i,
      user_id: current_user.id
    })
  end
end
