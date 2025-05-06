require 'rails_helper'

RSpec.describe ApplicationCable::Channel, type: :channel do
  it "is a subclass of ActionCable::Channel::Base" do
    expect(described_class.superclass).to eq(ActionCable::Channel::Base)
  end
end
