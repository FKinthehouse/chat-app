class HomeController < ApplicationController
  skip_before_action :authenticate_user!, only: [:index]

  def index
    redirect_to chats_path if user_signed_in?
  end
end
