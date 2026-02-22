"""
テキストチャット介入分析ツール - バックエンドAPI
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Intervention Analyzer API",
    description="テキストチャットログの介入分析ツール",
    version="0.1.0"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Intervention Analyzer API", "version": "0.1.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# ルーター登録
from routers import process
app.include_router(process.router, prefix="/api/process", tags=["process"])
