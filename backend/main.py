"""
テキストチャット介入分析ツール - バックエンドAPI
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Intervention Analyzer API",
    description="テキストチャットログの介入分析ツール",
    version="0.1.0"
)

# CORS設定
origins = [
    "http://localhost:3000",
]

# 本番URL追加（環境変数から）
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
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
