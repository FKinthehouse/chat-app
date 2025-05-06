require 'rails_helper'

RSpec.describe ApplicationRecord, type: :model do
  it "is an abstract class" do
    expect(described_class.abstract_class).to be_truthy
  end

  it "is a subclass of ActiveRecord::Base" do
    expect(described_class.superclass).to eq(ActiveRecord::Base)
  end
end
