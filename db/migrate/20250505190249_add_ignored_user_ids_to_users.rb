class AddIgnoredUserIdsToUsers < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :ignored_user_ids, :json
  end
end
