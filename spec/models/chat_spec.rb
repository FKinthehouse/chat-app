require 'rails_helper'

RSpec.describe Chat, type: :model do
  describe "validations" do
    it "is valid with valid attributes" do
      chat = build(:chat, name: "Team Chat", is_group: true)
      expect(chat).to be_valid
    end

    it "requires a name if it's a group chat" do
      chat = build(:chat, name: nil, is_group: true)
      expect(chat).not_to be_valid
    end

    it "doesn't require a name for direct messages" do
      chat = build(:chat, name: nil, is_group: false)
      expect(chat).to be_valid
    end
  end

  describe "associations" do
    it "has many chat_memberships" do
      association = described_class.reflect_on_association(:chat_memberships)
      expect(association.macro).to eq :has_many
      expect(association.options[:dependent]).to eq :destroy
    end

    it "has many users through chat_memberships" do
      association = described_class.reflect_on_association(:users)
      expect(association.macro).to eq :has_many
      expect(association.options[:through]).to eq :chat_memberships
    end

    it "has many messages" do
      association = described_class.reflect_on_association(:messages)
      expect(association.macro).to eq :has_many
      expect(association.options[:dependent]).to eq :destroy
    end
  end

  describe "instance methods" do
    it "returns true for group chats with #is_group?" do
      chat = build(:chat, is_group: true)
      expect(chat.is_group?).to be true
    end

    it "returns false for direct chats with #is_group?" do
      chat = build(:chat, is_group: false)
      expect(chat.is_group?).to be false
    end
  end

  describe "#display_name_for" do
    let(:alice) { create(:user, name: "Alice") }
    let(:bob) { create(:user, name: "Bob") }

    it "returns the group name for group chats" do
      chat = create(:chat, name: "Team Chat", is_group: true)
      expect(chat.display_name_for(alice)).to eq "Team Chat"
    end

    it "returns other user's name for direct chats" do
      chat = create(:direct_chat)
      chat.users << [alice, bob]

      expect(chat.display_name_for(alice)).to eq "Bob"
    end

    it "returns 'Deleted User' if no other user exists" do
      chat = create(:direct_chat)
      chat.users << alice

      expect(chat.display_name_for(alice)).to eq "Deleted User"
    end
  end

  describe "#admin?" do
    let(:user) { create(:user) }
    let(:chat) { create(:chat) }

    it "returns true if user is an admin" do
      ChatMembership.create(user: user, chat: chat, admin: true)
      expect(chat.admin?(user)).to be true
    end

    it "returns false if user is not an admin" do
      ChatMembership.create(user: user, chat: chat, admin: false)
      expect(chat.admin?(user)).to be false
    end

    it "returns false if user is not a member" do
      expect(chat.admin?(user)).to be false
    end
  end

  describe "#admins" do
    it "returns users with admin role" do
      chat = create(:chat)
      admin1 = create(:user)
      admin2 = create(:user)
      regular_user = create(:user)

      ChatMembership.create(user: admin1, chat: chat, admin: true)
      ChatMembership.create(user: admin2, chat: chat, admin: true)
      ChatMembership.create(user: regular_user, chat: chat, admin: false)

      expect(chat.admins).to include(admin1, admin2)
      expect(chat.admins).not_to include(regular_user)
    end
  end
end
