class CreateChats < ActiveRecord::Migration[7.2]
  def change
    create_table :chats do |t|
      t.string :name
      t.boolean :is_group

      t.timestamps
    end
  end
end
