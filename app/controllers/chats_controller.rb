class ChatsController < ApplicationController
  before_action :set_chat, only: [:show, :update, :destroy, :add_member, :remove_member]
  before_action :validate_chat_member, only: [:show, :update]
  before_action :validate_chat_admin, only: [:destroy, :add_member, :remove_member]

  # Skip callbacks for AI chat methods which don't use real chat records
  skip_before_action :set_chat, :validate_chat_member, :validate_chat_admin, only: [:ai_chat, :ai_message, :clear_ai_chat]

  require 'net/http'
  require 'json'

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

  # GET /ai_chat
  def ai_chat
    @ai_greeting = "Hello! I'm your AI assistant. How can I help you today?"
    @user_message = flash[:ai_user_message]
    @ai_response = flash[:ai_response]
  end

  # POST /ai_chat/message
  def ai_message
    user_message = params[:message][:content]
    ai_response = get_ai_response(user_message)
    flash[:ai_user_message] = user_message
    flash[:ai_response] = ai_response
    redirect_to ai_chat_path
  end

  # POST /ai_chat/clear
  def clear_ai_chat
    # No need to clear session anymore
    redirect_to ai_chat_path
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

  def chatgpt_response(prompt)
    uri = URI("https://openrouter.ai/api/v1/chat/completions")
    headers = {
      "Authorization" => "Bearer #{ENV['OPENROUTER_API_KEY']}",
      "Content-Type" => "application/json"
    }
    body = {
      model: "openai/gpt-3.5-turbo",
      messages: [{role: "user", content: prompt}],
      max_tokens: 200
    }.to_json

    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true) do |http|
      req = Net::HTTP::Post.new(uri, headers)
      req.body = body
      http.request(req)
    end

    json = JSON.parse(response.body)
    json.dig("choices", 0, "message", "content") || use_gemini_response(prompt)
  rescue => e
    Rails.logger.error "ChatGPT API error: #{e.message}"
    "Sorry, there was an error contacting ChatGPT."
  end

  def get_ai_response(message)
    message = message.downcase

    # Simple keyword-based responses
    if message.match?(/\b(hi|hello|hey)\b/)
      return "Hello! How can I help you today?"
    elsif message.match?(/\b(how are you|how's it going)\b/)
      return "I'm doing well, thanks for asking! How about you?"
    elsif message.match?(/\bhelp\b/) || message.match?(/\bchat app\b/) || message.match?(/\bapp work\b/)
      return "This is a chat application where you can message other users and chat with an AI assistant (that's me!). You can send messages, share files, and update your status."
    elsif message.match?(/\bjoke\b/)
      jokes = [
        "Why don't scientists trust atoms? Because they make up everything!",
        "Why did the scarecrow win an award? Because he was outstanding in his field!",
        "I told my wife she was drawing her eyebrows too high. She looked surprised.",
        "What do you call a fake noodle? An impasta!",
        "Why don't eggs tell jokes? They'd crack each other up.",
        "How does a penguin build its house? Igloos it together!",
        "Why did the bicycle fall over? Because it was two tired!"
      ]
      return jokes.sample
    elsif message.match?(/\bweather\b/)
      return "I don't have access to real-time weather data, but I'd be happy to chat about something else!"
    elsif message.match?(/\bthank you\b/) || message.match?(/\bthanks\b/)
      return "You're welcome! Is there anything else I can help you with?"
    elsif message.match?(/\btime\b/)
      return "My clock says it's #{Time.now.strftime('%I:%M %p')} right now."
    elsif message.match?(/\bname\b/)
      return "I'm the Chat App AI Assistant. Nice to meet you!"
    elsif message.match?(/\bcan you do\b/) || message.match?(/\bwhat can you\b/)
      return "I can chat with you, answer questions, tell jokes, provide information about this app, and have friendly conversations. Just ask me anything!"
    elsif message.match?(/\bhow does this app work\b/) || message.match?(/\bhow to use\b/)
      return "This chat app lets you message other users and chat with me (an AI assistant). You can send messages, share files, and update your status. Try exploring the interface to see all the features!"
    elsif message.match?(/\bgemini\b/)
      Rails.logger.info "Gemini message: #{message}"
      return use_gemini_response(message)
    else
      # Fallback to ChatGPT for complex queries
      return chatgpt_response(message)
    end
  end

  def use_gemini_response(prompt)
    gemini_api_key  = ENV['GEMINI_API_KEY']
    uri = URI("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=#{gemini_api_key}")
    headers = {
      "Content-Type" => "application/json"
    }
    body = { "contents": [{
      "parts":[{"text": prompt}]
      }]
    }.to_json

    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true) do |http|
      req = Net::HTTP::Post.new(uri, headers)
      req.body = body
      http.request(req)
    end
    Rails.logger.info "Gemini response: #{response.body}"
    json = JSON.parse(response.body)
    json.dig("candidates", 0, "content", "parts", 0, "text")
  rescue => e
    Rails.logger.error "Gemini API error: #{e.message}"
    "Sorry, there was an error contacting Gemini."
  end
end
