# SpikeDate Voice — product and implementation guide

## Product model

SpikeDate Voice should behave like a concise dating concierge, not an open-ended chatbot.
The conversational loop is:

1. The user taps the microphone or invokes an operating-system shortcut.
2. Speech is transcribed and shown on screen.
3. The intent layer maps the request to one approved SpikeDate capability.
4. SpikeDate reads the result and displays the same result visually.
5. Read-only actions happen immediately. Sending or changing anything requires a spoken confirmation.
6. SpikeDate reports the result and offers the next relevant choice.

Example:

> User: Show me profiles for today.
>
> SpikeDate: Maya is 27, two miles away, and looking for a long-term relationship. Her interests include live music and night walks. Would you like to see pictures, hear more, Like, Super Spike, or continue?
>
> User: Like her.
>
> SpikeDate: Send a Like to Maya?
>
> User: Yes.
>
> SpikeDate: Like sent. Would you like the next profile?

## Deployable voice modes

The app exposes two independently controlled experiences that share the same
intent router and confirmation policy:

- **Push to talk** listens for one request, responds, then stops. This is the
  default and lowest-cost mode.
- **Live conversation** keeps recognition ready between responses and supports
  a more continuous exchange. Users can pause it at any time.

For local and staging UI testing, `NEXT_PUBLIC_PULSE_VOICE_TEST_MODE=true`
uses browser/device recognition and speech synthesis without paid AI usage.
Deployment controls are:

| Variable                                  | Result when `false`                        |
| ----------------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_PULSE_VOICE_ENABLED`         | Hides and disables every voice entry point |
| `NEXT_PUBLIC_PULSE_VOICE_COMMAND_ENABLED` | Removes push-to-talk                       |
| `NEXT_PUBLIC_PULSE_VOICE_LIVE_ENABLED`    | Removes continuous conversation            |
| `NEXT_PUBLIC_PULSE_VOICE_TEST_MODE`       | Removes the charge-free test-mode label    |

These are public capability switches, not secrets. Cloudflare and AI provider
credentials must stay in Worker secrets. Profile settings provide a second,
per-user opt-out but can never override a deployment-level disabled feature.

## Supported prototype commands

- “Show profiles for today”
- “Read basics” / “Tell me about this profile”
- “Read more” / “More details”
- “Show pictures” / “Open profile”
- “Next profile”
- “Like this profile” followed by “Yes” or “Cancel”
- “Send a Super Spike” followed by “Yes” or “Cancel”
- “Lift my profile” followed by “Yes” or “Cancel”
- “Open Incoming” / “Who liked me?”
- “Open messages”
- “Message Maya saying Coffee this Saturday?” followed by “Yes” or “Cancel”
- “Open my profile”

## Production architecture

```text
Microphone
   ↓
On-device speech recognition where available
   ↓
Transcript + confidence score
   ↓
Intent router with an allow-list of SpikeDate tools
   ↓
Read action ───────────────→ execute → speak and display result
Write/send action → confirm → execute → speak and display receipt
   ↓
Device text-to-speech
```

Do not allow the language model or transcript to call application code directly. The intent router should return a validated object such as:

```json
{
  "intent": "like_profile",
  "profileId": "profile_123",
  "requiresConfirmation": true
}
```

The server must verify the signed-in user, profile visibility, match status, subscription allowance, rate limits, and idempotency key before performing an action.

## Capability policy

| Capability                              | Voice behavior                                 |
| --------------------------------------- | ---------------------------------------------- |
| Browse and read profiles                | Execute immediately                            |
| Open photos, Incoming, Chat, or Profile | Execute immediately                            |
| Apply filters                           | Read the interpreted filters back, then apply  |
| Like or Super Spike                     | Ask for explicit confirmation                  |
| Profile Lift                            | State allowance and duration, then confirm     |
| Send a message                          | Read recipient and exact message, then confirm |
| Edit a profile field                    | Read old and new value, then confirm           |
| Block, report, subscribe, or pay        | Open the visual flow for deliberate completion |

Confirmation state should expire after 30 seconds or when the selected profile changes. Every write request needs an idempotency key so repeated recognition results cannot send twice.

## iOS implementation

- Use the Speech framework or SpeechAnalyzer for live transcription.
- Use AVSpeechSynthesizer for spoken responses, pause, resume, and stop.
- Expose safe read/navigation capabilities through App Intents so Siri and Shortcuts can open SpikeDate Voice, show Incoming, or start a briefing.
- Use local notifications for scheduled briefing reminders.
- Ask for microphone and speech-recognition permission only when the user taps Ask SpikeDate for the first time.

## Android implementation

- Use SpeechRecognizer with RecognitionListener for partial/final transcripts and recognition errors.
- Use TextToSpeech for replies and release the engine when the voice session ends.
- Add Assistant App Actions and deep links for opening SpikeDate Voice, Incoming, Chat, Profile, and the daily briefing.
- Use native scheduled notifications for briefing reminders.
- Request microphone access at first use and provide the typed-command fallback when permission is declined.

## Data and privacy

- Display a visible listening state and stop listening immediately after the command.
- Prefer on-device recognition where available.
- Never keep raw microphone audio by default.
- Keep transcripts only for the current session unless the user opts into voice history.
- Do not read private message content, full names, or detailed profile attributes from a notification or lock screen.
- Add a “private briefing” setting that reads counts only.
- Provide a delete-voice-history control if transcripts are ever stored.

## Recommended delivery phases

1. Ship the current push-to-talk prototype and collect intent-recognition failures locally.
2. Replace the browser recognition layer with native iOS and Android adapters while keeping the same intent router.
3. Add Siri App Intents and Android App Actions for launching read-only flows outside the app.
4. Add server-authorized write tools with confirmation, idempotency, audit events, and rate limits.
5. Add optional natural-language filters and profile-edit commands.
6. Run noisy-room, accent, interruption, permission-denied, offline, duplicate-result, and wrong-profile tests before production release.

## Acceptance criteria

- A transcript is always visible before an action runs.
- Read-only commands respond within two seconds after final transcription under normal network conditions.
- No Like, Super Spike, Profile Lift, message, or profile edit can occur without explicit confirmation.
- Repeated recognition callbacks cannot duplicate an action.
- “Cancel,” closing the voice surface, changing profiles, or waiting 30 seconds clears pending actions.
- A microphone denial never blocks typed navigation or the rest of SpikeDate.
