require 'rails_helper'

RSpec.describe User, type: :model do
  describe "validations" do
    it "is valid with valid attributes" do
      user = build(:user)
      expect(user).to be_valid
    end

    it "is not valid without an email" do
      user = build(:user, email: nil)
      expect(user).not_to be_valid
    end

    it "is not valid with a duplicate email" do
      create(:user, email: "duplicate@example.com")
      user = build(:user, email: "duplicate@example.com")
      expect(user).not_to be_valid
    end
  end

  describe "associations" do
    it "has many chat_memberships" do
      association = described_class.reflect_on_association(:chat_memberships)
      expect(association.macro).to eq :has_many
      expect(association.options[:dependent]).to eq :destroy
    end

    it "has many chats through chat_memberships" do
      association = described_class.reflect_on_association(:chats)
      expect(association.macro).to eq :has_many
      expect(association.options[:through]).to eq :chat_memberships
    end

    it "has many messages" do
      association = described_class.reflect_on_association(:messages)
      expect(association.macro).to eq :has_many
      expect(association.options[:dependent]).to eq :nullify
    end
  end

  describe "instance methods" do
    let(:user) { create(:user, name: "John Doe") }

    it "can update last seen" do
      time_before = Time.current - 1.minute
      user.update_last_seen
      expect(user.last_seen_at).to be > time_before
      expect(user.online_status).to be true
    end

    it "handles user ignoring" do
      other_user = create(:user)

      expect(user.ignoring?(other_user.id)).to be false

      user.ignore_user(other_user.id)
      expect(user.ignoring?(other_user.id)).to be true

      user.unignore_user(other_user.id)
      expect(user.ignoring?(other_user.id)).to be false
    end

    it "has status_color_class method" do
      expect(user).to respond_to(:status_color_class)
    end
  end

  describe "callbacks" do
    it "sets default status to Available" do
      user = create(:user)
      expect(user.status).to eq "Available"
    end

    it "sets default online_status to false" do
      user = create(:user)
      expect(user.online_status).to be false
    end
  end
end
