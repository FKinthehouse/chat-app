Rails.application.routes.draw do
  get "users/index"
  get "users/show"
  get "messages/create"
  get "chats/index"
  get "chats/show"
  get "chats/create"
  get "chats/update"
  get "chats/destroy"
  get "chats/add_member"
  get "chats/remove_member"
  get "home/index"
  devise_for :users
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/*
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest

  authenticated :user do
    root 'chats#index', as: :authenticated_root
  end

  root 'home#index'

  # AI Chat routes
  get 'ai_chat', to: 'chats#ai_chat'
  post 'ai_chat/message', to: 'chats#ai_message'
  post 'ai_chat/clear', to: 'chats#clear_ai_chat'

  resources :chats, only: [:index, :show, :create, :update, :destroy] do
    resources :messages, only: [:create] do
      collection do
        post 'mark_as_read'
      end
    end
    member do
      post 'add_member'
      delete 'remove_member'
      get 'latest_messages'
    end
  end

  resources :users, only: [:index, :show]

  # User status update route
  patch 'update_status', to: 'users#update_status'

  # Action Cable routes
  mount ActionCable.server => '/cable'
end
