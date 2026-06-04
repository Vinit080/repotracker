cask "repotracker" do
  version "1.0.7"
  sha256 :no_check # or add the specific sha256 here

  url "https://github.com/Vinit080/repotracker/releases/download/v#{version}/RepoTracker-#{version}-mac.dmg"
  name "RepoTracker"
  desc "Intelligent local Git repository manager"
  homepage "https://github.com/Vinit080/repotracker"

  app "RepoTracker.app"

  zap trash: [
    "~/Library/Application Support/RepoTracker",
    "~/Library/Preferences/com.repotracker.app.plist",
    "~/Library/Saved Application State/com.repotracker.app.savedState",
  ]
end
