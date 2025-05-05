class StatusChannel < ApplicationCable::Channel
  def subscribed
    stream_from "status_channel"
    logger.info "User #{current_user.id} subscribed to status channel"

    # Update user's online status when they subscribe
    current_user.update_last_seen

    # Broadcast current user's status to all users
    # This ensures everyone gets updated statuses when a new client connects
    broadcast_now(current_user)
  end

  def unsubscribed
    logger.info "User #{current_user.id} unsubscribed from status channel"
    # Any cleanup needed when channel is unsubscribed
  end

  # Allow client to trigger status update
  def update_status(data)
    status = data['status']
    online = data['online'] == true || data['online'] == 'true'

    if current_user.update(status: status, online_status: online)
      logger.info "User #{current_user.id} updated status to #{status} (online: #{online}) via status channel"
      # Force immediate broadcast after update
      broadcast_now(current_user)
    else
      logger.error "Failed to update status for user #{current_user.id}: #{current_user.errors.full_messages.join(', ')}"
    end
  end

  # Client requests all user statuses
  def request_all_statuses
    logger.info "User #{current_user.id} requested all statuses"

    # Find all users
    User.all.each do |user|
      # Broadcast each user's status immediately
      broadcast_now(user)
    end
  end

  # Client sends heartbeat to keep connection alive
  def heartbeat
    # Update the user's last seen timestamp
    current_user.update_last_seen
    logger.debug "Heartbeat from user #{current_user.id}"
  end

  private

  # Force immediate broadcast of user status
  def broadcast_now(user)
    # Generate a unique timestamp for this update
    timestamp = Time.current.to_i

    # CHECK FOR GHOST NOTIFICATIONS:
    # 1. If user has been offline for more than 5 minutes, force offline status
    if user.last_seen_at.nil? || user.last_seen_at < 5.minutes.ago
      logger.info "User #{user.id} has been inactive for 5+ minutes, forcing offline status"
      user.update_columns(online_status: false, status: "Appear offline") unless user.status == "Appear offline"
    end

    # 2. Check for inconsistency - if user is offline, but status shows Available
    if !user.online? && user.status == "Available"
      logger.info "Inconsistency detected: User #{user.id} is offline but status is Available. Correcting to Appear offline."
      user.update_columns(status: "Appear offline")
    end

    # 3. Don't broadcast status updates for offline users (prevents ghost notifications)
    if !user.online?
      logger.info "Skipping broadcast for offline user #{user.id} (#{user.name})"
      return
    end

    # Build the data hash with all needed user info
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

    # Broadcast directly from the channel for immediate delivery
    ActionCable.server.broadcast("status_channel", data)
    logger.info "Direct status broadcast: user_id=#{user.id}, status=#{user.status}, timestamp=#{timestamp}"
  end
end
