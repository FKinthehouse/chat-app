module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
      logger.add_tags 'ActionCable', "User:#{current_user.id}"
      logger.info "Connected to ActionCable: User #{current_user.id} (#{current_user.name})"

      # Update user's online status when they connect
      current_user.update_last_seen
    end

    def disconnect
      logger.info "Disconnected from ActionCable: User #{current_user&.id}"
      super
    end

    private

    def find_verified_user
      if verified_user = env['warden'].user
        verified_user
      else
        reject_unauthorized_connection
      end
    rescue => e
      logger.error "Connection error: #{e.message}"
      reject_unauthorized_connection
    end
  end
end
