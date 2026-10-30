import sys, json, time, cv2, numpy as np
sys.path.insert(0, "backend")
from app import meta
img = cv2.resize(cv2.imread("samples/pothole.jpg"), (1024, 768))
ok, jpg = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
url = meta.data_url(jpg.tobytes(), "image/jpeg")
which = sys.argv[1]
t = time.time()
if which == "sam":
    dets, raw = meta.sam_segment("pothole", image_url=url)
    print("raw[:300]", raw[:300])
    for d in dets: print(d.object_id, d.box, d.confidence, d.mask_hw, d.mask_area_px, d.img_w, d.img_h)
elif which == "spark":
    print(meta.spark_json("You plan road-damage segmentation. Reply JSON only: {\"prompts\":[noun phrases], \"notes\":str}",
        [{"type":"input_text","text":"What road defects are visible? Give SAM noun phrases."},{"type":"input_image","image_url":url}]))
print("secs", round(time.time()-t,1))
