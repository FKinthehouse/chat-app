class CreateChatMemberships < ActiveRecord::Migration[7.2]
  def change
    create_table :chat_memberships do |t|
      t.references :user, null: false, foreign_key: true
      t.references :chat, null: false, foreign_key: true
      t.boolean :admin

      t.timestamps
    end
  end
end
