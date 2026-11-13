import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import engine
from app.models import article, user
from app.routers import analyze, auth, commodities, company, forex, news, profits, qna, sector

app = FastAPI(title="Equity Research AI")

user.Base.metadata.create_all(bind=engine)
article.Base.metadata.create_all(bind=engine)

frontend_origins = {"http://localhost:3000", "http://127.0.0.1:3000"}
frontend_origins.update(
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
)
frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
if frontend_url:
    frontend_origins.add(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(frontend_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(analyze.router, prefix="/api/analyze", tags=["analysis"])
app.include_router(company.router, prefix="/api/company", tags=["company"])
app.include_router(sector.router, prefix="/api/sector", tags=["sector"])
app.include_router(qna.router, prefix="/api/qna", tags=["qna"])
app.include_router(news.router, prefix="/api/news", tags=["news"])
app.include_router(forex.router, prefix="/api/forex", tags=["forex"])
app.include_router(commodities.router, prefix="/api/commodities", tags=["commodities"])
app.include_router(profits.router, tags=["profit analysis", "recommendations", "reports"])


@app.get("/")
@app.get("/api/")
def health_check():
    return {"message": "Equity Research AI Backend Running!"}
