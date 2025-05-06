require 'rails_helper'

RSpec.describe ApplicationCable::Connection, type: :channel do
  it "inherits from ActionCable::Connection::Base" do
    expect(described_class.superclass).to eq(ActionCable::Connection::Base)
  end
end
