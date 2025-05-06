require 'rails_helper'

RSpec.describe ApplicationController, type: :controller do
  controller do
    def index
      render plain: "index"
    end

    def authenticate_user!
      super
    end
  end

  describe "authentication" do
    it "inherits from ActionController::Base" do
      expect(described_class.superclass).to eq(ActionController::Base)
    end

    it "includes required modules" do
      expect(controller.class.ancestors).to include(Devise::Controllers::Helpers)
    end

    it "redirects unauthenticated users" do
      get :index
      expect(response).to redirect_to(new_user_session_path)
    end

    it "allows authenticated users" do
      user = create(:user)
      sign_in user
      get :index
      expect(response).to be_successful
    end
  end
end
