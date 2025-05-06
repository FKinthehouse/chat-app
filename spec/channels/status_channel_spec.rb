require 'rails_helper'

RSpec.describe StatusChannel, type: :channel do
  let(:user) { create(:user) }

  before do
    # Initialize connection with identifiers
    stub_connection current_user: user
  end

  it "successfully subscribes" do
    subscribe
    expect(subscription).to be_confirmed
  end

  it "streams from status channel" do
    subscribe
    expect(subscription).to have_stream_from("status_channel")
  end

  describe "#update_status" do
    before do
      subscribe
    end

    it "updates user status" do
      perform :update_status, status: "Busy", online: true
      user.reload
      expect(user.status).to eq("Busy")
      expect(user.online_status).to be true
    end
  end

  describe "#heartbeat" do
    before do
      subscribe
    end

    it "updates user's last seen timestamp" do
      # Clear any existing timestamp
      user.update_column(:last_seen_at, nil)
      perform :heartbeat
      user.reload
      expect(user.last_seen_at).not_to be_nil
    end
  end

  describe "#request_all_statuses" do
    before do
      subscribe
    end

    it "responds to request_all_statuses" do
      expect { perform :request_all_statuses }.not_to raise_error
    end
  end
end
