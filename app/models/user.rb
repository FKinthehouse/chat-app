class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_many :chat_memberships, dependent: :destroy
  has_many :chats, through: :chat_memberships
  has_many :messages, dependent: :nullify

  # List of User IDs to be ignored for notifications
  # Will be stored in a JSON column
  attribute :ignored_user_ids, :json, default: []

  # Set default values
  after_initialize :set_defaults, if: :new_record?

  # Broadcast status changes
  after_update :broadcast_status_change, if: -> { saved_change_to_status? || saved_change_to_online_status? }

  # Update last seen at timestamp when user is online
  def update_last_seen
    update_columns(last_seen_at: Time.current, online_status: true)
  end

  # Check if user is online (active in the last 5 minutes)
  def online?
    return online_status if online_status
    last_seen_at.present? && last_seen_at > 5.minutes.ago
  end

  # Check if a user is being ignored
  def ignoring?(user_id)
    (ignored_user_ids || []).include?(user_id.to_i)
  end

  # Add a user to the ignored list
  def ignore_user(user_id)
    user_id = user_id.to_i
    return if ignoring?(user_id)

    self.ignored_user_ids = (ignored_user_ids || []) << user_id
    save
  end

  # Remove a user from the ignored list
  def unignore_user(user_id)
    user_id = user_id.to_i
    return unless ignoring?(user_id)

    self.ignored_user_ids = (ignored_user_ids || []).reject { |id| id == user_id }
    save
  end

  # Get status color CSS class
  def status_color_class
    case status
    when 'Available'
      'status-available'
    when 'Busy', 'Do not disturb'
      'status-busy'
    when 'Be right back', 'Appear away'
      'status-away'
    when 'Appear offline'
      'status-offline'
    else
      'status-available'
    end
  end

  private

  def broadcast_status_change
    # Add a slight delay to ensure the database is updated before broadcasting
    # This helps prevent race conditions in ActionCable
    Rails.logger.info("Broadcasting status change for user #{id}: #{status} (online: #{online?})")

    # Use perform_now to ensure immediate broadcast
    StatusBroadcastJob.perform_now(self)
  end

  def set_defaults
    self.online_status ||= false
    self.status ||= "Available"
  end
end
