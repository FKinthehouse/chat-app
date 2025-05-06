# Chat App

A real-time chat application with multiple features ideal for team communication.

[![Coverage Status](https://coveralls.io/repos/github/FKinthehouse/chat-app/badge.svg?branch=main)](https://coveralls.io/github/FKinthehouse/chat-app?branch=main)

## Features

- **Real-Time Communication**: Instant message delivery with ActionCable WebSockets
- **Group & Direct Messaging**: Create group chats with multiple users or chat directly one-on-one
- **Live Typing Indicators**: See when other users are typing in real-time
- **Rich Status System**: Set your status (Available, Busy, Do not disturb, Away, etc.)
- **Emoji Support**: Express yourself with a wide range of emojis
- **Message Notifications**: Browser notifications for new messages
- **Unread Message Badges**: Clear visual indicators for unread conversations
- **Online Presence**: See which users are currently online
- **Cross-Browser Compatibility**: Works in Safari, Chrome, Brave and other modern browsers
- **Mobile-Responsive Design**: Use on any device with a responsive layout

## Tech Stack

- **Ruby on Rails 7**: Backend framework
- **Tailwind CSS**: Responsive styling
- **Hotwire & Turbo**: Modern Rails front-end
- **ActionCable**: WebSocket implementation
- **Devise**: User authentication
- **SQLite/PostgreSQL**: Database
- **Importmaps**: JavaScript module management

## Setup Instructions

### Prerequisites

- Ruby 3.0.0+
- Rails 7.0.0+
- Node.js 14+ and Yarn
- SQLite3 or PostgreSQL

### Installation

1. Clone the repository

   ```
   git clone https://github.com/FKinthehouse/chat-app.git
   cd chat-app
   ```

2. Install dependencies

   ```
   bundle install
   yarn install
   ```

3. Setup database

   ```
   rails db:create
   rails db:migrate
   rails db:seed
   ```

4. Start the server

   ```
   bin/dev
   ```

5. Visit `http://localhost:3000` in your browser

## Development Notes

- **Browser Compatibility**: Notification system has specific optimizations for Chrome/Brave browsers
- **WebSocket Fallbacks**: Includes polling fallbacks when WebSockets are unavailable
- **Status Tracking**: Implements server-side session tracking for accurate online presence

## Screenshots

[Include screenshots here when available]

## Hackathon Project

This app was developed for a hackathon, focusing on building a robust real-time communication platform with emphasis on user experience and reliability across browsers.

## License

This project is available as open source under the terms of the MIT License.
