# Cosmic Merge 🪐☀️

Drop planets into the tray, merge two of a kind into the next planet, and build the **Sun**.
Don't let the pile cross the red line. Pure HTML5 canvas — no build step, no dependencies, no asset files.

Run locally: `python3 -m http.server 8000` → open http://localhost:8000 (add `?debug` for analytics logging).

## What's in the game
- Real physics merge puzzle (11 planets, chain combos, shockwaves, Supernova bonus when two Suns meet)
- Cute faces, screen shake, particles, synthesized sound + haptics
- Daily Challenge (same seeded drop sequence for everyone, shareable score), Daily Reward streak
- Power-ups: Hammer, Shake, Swap · Skins: Cosmic, Candy, Neon, Gold

## Monetization (all wired, using dev mocks until real accounts exist)
| Lever | Where | Hook |
|---|---|---|
| Rewarded: Continue after game over | game over | `CM.ads.rewarded('continue')` |
| Rewarded: Double coins, free power-up, swap, daily x2, shop coins | various | `CM.ads.rewarded(placement)` |
| Interstitial after run (not before game 3, 75s cap, off if Remove Ads) | Play again / Home | `CM.ads.interstitial()` |
| IAP: Remove Ads, Starter Pack, 3 coin packs, Gold skin | Shop | `CM.iap.buy(id)` |

To go live: in `js/core.js` the mock providers are replaced by calling `CM.ads.setProvider({rewarded, interstitial})`
and `CM.iap.setProvider({buy, restore})` from the native wrapper (e.g. Capacitor + AdMob + Play Billing) or an H5 ad SDK.
Product ids: `remove_ads, starter_pack, coins_s, coins_m, coins_l, skin_gold`.

## Roadmap to scale
Online leaderboards, more skins/seasons, event modes, push reminders, analytics (hook: `CM.track`), A/B on ad frequency.

## Android build (Capacitor)
`sh scripts/build-www.sh && npm i && npx cap add android && npx cap sync android` → open in Android Studio.
Then add AdMob + billing plugins and call `CM.ads.setProvider` / `CM.iap.setProvider`. Change `appId` in `capacitor.config.json`. Replace `privacy.html` placeholder and host it for the Play listing.
