class StatusBroadcastJob < ApplicationJob
  queue_as :default
  retry_on StandardError, wait: 5.seconds, attempts: 3

  def perform(user)
    # Generate a unique timestamp for this update
    timestamp = Time.current.to_i

    # CHECK FOR GHOST NOTIFICATIONS:
    # 1. If user has been offline for more than 5 minutes, force offline status
    if user.last_seen_at.nil? || user.last_seen_at < 5.minutes.ago
      Rails.logger.info "User #{user.id} has been inactive for 5+ minutes, forcing offline status"
      user.update_columns(online_status: false, status: "Appear offline") unless user.status == "Appear offline"
    end

    # 2. Check for inconsistency - if user is offline, but status shows Available
    if !user.online? && user.status == "Available"
      Rails.logger.info "Inconsistency detected: User #{user.id} is offline but status is Available. Correcting to Appear offline."
      user.update_columns(status: "Appear offline")
    end

    # 3. Don't broadcast status updates for offline users (prevents ghost notifications)
    if !user.online?
      Rails.logger.info "Skipping broadcast for offline user #{user.id} (#{user.name})"
      return
    end

    # Build the data hash for broadcasting
    data = {
      user_id: user.id,
      name: user.name,
      status: user.status,
      online: user.online?,
      status_class: user.status_color_class,
      timestamp: timestamp,
      # Flag to help clients identify this is a valid broadcast from an online user
      is_verified_broadcast: true
    }

    # Log the status change
    Rails.logger.info("Broadcasting status change for user #{user.id} (#{user.name}): #{user.status}, online: #{user.online?}, at timestamp: #{timestamp}")

    # Try broadcasting through ActionCable
    begin
      ActionCable.server.broadcast("status_channel", data)
      Rails.logger.info("Status broadcast success: user_id=#{user.id}, timestamp=#{timestamp}")
    rescue => e
      Rails.logger.error("Error broadcasting status: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))
      raise e # Will trigger retry
    end
  end
end
