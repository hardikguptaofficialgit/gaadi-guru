import sys,time;sys.path.insert(0,"backend")
from app import meta
from pathlib import Path
try: print("ASR:", str(meta.transcribe(open("samples/hi.wav","rb").read(),["Hindi","English"],["gaddha","pothole"]))[:400],flush=True)
except Exception as e: print("ASR ERR",e,flush=True)
for f in sys.argv[1:]:
    t=time.time()
    try:
        fid=meta.upload_file(Path(f))
        d,_=meta.sam_segment("pothole",file_id=fid)
        fr={x.frame for x in d}
        print(f,"OK frames_with_dets",len(fr),"max",max(fr) if fr else None,"ids",sorted({x.object_id for x in d},key=int)[:20],"secs",round(time.time()-t,1),flush=True)
    except Exception as e: print(f,"ERR",str(e)[:400],round(time.time()-t,1),flush=True)
