class Chat < ApplicationRecord
  has_many :chat_memberships, dependent: :destroy
  has_many :users, through: :chat_memberships
  has_many :messages, dependent: :destroy

  validates :name, presence: true, if: :is_group?

  # Returns true if this is a group chat
  def is_group?
    is_group
  end

  # Returns a name for the chat, either the group name or the name of the other user for direct chats
  def display_name_for(current_user)
    return name if is_group?

    other_user = users.where.not(id: current_user.id).first
    return other_user&.name || 'Deleted User'
  end

  # Get admin users of the chat
  def admins
    User.joins(:chat_memberships).where(chat_memberships: { chat_id: id, admin: true })
  end

  # Check if user is admin
  def admin?(user)
    chat_memberships.exists?(user: user, admin: true)
  end
end
