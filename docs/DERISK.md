# De-risk tests: Meta Model API (Oct 30, 2026, IST)

| Test | Result |
|---|---|
| SAM 3.1 image, `pothole`, 1024×768 data URL | ✅ 2 potholes, conf ~0.75, ~2 s. `one_bit` masks decode with `meta-sam-parser` (pass the marker + payload) |
| SAM 3.1 video, data URL, 30 frames 640×480 | ✅ 30/30 frames, stable IDs, ~6 s |
| SAM 3.1 video via Files API `file_id` | ✅ same result |
| SAM 3.1 video, 1280×720, 240 frames (10 s @ 24 fps, bike POV) | ✅ every frame segmented, 15–16 tracks, 67–99 s |
| SAM 3.1 video, 600 frames 640×480 (12 MB) | ✅ all 600 frames, 82 s |
| Muse Spark 1.3 vision, image → JSON prompt plan | ✅ ~5 s, useful phrases |
| Muse Voice Transcribe, Hindi WAV 16 kHz, 30 s | ✅ accurate Devanagari transcript. Needs multipart `request` JSON (`audioEncoding:"WAV"`) + `audio` parts |
| Full pipeline on a 10 s bike clip (8 fps → 80 frames, 2 Spark phrases + 2 privacy phrases) | ✅ 14 potholes, severities, blurred images, bilingual complaint, **71 s end-to-end** |

**Video limits we observed:** the largest clip so far, 600 frames, worked fine. No frame limit is documented. Throughput is roughly 3–8 frames/s, so the pipeline downsamples to 8 fps and caps clips at 20 s, which keeps the SAM cost to about 160 frames × $0.20/1k ≈ $0.03 per phrase.
