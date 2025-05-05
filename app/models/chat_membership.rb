class ChatMembership < ApplicationRecord
  belongs_to :user
  belongs_to :chat

  validates :user_id, uniqueness: { scope: :chat_id }

  # Set default values
  after_initialize :set_defaults, if: :new_record?

  private

  def set_defaults
    self.admin ||= false
  end
end
