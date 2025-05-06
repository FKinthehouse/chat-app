require 'rails_helper'

RSpec.describe StatusBroadcastJob, type: :job do
  let(:user) { create(:user, status: "Available") }

  before do
    # Override environment settings to enable broadcasting in tests
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with('RAILS_ENV').and_return('development')
    allow(Rails.env).to receive(:test?).and_return(false)

    # Ensure user looks online to prevent early return in job
    allow(user).to receive(:online?).and_return(true)
    # Add last_seen_at so it doesn't get marked as inactive
    allow(user).to receive(:last_seen_at).and_return(Time.current)
  end

  it "queues the job" do
    expect {
      StatusBroadcastJob.perform_later(user)
    }.to have_enqueued_job(StatusBroadcastJob)
  end

  it "can be performed" do
    expect {
      StatusBroadcastJob.perform_now(user)
    }.not_to raise_error
  end

  it "calls ActionCable.server.broadcast" do
    allow(ActionCable.server).to receive(:broadcast)

    StatusBroadcastJob.perform_now(user)

    expect(ActionCable.server).to have_received(:broadcast).with("status_channel", hash_including(:user_id))
  end

  it "passes user information in the broadcast" do
    allow(ActionCable.server).to receive(:broadcast)

    StatusBroadcastJob.perform_now(user)

    expect(ActionCable.server).to have_received(:broadcast).with(
      "status_channel",
      hash_including(
        user_id: user.id,
        status: "Available"
      )
    )
  end
end
