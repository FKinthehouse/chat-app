FactoryBot.define do
  factory :chat do
    sequence(:name) { |n| "Chat #{n}" }
    is_group { true }

    # Direct chat variant
    factory :direct_chat do
      is_group { false }
      name { nil }
    end
  end
end
