require 'rails_helper'

RSpec.describe HomeController, type: :controller do
  describe "GET #index" do
    context "when user is signed in" do
      let(:user) { create(:user) }

      before do
        sign_in user
      end

      it "redirects to chats path" do
        get :index
        expect(response).to redirect_to(chats_path)
      end

      it "has a 302 status code" do
        get :index
        expect(response).to have_http_status(302)
      end

      it "does not render the index template" do
        get :index
        expect(response).not_to render_template(:index)
      end
    end

    context "when user is not signed in" do
      it "returns a successful response" do
        get :index
        expect(response).to be_successful
      end

      it "renders the index template" do
        get :index
        expect(response).to render_template(:index)
      end

      it "has a 200 status code" do
        get :index
        expect(response).to have_http_status(200)
      end
    end
  end
end
