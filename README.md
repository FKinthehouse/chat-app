# Chat App

A real-time chat application similar to Slack built with Ruby on Rails, Action Cable, and Stimulus.

## Features

- User authentication with Devise
- Real-time messaging with Action Cable
- Direct messages between users
- Group chats with multiple members
- Real-time online/offline user status
- Typing indicators
- Message history
- User presence tracking

## Prerequisites

- Ruby 3.x
- Rails 7.x
- Redis (for Action Cable)
- Node.js and Yarn (for Webpacker)

## Installation

1. Clone the repository

   ```
   git clone <repository-url>
   cd chat_app
   ```

2. Install dependencies

   ```
   bundle install
   yarn install
   ```

3. Set up the database

   ```
   rails db:create
   rails db:migrate
   ```

4. Start Redis server (if not already running)

   ```
   redis-server
   ```

5. Start the Rails server

   ```
   bin/dev
   ```

6. Visit `http://localhost:3000` in your browser

## Usage

1. Sign up for an account
2. Navigate to the Users tab to see all available users
3. Start a direct conversation with any user
4. Create group chats for team discussions
5. See real-time online status of all your contacts

## Technology Stack

- Ruby on Rails 7.0+
- Action Cable for WebSockets
- Devise for authentication
- Stimulus.js for frontend interactivity
- Tailwind CSS for styling
- Redis for Action Cable backend
- PostgreSQL for database (in production)

## Future Improvements

- File sharing
- Message reactions
- Video/audio calls
- Mobile app
- End-to-end encryption

## License

This project is licensed under the MIT License.
