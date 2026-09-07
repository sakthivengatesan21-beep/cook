from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.config import UPLOADS_DIR, OUTPUTS_DIR, DATA_DIR, PORT, HOST
from app.api.routes import router
from app.api.captions_api import captions_router
from app.services.video_engine import generate_sample_demo_video

app = FastAPI(
    title="COOK - AI Short-Form Content Engine",
    description="One Video. Let It Cook. Turn long-form videos into viral short-form assets.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static media directories
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")

app.include_router(router)
app.include_router(captions_router)

@app.on_event("startup")
async def startup_event():
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print("COOK Backend initialized and ready.")

@app.get("/")
async def root():
    return {
        "brand": "COOK",
        "tagline": "ONE VIDEO. LET IT COOK.",
        "status": "online",
        "api_docs": "/docs",
        "endpoints": {
            "upload": "/api/upload",
            "process": "/api/process/{video_id}",
            "clips": "/api/clips/{video_id}",
            "export": "/api/export/{video_id}",
            "demo": "/api/demo/setup"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
