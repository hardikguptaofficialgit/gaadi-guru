# Submission drafts (Cerebral Valley form + X posts)

> **DRAFTS ONLY.** Nothing here has been submitted or posted. Hardik reviews and sends.

## Form answers

**Project name:** Gaadi Guru

**Tagline:** Ride. Record. Report. Turn a phone ride video into a measured, privacy-safe pothole complaint that gets followed up.

**Description:**
In 2023, 2,161 people died in pothole-related crashes in India (MoRTH). Most potholes never get reported, and the reports that do get filed are a single blurry photo with no size, no location and no follow-up.

Gaadi Guru turns a 20-second phone video from a bike, auto or car into a complete civic complaint in about a minute:
- **Muse Spark** plans what to look for.
- **SAM 3.1** segments and tracks every pothole and hazard through the video, so each one counts once, with severity from the real mask area and a ₹ repair estimate.
- Faces and number plates are found by SAM and blurred before anything is stored.
- A **Muse Spark agent** then runs seven tools: analyze, check duplicates, estimate cost, draft a bilingual complaint, file it, schedule a follow-up, and verify the repair. **Muse Wonder** fills the city's grievance form and stops before Submit, so the citizen stays in control.
- Seven days later a **re-ride** checks whether the road was really fixed (fixed / not fixed / inconclusive). If not, Gaadi Guru drafts an escalation.

Each ward gets a public accountability page showing promised vs fixed and overdue reports. A live ride mode warns riders in Hindi, "आगे गड्ढा है", and an offline queue keeps frames when the network drops. Every report also feeds an open COCO-format pothole dataset.

**Meta models used and how:**
| Model | How |
|---|---|
| `sam-3.1` | Video segmentation and tracking of potholes and 5 other hazards (one concept per call, stable object IDs, 1-bit masks → area-based severity). Faces and number plates are segmented for privacy blur. Single-frame image calls power live ride alerts and re-ride verification. |
| `muse-spark-1.3` | Vision inspection planning (picks which SAM concepts to run), bilingual EN/HI complaint writing, the 7-tool agent loop (Responses API function calling), and escalation drafts. |
| `muse-voice-transcribe-1.0` | Hindi/Hinglish/English voice notes from the rider. |
| `muse-wonder-1.0` | Computer-use agent that fills the municipal grievance portal and is blocked in code from pressing Submit. |

**Tech stack:**
- **Backend:** FastAPI (Python), ffmpeg, OpenCV, NumPy, Playwright Chromium (for Wonder), pycocotools-style RLE export.
- **Frontend:** Next.js 14, Framer Motion, Leaflet, IndexedDB offline queue, and `next/og` share cards.
- **Infrastructure:** SHA-256 video cache and a hard spend guard ($70 cap).
- **Tests:** pytest (32 passed, 1 skipped) and Playwright E2E (12 tests, real stitch pipeline with Meta mocked server-side).

**Challenges:**
- SAM returns many overlapping tracks per pothole. We built a union-find dedup across prompts and re-entries so one pothole counts once.
- Turning mask area into a defensible severity and ₹ estimate without depth data, with the assumptions labelled honestly.
- Re-ride verification must never claim a fix it can't see. When Spark and SAM disagree, the verdict is INCONCLUSIVE.
- Keeping Wonder useful but safe: it fills the form, and Submit is blocked in code.
- Budget: per-frame SAM billing pushed us to 8 fps, 20 s clips, caching and a spend guard. The whole build so far cost about $3.

**What's next:**
- Pilot with one Bhubaneswar ward and real portal access, with citizen consent and OTP.
- Depth-aware sizing.
- A WhatsApp bot for reporting.
- Publish the open dataset on Hugging Face.
- Share ward accountability data with local newsrooms.

## Draft X posts (Most Viral bonus)

**1 (hook):**
> 2,161 people died in pothole crashes in India in 2023.
> So I built Gaadi Guru: ride your bike with your phone, and Meta SAM 3.1 finds every pothole, blurs faces & plates, prices the repair and fills the complaint for you.
> It stops before Submit. You stay in charge. 🛵
> #MetaHackathon [demo video]

**2 (the accountability angle):**
> Every ward promises to fix roads. Now there's a receipt.
> Gaadi Guru re-rides the same road 7 days later and checks whether the pothole is actually gone: fixed, not fixed, or inconclusive.
> Ward pages show promised vs fixed, shareable on WhatsApp.
> Built with SAM 3.1 + Muse Spark. #MetaHackathon [ward page screenshot]

**3 (the live ride moment):**
> "आगे गड्ढा है" (pothole ahead)
> Mount your phone, ride, and SAM 3.1 warns you in Hindi before you hit it. It costs a quarter of a cent per frame, and frames queue offline when the network drops.
> Gaadi Guru, for every Indian road. 🇮🇳 #MetaHackathon [15 s clip]
