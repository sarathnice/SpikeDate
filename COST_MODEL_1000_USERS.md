# SpikeDate cost model — first 1,000 onboarded users

Estimate date: September 13, 2026. Prices are USD and should be checked again
before purchasing services.

## Assumptions

- 1,000 registered users.
- Six prepared WebP profile photos per user, averaging 1 MB each.
- Two delivery variants per photo (card and full profile).
- One venue-search session per user during onboarding.
- One successful identity/liveness attempt per user.
- Optional US SMS verification uses one message per successful verification.
- Normal early-stage API traffic remains within the listed Cloudflare included
  usage.

## Estimated onboarding-month cost

| Item                             |                                                   Calculation | Estimate |
| -------------------------------- | ------------------------------------------------------------: | -------: |
| Cloudflare Workers Paid          |                                        Minimum monthly charge |    $5.00 |
| D1                               |                          Expected inside paid-plan allowances |    $0.00 |
| R2 photos                        |                           6 GB, inside 10 GB included storage |    $0.00 |
| Cloudflare Images                | 12,000 unique transforms; 5,000 included; 7,000 × $0.50/1,000 |    $3.50 |
| Mapbox Search Box                |           1,000 sessions, inside 2,500 standard free sessions |    $0.00 |
| Cloudflare Turnstile             |                                                     Free plan |    $0.00 |
| AWS Rekognition Face Liveness    |                                                1,000 × $0.015 |   $15.00 |
| AWS Rekognition CompareFaces     |                                                1,000 × $0.001 |    $1.00 |
| Firebase phone verification (US) |                                  1,000 messages × about $0.01 |   $10.00 |

### Practical totals

- Email login + manual verification sampling: approximately **$9**, excluding
  human moderation.
- Email login + automated liveness and face comparison: approximately **$25**.
- US SMS onboarding + automated liveness and face comparison: approximately
  **$35–$45**, allowing for retries and modest image usage.

If every user also uploads one 10 MB video, total R2 storage becomes roughly
16 GB. At current standard storage rates, the 6 GB above the included 10 GB is
only about **$0.09/month**; video transcoding or streaming would be additional.

## Expected steady monthly platform cost at 1,000 active users

A reasonable early range is **$10–$25/month** for Workers, data, media, image
variants, and modest venue search. Verification and SMS are usage events and
should be budgeted separately. Customer support, human moderation, legal/privacy
review, insurance, email delivery, app-store fees, store commissions, and a
production identity-verification vendor are not included.

## Cost controls

1. Keep device-side photo cropping and WebP preparation to reduce R2 and image
   processing usage.
2. Generate only two stable image variants and cache them.
3. Use one phone verification at registration, not at every login. The local
   mock provider keeps development free; Firebase can be replaced without UI
   changes if regional pricing favors another vendor.
4. Run liveness at onboarding and again only for risk events, not every login.
5. Keep venue search session-based and debounce typing.
6. Keep continuous voice AI disabled by default; it is not included here.
7. Add per-user rate limits and Turnstile before public registration.
8. Use free FCM push delivery and store the same event in-app; let users disable
   low-value categories and set quiet hours.
9. Enforce one 15-second, 30-MB profile video and defer transcoding/streaming
   until usage data proves it is needed.
10. Keep activity briefings on device TTS; leave microphone AI disabled.

## Pricing references

- Cloudflare Workers, D1, and R2: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Images: https://developers.cloudflare.com/images/pricing/
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/plans/
- Mapbox Search: https://www.mapbox.com/pricing
- AWS Rekognition: https://aws.amazon.com/rekognition/pricing/
- Google Cloud Identity Platform phone pricing: https://cloud.google.com/identity-platform/pricing
- Firebase Cloud Messaging pricing: https://firebase.google.com/pricing
