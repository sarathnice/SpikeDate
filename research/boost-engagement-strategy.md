# SpikeDate Profile Lift, Like and Super Spike Engagement Strategy

## Executive recommendation

SpikeDate should encourage action by helping people recognize a useful moment, not by manufacturing urgency. The best product pattern is a three-layer system:

1. **In-session contextual nudges** when intent is already high.
2. **A user-controlled weekly plan** for Likes, Super Spikes and Profile Lifts.
3. **Sparse push reminders** only when there is fresh, relevant value.

Profile Lift should be positioned as a temporary distribution tool: it increases the chance that a complete profile is encountered sooner by compatible people, but it does not improve compatibility or guarantee Likes. Like should remain the default expression of interest. Super Spike should be reserved for unusually strong interest and should encourage a personal note.

This framing is consistent with current category conventions. Tinder describes Boost as top-area placement for 30 minutes and reports up to 10 times more profile views; Bumble describes SuperSwipe as moving the sender to the front of a recipient’s queue. These are useful reference mechanics, but SpikeDate should avoid adopting unverified performance claims until its own experiment data supports them.[1][2]

## What the evidence supports

### Timely, relevant prompts outperform generic interruption

Apple’s notification guidance says notifications should provide timely, high-value information, should not repeat the same message, and should avoid merely telling people to perform tasks inside an app. Android guidance similarly emphasizes communication events and well-timed task reminders, and recommends direct navigation to the relevant destination.[3][4]

Therefore, “You still have a Profile Lift—use it now” is weak because it creates pressure without explaining relevance. “Your profile is complete and you have new compatible people nearby; see whether now is a good time for a Profile Lift” gives the person a reason, preserves choice, and deep-links to the Profile Lift explanation.

### Ask for notification permission after value is demonstrated

Apple recommends requesting notification permission in context rather than automatically at first launch. Google research covering more than 40 million Chrome users found that quieter, adaptive permission UI reduced unnecessary prompt actions by up to 30% while changing grant rates by less than 5%.[5][6]

For SpikeDate, the permission request should appear after a person completes a meaningful action—such as sending their first Like or scheduling a weekly dating session—not during registration. The pre-permission screen should let them select the reminders they want.

### Ranking claims require transparency

Paid visibility can change what other people see. The UK Competition and Markets Authority notes that ranking strongly affects selection and that paid placement can become misleading when users do not understand why results are ordered as they are. The same evidence review distinguishes helpful personalization from designs that exploit consumer biases.[7]

SpikeDate should explain that Profile Lift changes exposure order while preferences and compatibility rules remain intact. It should not call a lifted profile a “best match,” and should not let payment override safety, blocks, gender preferences, age, location, or deal-breaker filters.

### Scarcity can motivate, but false urgency damages trust

The FTC identifies false countdowns and fake limited-time claims as dark patterns. The CMA similarly warns that scarcity and personalization can pressure people into decisions that may not serve their interests.[8][9]

Real inventory is acceptable: “1 Profile Lift left this week” or “2 Super Spikes reset Monday” is factual and useful. “Lift now—your chance is disappearing” or an endlessly resetting countdown should never be used.

## Recommended engagement system

### 1. Profile Lift opportunity card

Show at most once per day and only when all eligibility conditions are true:

- The profile is at least 80% complete and contains three or more approved photos.
- The person has an unused Profile Lift.
- The person has not dismissed a Profile Lift prompt in the previous seven days.
- There are enough compatible profiles in the current radius to make promotion meaningful.
- The person is not already using Profile Lift.

Recommended copy:

> **A good moment for Profile Lift**  
> Your profile is ready. Profile Lift shows it sooner to compatible people for 30 minutes.  
> `Not now` · `See Profile Lift`

If SpikeDate later gathers reliable cohort data, the copy can become personalized without making a guarantee:

> People with preferences like yours are usually more active around 7–9 PM. Choose a time for your Profile Lift.

This statement should appear only if it is substantiated by recent aggregate data, uses a sufficiently large privacy-safe cohort, and clearly says “usually,” not “best” or “guaranteed.”

### 2. Like-session reminder

Likes should be encouraged through a lightweight dating routine, not daily guilt. Offer an optional plan such as “Review three profiles on Tuesday and Saturday.” A reminder should deep-link to a small, fresh set of compatible profiles and expire when those profiles are no longer available.

Recommended copy:

> **Three strong matches are ready to review**  
> Take your time—a thoughtful Like is better than rushing.  
> `Later` · `Show profiles`

Do not send a reminder simply because the daily Like allowance has not been used. That optimizes consumption rather than connection quality.

### 3. Super Spike decision support

Super Spike should be suggested after high-intent behavior, such as opening a full profile, viewing multiple photos, reading prompts, and spending meaningful time on the profile. It should not appear after every profile or immediately after a normal Like.

Recommended copy:

