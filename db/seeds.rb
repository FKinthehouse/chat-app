# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

# First, clear existing data if needed
# Comment these out if you want to keep existing data
puts "Cleaning up existing data..."
Message.destroy_all
ChatMembership.destroy_all
Chat.destroy_all
User.where(email: ['alice@example.com', 'bob@example.com', 'charlie@example.com', 'diana@example.com', 'ethan@example.com']).destroy_all

# Create some sample users
users = [
  { name: 'Alice Smith', email: 'alice@example.com', password: 'password123', status: 'Available' },
  { name: 'Bob Johnson', email: 'bob@example.com', password: 'password123', status: 'Busy' },
  { name: 'Charlie Davis', email: 'charlie@example.com', password: 'password123', status: 'Away' },
  { name: 'Diana Miller', email: 'diana@example.com', password: 'password123', status: 'Do Not Disturb' },
  { name: 'Ethan Williams', email: 'ethan@example.com', password: 'password123', status: 'Available' }
]

puts "Creating users..."
created_users = []
users.each do |user_attributes|
  # Check if user already exists
  user = User.find_by(email: user_attributes[:email])
  if user.nil?
    user = User.create!(user_attributes)
    puts "Created user: #{user.name}"
  else
    puts "User #{user.name} already exists"
  end
  created_users << user
end

# Create a group chat
puts "Creating group chat..."
group_chat = Chat.create!(name: 'Team Chat', is_group: true)

# Add all users to the group chat
User.all.each do |user|
  # Make the first user an admin
  is_admin = (user.id == created_users.first.id)
  ChatMembership.create!(user: user, chat: group_chat, admin: is_admin)
  puts "Added #{user.name} to group chat#{' as admin' if is_admin}"
end

# Create some direct messages between users
puts "Creating direct message chats..."
first_user = created_users.first

created_users.drop(1).each do |second_user|
  chat = Chat.create!(is_group: false)
  ChatMembership.create!(user: first_user, chat: chat, admin: true)
  ChatMembership.create!(user: second_user, chat: chat, admin: false)

  # Add some messages to the chat
  Message.create!(chat: chat, user: first_user, content: "Hi #{second_user.name}, how are you?")
  Message.create!(chat: chat, user: second_user, content: "I'm good, thanks! How about you?")
  Message.create!(chat: chat, user: first_user, content: "Doing well. Just testing this new chat app!")

  puts "Created direct chat between #{first_user.name} and #{second_user.name} with messages"
end

puts "Seed data created successfully!"
