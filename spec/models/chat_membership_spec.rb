require 'rails_helper'

RSpec.describe ChatMembership, type: :model do
  describe "validations" do
    it "is valid with valid attributes" do
      chat_membership = build(:chat_membership)
      expect(chat_membership).to be_valid
    end

    it "is not valid without a user" do
      chat_membership = build(:chat_membership, user: nil)
      expect(chat_membership).not_to be_valid
    end

    it "is not valid without a chat" do
      chat_membership = build(:chat_membership, chat: nil)
      expect(chat_membership).not_to be_valid
    end
  end

  describe "associations" do
    it "belongs to user" do
      association = described_class.reflect_on_association(:user)
      expect(association.macro).to eq :belongs_to
    end

    it "belongs to chat" do
      association = described_class.reflect_on_association(:chat)
      expect(association.macro).to eq :belongs_to
    end
  end

  describe "defaults" do
    it "sets admin to false by default" do
      chat_membership = create(:chat_membership)
      expect(chat_membership.admin).to be false
    end
  end
end
