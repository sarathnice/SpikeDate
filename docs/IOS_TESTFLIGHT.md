# SpikeDate iOS testing with TestFlight

TestFlight installs a signed prerelease build on an iPhone without submitting the app for App Review.

## Registered Apple identifiers

- App name: `SpikeDate`
- Bundle ID: `com.sarathnice.spikedate`
- Apple team: `GZ9DN4PC7X`
- App Store Connect app: iOS `1.0`

## Required GitHub staging secrets

Add these repository environment secrets to the `staging` environment:

- `IOS_CERTIFICATE_BASE64`: Apple Distribution `.p12`, encoded as base64
- `IOS_CERTIFICATE_PASSWORD`: password protecting the `.p12`
- `IOS_PROVISIONING_PROFILE_BASE64`: App Store distribution `.mobileprovision`, encoded as base64
- `IOS_PROVISIONING_PROFILE_NAME`: the provisioning profile's exact name
- `APPSTORE_ISSUER_ID`: App Store Connect API issuer ID
- `APPSTORE_API_KEY_ID`: App Store Connect API key ID
- `APPSTORE_API_PRIVATE_KEY`: complete contents of the downloaded `.p8` private key

Never commit certificates, provisioning profiles, API private keys, or passwords to Git.

## Build and upload

1. Open GitHub Actions.
2. Select **SpikeDate iOS TestFlight**.
3. Choose **Run workflow**.
4. After Apple finishes processing the build, open App Store Connect > SpikeDate > TestFlight.
5. Add the Apple ID used on the test iPhone as an internal tester.
6. Install Apple's TestFlight app on the iPhone and accept the invitation.

Each run uses the GitHub run number as the unique iOS build number. The app points to the Cloudflare staging environment.

## Testing gate before App Review

Verify registration, login, photo-library upload, crop review, profile discovery, Today, presence, likes, Spike, chat, camera and microphone permission prompts, push-notification permission, subscription screens, account deletion, privacy links, and recovery from offline mode. Test on at least one small iPhone and one current large iPhone.
