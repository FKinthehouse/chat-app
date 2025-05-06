FactoryBot.define do
  factory :message do
    sequence(:content) { |n| "Message content #{n}" }
    association :user
    association :chat
  end
end
