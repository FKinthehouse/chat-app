class AddIsAiChatToChats < ActiveRecord::Migration[7.0]
  def change
    add_column :chats, :is_ai_chat, :boolean, default: false
  end
end
