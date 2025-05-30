# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2025_05_05_190249) do
  create_table "chat_memberships", force: :cascade do |t|
    t.integer "user_id", null: false
    t.integer "chat_id", null: false
    t.boolean "admin"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["chat_id"], name: "index_chat_memberships_on_chat_id"
    t.index ["user_id"], name: "index_chat_memberships_on_user_id"
  end

  create_table "chats", force: :cascade do |t|
    t.string "name"
    t.boolean "is_group"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "messages", force: :cascade do |t|
    t.text "content"
    t.integer "user_id", null: false
    t.integer "chat_id", null: false
    t.boolean "read"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["chat_id"], name: "index_messages_on_chat_id"
    t.index ["user_id"], name: "index_messages_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.string "name"
    t.boolean "online_status"
    t.datetime "last_seen_at"
    t.string "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.json "ignored_user_ids"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "chat_memberships", "chats"
  add_foreign_key "chat_memberships", "users"
  add_foreign_key "messages", "chats"
  add_foreign_key "messages", "users"
end
