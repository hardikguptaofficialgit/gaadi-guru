# 🛵 Gaadi Guru — Ride. Record. Report.

**Turn a phone video of any Indian road into a measured, privacy-blurred, geotagged pothole complaint in about a minute.** It's powered by Meta **SAM 3.1** video segmentation, **Muse Spark** and **Muse Voice Transcribe**.

> In 2023, **2,161 people died in pothole-related crashes in India** (MoRTH, *Road Accidents in India 2023*). Most potholes never get reported, and the ones that do are reported as one blurry photo with no size, no location and no follow-up.

Built for the **Meta Global AI Developer Hackathon** (Indie track, "Build for Your World").

## What it does
1. **Upload a ride clip** from a bike, auto or car dashcam, with an optional Hindi or English voice note.
2. **Muse Spark looks at sampled frames and plans the inspection.** It describes the road type and surface, and picks the noun phrases SAM should segment (`pothole`, `water-filled pothole`, …).
3. **SAM 3.1 segments and tracks** every pothole through the video. It runs one concept per request, gives stable object IDs across frames, and returns `one_bit` masks.
4. **Dedup.** SAM track IDs, plus same-frame IoU merging, collapse repeat sightings so one pothole counts once.
5. **Severity.** The decoded mask area (not just the box) at the closest sighting, as a share of the frame, is weighted by how long the pothole stays visible. Each pothole is scored 0–100 and labelled LOW, MEDIUM, HIGH or CRITICAL.
6. **Privacy.** SAM 3.1 also segments `license plate` and `human face`, and those regions are Gaussian-blurred before any image leaves the system.
7. **Voice.** Muse Voice Transcribe turns the citizen's Hindi or Hinglish note (WAV, 16-bit mono, 16 kHz) into text.
8. **Complaint.** Muse Spark writes a factual bilingual (English + हिंदी) complaint with the counts, severities and GPS location.
9. **Heatmap.** Every report is added to a city heatmap with a shareable report link.

## Architecture
```
Next.js (upload · results · Leaflet heatmap · /report?id=)
        │  multipart POST /analyze
FastAPI backend ──► ffmpeg normalise (≤20 s, 8 fps → cheap SAM frames)
        ├─► muse-spark-1.3        plan prompts (vision)      /v1/responses
        ├─► Files API upload      → file_id
        ├─► sam-3.1 × N phrases   track + masks (stream)     /v1/responses
        ├─► sam-3.1 plate/face    privacy blur
        ├─► muse-voice-transcribe-1.0                        /v1/asr/transcribe
        └─► muse-spark-1.3        bilingual complaint JSON
```
| Meta model | Used for |
|---|---|
| `sam-3.1` | pothole segmentation and tracking in video, mask-area severity, plate and face privacy masks |
| `muse-spark-1.3` | visual inspection planning and complaint writing |
| `muse-voice-transcribe-1.0` | Hindi/English voice notes |
| `muse-wonder-1.0` *(stretch)* | computer-use agent that files the complaint on the municipal portal |

## Run it
```bash
# backend
python -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
export MODEL_API_KEY=...            # never commit it; .gitignore covers .env / .meta_key / .secrets
cd backend && ../.venv/bin/uvicorn app.main:app --port 8000
# frontend
cd frontend && npm i && NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```
Requires `ffmpeg`.

## De-risk results (Oct 30, 2026)
These are real API calls. Results are in [`docs/DERISK.md`](docs/DERISK.md).

## License
MIT
