FactoryBot.define do
  factory :chat_membership do
    association :user
    association :chat
    admin { false }
  end
end
