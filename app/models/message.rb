class Message < ApplicationRecord
  belongs_to :user
  belongs_to :chat

  validates :content, presence: true

  # Set default values
  after_initialize :set_defaults, if: :new_record?
  after_create_commit :broadcast_message, unless: -> { Rails.env.test? || ENV['SKIP_BROADCAST'] == 'true' }

  def broadcast_message
    return if ENV['RAILS_ENV'] == 'test' || ENV['SKIP_BROADCAST'] == 'true'

    begin
      # Create a unique message ID to prevent duplicate rendering
      message_id = "message_#{id}_#{created_at.to_i}"

      # Log message broadcasting for debugging
      Rails.logger.info("Broadcasting message #{id} to chat #{chat.id} from user #{user.id}")

      # First broadcast to all members individually with recipient_id for client-side filtering
      chat.users.each do |recipient|
        # Render with the correct perspective for each user
        html = ApplicationController.render(
          partial: 'messages/message',
          locals: { message: self, current_user: recipient }
        )

        ActionCable.server.broadcast("chat_#{chat.id}", {
          html: html,
          message_id: message_id,
          user_id: user.id,
          recipient_id: recipient.id,
          is_group_chat: chat.is_group?
        })

        Rails.logger.info("Broadcasted message #{id} to user #{recipient.id}")
      end

      # Also broadcast a general message without recipient_id to ensure delivery
      # This is a fallback to make sure messages are delivered
      html = ApplicationController.render(
        partial: 'messages/message',
        locals: { message: self, current_user: user }
      )

      ActionCable.server.broadcast("chat_#{chat.id}", {
        html: html,
        message_id: message_id,
        user_id: user.id,
        is_group_chat: chat.is_group?
      })

      Rails.logger.info("Broadcasted general message #{id} to chat #{chat.id}")
    rescue => e
      Rails.logger.error("Error broadcasting message: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))
    end
  end

  private

  def set_defaults
    self.read ||= false
  end
end
