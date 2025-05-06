require 'rails_helper'

RSpec.describe Message, type: :model do
  describe "validations" do
    it "is valid with valid attributes" do
      message = build(:message)
      expect(message).to be_valid
    end

    it "is not valid without content" do
      message = build(:message, content: nil)
      expect(message).not_to be_valid
    end

    it "is not valid without a user" do
      message = build(:message, user: nil)
      expect(message).not_to be_valid
    end

    it "is not valid without a chat" do
      message = build(:message, chat: nil)
      expect(message).not_to be_valid
    end
  end

  describe "associations" do
    it "belongs to a user" do
      association = described_class.reflect_on_association(:user)
      expect(association.macro).to eq :belongs_to
    end

    it "belongs to a chat" do
      association = described_class.reflect_on_association(:chat)
      expect(association.macro).to eq :belongs_to
    end
  end

  describe "defaults" do
    it "defaults read to false" do
      message = create(:message)
      expect(message.read).to be false
    end
  end

  describe "callbacks" do
    it "initializes with defaults" do
      message = build(:message)
      expect(message.read).to be false
    end

    it "has broadcast_message method" do
      message = create(:message)
      expect(message).to respond_to(:broadcast_message)
    end

    context "when broadcasting messages" do
      let(:chat) { create(:chat) }
      let(:user) { create(:user) }
      let(:recipient) { create(:user) }
      let(:message) { create(:message, chat: chat, user: user) }

      before do
        # Add users to chat
        chat.users << [user, recipient]
        # Stub ActionCable broadcast to prevent actual broadcasts in tests
        allow(ActionCable.server).to receive(:broadcast)
      end

      it "skips broadcasting when RAILS_ENV is test" do
        original_env = ENV['RAILS_ENV']
        ENV['RAILS_ENV'] = 'test'

        message.broadcast_message

        expect(ActionCable.server).not_to have_received(:broadcast)

        ENV['RAILS_ENV'] = original_env
      end

      it "skips broadcasting when SKIP_BROADCAST is true" do
        original_env = ENV['SKIP_BROADCAST']
        ENV['SKIP_BROADCAST'] = 'true'

        message.broadcast_message

        expect(ActionCable.server).not_to have_received(:broadcast)

        ENV['SKIP_BROADCAST'] = original_env
      end

      it "handles errors during broadcasting" do
        allow(ActionCable.server).to receive(:broadcast).and_raise("Test error")
        expect { message.broadcast_message }.not_to raise_error
      end

      context "when broadcasting is enabled" do
        before do
          # Override ENV settings to enable broadcasting in tests
          allow(ENV).to receive(:[]).and_call_original
          allow(ENV).to receive(:[]).with('RAILS_ENV').and_return('development')
          allow(ENV).to receive(:[]).with('SKIP_BROADCAST').and_return('false')

          allow(ApplicationController).to receive(:render).and_return("<html>Message Content</html>")
          allow(Rails.logger).to receive(:info)
          allow(Rails.logger).to receive(:error)
        end

        it "broadcasts to each user in the chat" do
          message.broadcast_message

          # Should broadcast once for each user plus one general broadcast
          expected_calls = chat.users.count + 1
          expect(ActionCable.server).to have_received(:broadcast).exactly(expected_calls).times
        end

        it "includes the correct data in broadcasts" do
          message.broadcast_message

          # Check for recipient-specific broadcast
          expect(ActionCable.server).to have_received(:broadcast).with(
            "chat_#{chat.id}",
            hash_including(
              html: "<html>Message Content</html>",
              user_id: user.id,
              recipient_id: recipient.id
            )
          ).at_least(:once)
        end

        it "logs broadcasting information" do
          message.broadcast_message

          expect(Rails.logger).to have_received(:info).with(/Broadcasting message #{message.id} to chat #{chat.id}/)
          expect(Rails.logger).to have_received(:info).with(/Broadcasted message #{message.id} to user #{recipient.id}/)
          expect(Rails.logger).to have_received(:info).with(/Broadcasted general message #{message.id} to chat #{chat.id}/)
        end

        it "handles group chat status correctly" do
          allow(chat).to receive(:is_group?).and_return(true)
          message.broadcast_message

          expect(ActionCable.server).to have_received(:broadcast).with(
            "chat_#{chat.id}",
            hash_including(
              is_group_chat: true
            )
          ).at_least(:once)
        end
      end
    end
  end
end