> **Noah stands out from today’s profiles**  
> Use a Super Spike only when you genuinely want to be seen first. Add a personal note.  
> `Keep browsing` · `Write an intro`

The system may say that the person appears before regular Likes, matching the product’s actual behavior. It should not claim that Super Spike makes a match more likely until controlled measurement supports that statement.

### 4. Weekly activity review

Place a compact card in Profile rather than interrupting discovery:

- Likes sent
- Super Spikes remaining and reset date
- Profile Lifts remaining
- Matches and replies attributable to each action, when enough data exists
- Reminder settings

Use neutral feedback. “2 of your 6 thoughtful Likes became matches” is informative. “You missed 8 opportunities” uses loss framing and should be avoided.

### 5. Notification controls

Create separate switches so consent is meaningful:

- New Likes and Super Spikes received
- New matches and messages
- Planned profile-review reminder
- Profile Lift opportunity reminder
- Weekly activity summary

Default promotional reminders off until the person opts in. Messages and match notifications should remain separately controlled. Provide quiet hours and a frequency selector: off, weekly, or twice weekly. Never include sensitive profile details in lock-screen copy.

## Trigger and frequency matrix

| Nudge                    | Trigger                                                    |                                     Frequency cap | Suppression                                                    |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------: | -------------------------------------------------------------- |
| Profile Lift opportunity | Eligible profile, unused Lift, meaningful nearby inventory | 1 per 7 days after dismissal; 1 per day otherwise | Active Lift, incomplete profile, no fresh compatible inventory |
| Like session             | User-selected day/time and fresh recommendations           |                                        2 per week | User already reviewed profiles that day                        |
| Super Spike suggestion   | High-intent full-profile behavior                          |                                     1 per session | No remaining Super Spikes, prior dismissal on that profile     |
| Allowance reset          | Actual weekly reset                                        |                                       1 per reset | User disabled product reminders                                |
| Weekly review            | User-selected day                                          |                                        1 per week | No meaningful activity to summarize                            |

## Product experiments

Run experiments in this order:

1. **Education:** plain icon-only controls versus one-time contextual definitions.
2. **Profile Lift timing:** generic profile-page entry versus eligibility-based opportunity card.
3. **Reminder control:** no plan versus user-scheduled weekly plan.
4. **Super Spike prompt:** no suggestion versus high-intent suggestion after full-profile engagement.
5. **Outcome feedback:** allowance-only status versus neutral weekly results.

Primary metrics:

- Meaningful action rate: Likes with notes, Super Spikes with notes, Profile Lift activation.
- Recipient outcomes: profile opens, reciprocal Likes, matches, first messages and replies.
- Long-term quality: seven-day conversations and safety reports.
- Trust guardrails: prompt dismissals, notification opt-outs, refunds, accidental purchases and blocks.

Do not optimize only for consumable usage or short-term revenue. A higher Profile Lift purchase rate accompanied by more notification opt-outs or lower reply quality is not a product win.

## Recommended first release

The safest and highest-value first release is:

1. Add the three contextual cards shown in the preview.
2. Add “How visibility works” in Profile and inside the subscription sheet.
3. Add an optional weekly plan with quiet hours.
4. Instrument impressions, dismissals, conversions, matches and replies.
5. Wait for product data before adding time-of-day personalization or performance claims.

## Sources

1. Tinder. [“Boost.”](https://www.help.tinder.com/hc/en-us/articles/115004506186-Boost) Updated January 14, 2025.
2. Bumble. [“SuperSwipe.”](https://bumble.com/features/superswipe/)
3. Apple. [“Notifications — Human Interface Guidelines.”](https://developer.apple.com/design/human-interface-guidelines/notifications)
4. Google. [“Android notifications — Material Design.”](https://m2.material.io/design/platform-guidance/android-notifications.html)
5. Apple. [“Asking permission to use notifications.”](https://developer.apple.com/documentation/UserNotifications/asking-permission-to-use-notifications)
6. Bilogrevic et al. [“Shhh...be Quiet! Reducing the Unwanted Interruptions of Notification Permission Prompts on Chrome.”](https://research.google/pubs/shhhbe-quiet-reducing-the-unwanted-interruptions-of-notification-permission-prompts-on-chrome/) USENIX Security 2021.
7. UK Competition and Markets Authority. [“Evidence review of Online Choice Architecture and consumer and competition harm.”](https://www.gov.uk/government/publications/online-choice-architecture-how-digital-design-can-harm-competition-and-consumers/evidence-review-of-online-choice-architecture-and-consumer-and-competition-harm) April 2022.
8. U.S. Federal Trade Commission. [“Bringing Dark Patterns to Light.”](https://www.ftc.gov/reports/bringing-dark-patterns-light) September 2022.
9. UK Competition and Markets Authority. [“Online choice architecture.”](https://www.gov.uk/government/collections/online-choice-architecture) Updated March 29, 2023.
