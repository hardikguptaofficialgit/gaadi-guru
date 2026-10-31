# Patchwise: 3-minute demo script

**Setup before recording:** backend on :8000 and frontend on :3000. Phone on a handlebar mount for the live-ride scene, browser zoom at 110%, Hindi set to off. Pre-load these:
- Report `a17ea6e169`: agent already run, re-ride verdict INCONCLUSIVE, escalation drafted.
- `samples/reride5s.mp4`: a cache hit, so the upload costs $0 and returns in about 2 s.

Rubric weights: **Impact 30 · Meta tooling 25 · Tech depth 20 · Demo 25**. Every scene is tagged with what it scores.

| # | Time | Scene (on screen) | Voiceover | Rubric |
|---|---|---|---|---|
| 1 | 0:00–0:15 | Landing page: the 2,161 counter ticks up over a pothole clip. | "In 2023, 2,161 people died in pothole crashes in India. Most potholes are never reported. When they are, it's one blurry photo that nobody follows up." | Impact |
| 2 | 0:15–0:40 | **Live ride**: phone camera on a real road, a SAM box appears, and the phone says "आगे गड्ढा है". | "Patchwise rides with you. Every 2.5 seconds a frame goes to SAM 3.1. When there's a pothole ahead in your lane, it warns you in Hindi. That costs a quarter of a cent per frame." | Meta tooling, Demo |
| 3 | 0:40–1:05 | Report → upload the ride clip → live progress steps → review page with tracked masks, severity, the ₹ estimate and the bilingual complaint. | "Upload the ride. Muse Spark looks at the road and decides what SAM should look for. SAM 3.1 tracks each pothole through the video, so one pothole counts once. Mask area gives severity and a repair cost. Spark writes the complaint in English and Hindi." | Meta tooling, Tech depth |
| 4 | 1:05–1:30 | Press **Send** → the agent timeline streams: analyze → duplicates → cost → draft → file → follow-up. | "Then an agent takes over. Muse Spark calls seven real tools: it checks duplicates nearby, prices the repair, drafts the complaint, files it, and schedules a 7-day follow-up. Every step is shown here." | Tech depth, Meta tooling |
| 5 | 1:30–1:50 | Muse Wonder screenshots of the grievance portal form filling in, ending on the filled form with **Submit untouched**. | "Muse Wonder fills the city's grievance form like a person would, then stops before Submit. The citizen presses it. An AI never files in your name without you." | Meta tooling, Impact |
| 6 | 1:50–2:15 | **Re-ride**: upload the second ride → verdict badge INCONCLUSIVE → escalation draft card "Draft only · not sent". | "Seven days later you ride the same road. SAM compares before and after. Here Spark still sees damage that SAM couldn't mask, so we say *inconclusive* instead of claiming a fix. The follow-up job drafts an escalation to the Executive Engineer. It's a draft only. You decide." | Tech depth, Impact |
| 7 | 2:15–2:35 | City map → Ward ranking → ward page: promised vs fixed, overdue list, the WhatsApp share and its preview card. | "Every ward gets a public record: how much it promised, how much it fixed, and what's overdue. One link, ready for WhatsApp." | Impact, Demo |
| 8 | 2:35–2:50 | Before/after frames with faces and plates blurred, then the COCO export download. | "Privacy first: SAM 3.1 finds faces and number plates, and we blur them before anything is stored. Every report also builds an open, COCO-format pothole dataset with real masks." | Impact, Tech depth |
| 9 | 2:50–3:00 | Logo plus the line "Ride. Record. Report." and the spend meter. | "Three Meta models, one phone, and the whole demo cost under four dollars. Patchwise: ride, record, report." | Demo |

**Cut lines if you run long:** drop scene 8's COCO download (keep the blur), and shorten scene 3 to the review page only.
**Never on screen:** the API key, `.env`, or a real portal submit.
