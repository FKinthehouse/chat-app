RSpec.configure do |config|
  # Add additional Devise configuration if needed
  config.include Devise::Test::ControllerHelpers, type: :controller
  config.include Devise::Test::ControllerHelpers, type: :view
  config.include Devise::Test::IntegrationHelpers, type: :request
  config.include Warden::Test::Helpers
end

# This creates a helper method available in all tests
def login_user
  @request.env["devise.mapping"] = Devise.mappings[:user]
  user = FactoryBot.create(:user)
  sign_in user
  user
end
