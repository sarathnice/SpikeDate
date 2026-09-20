# Play Together: ten dating games

The picker now has **Conversation** and **Arcade** tabs. These ten games are in Conversation; live board games are documented in [Arcade](ARCADE_GAMES.md). The later live suite also verifies This or That through actual authenticated database-backed sessions, rather than preview role switching. See [latest QA report](ARCADE_QA_REPORT.md) for current results; the counts below describe the earlier Conversation-only implementation.

## Where to play

Open an accepted mutual-match chat and select **Play together**. Pick Fun, Flirty or Get closer, then invite a game. The invited person must accept; acceptance explicitly includes the displayed game mood. Either player can skip any question, decline or leave without ending the match. Normal messaging remains available.

The local interactive preview is `/design/games`. It lets you switch between Alex and Lena to play both sides. The preview is clearly labelled, uses browser-local demo records and never sends real invitations. Close the dialog to switch participants, then reopen it. Real application server mode uses authenticated API calls, not demo storage.

## Catalogue

Every game has three curated original rounds:

1. This or That — independent choices, followed by reciprocal reveal.
2. Guess My Pick — answer privately and guess the other person's preference; results show your guess without a relationship score.
3. Two Truths & a Twist — share numbered statements, then discuss guesses and reveal the invention in text.
4. Emoji Story — send an emoji story, guess its meaning, then explain it.
5. Would You Rather? — playful choice-based scenarios.
6. Our Tiny Adventure — co-write a fictional three-scene date in text.
7. Flirt or Funny — gentle original flirtation prompts; invitation clearly labelled Flirty.
8. Compliment Exchange — respectful observations beyond appearance; all prompts skippable.
9. Dream Weekend — preferences followed by an open-ended answer.
10. Build Our Date — public activity and pace choices, then a comfort prompt; completion can open the existing date planner when enabled.

Text games are guided conversation formats, not automated truth detection, forced alternating-story composition or compatibility assessments. No AI service, licensed question deck or external gaming provider is required.

## Persistence and privacy

- Drizzle migration `0006_tiny_marvel_apes.sql` adds `game_sessions` and `game_answers`, with tracked schema and snapshot metadata.
- Sessions save a complete game snapshot so catalogue changes do not alter ongoing questions.
- API: GET/POST `/api/conversations/[id]/games`. Actions: invite, accept, decline, answer, leave.
- Only participants in an active mutual-match conversation with connection-ready profiles can use the API. Blocked or unmatched conversations are denied; their previous game records are not exposed.
- Hidden partner answers and guesses never appear in the API response until both players answer that round.
- Unique indexes enforce one waiting/active game per conversation and one answer per player per round. Duplicate answers cannot overwrite the original.
- Invitations expire after 24 hours; accepted games after 72 hours. Expired status is resolved on access; no background scheduler is required.
- Invitations use the existing message-notification preference path. No repeated game reminders were added.
- Polling runs every 5 seconds while the game dialog is open and 30 seconds while closed in an open chat; hidden browser tabs pause reads. Games are asynchronous, not WebSocket-based.

## QA and release

Unit/API tests include a real in-memory SQLite database using the generated migration, covering acceptance authority, private answers, three-round completion, persistence, duplicate submissions, malformed choices, inactive-match access, decline, leave, skip and expiry. Browser tests cover each of the ten games with two simulated participants on two mobile-sized projects.

Browser preview tests are not two-device staging tests. Before staging release, apply the new D1 migration through the existing staging deployment workflow, deploy the code and retest with two authenticated accounts and stored database records. Physical iOS/Android testing, notification-delivery testing and game-specific moderation/reporting tooling remain release follow-ups. No staging or production deployment was performed for this task.

Local results: all 40 unit/API tests passed. All 22 game-flow browser tests passed (ten games plus decline/leave/skip/resume coverage, on two mobile-sized projects). Two additional accepted-match chat integration checks passed after correcting the test's conversation tap target; the composer stayed inside the viewport. This represents 24 distinct mobile test cases. Two further This or That preview runs passed while capturing screenshots. TypeScript, lint and build passed.

Issues corrected during QA: preview clicks before hydration were gated until controls were ready; completed-game catalogue browsing no longer gets displaced by background polling; chat tools wrap so the game button does not push other tools offscreen. Reports and screenshots are under `outputs/qa/dating-games`, `outputs/qa/dating-games-chat` and `outputs/qa/dating-games-chat-retest`.
