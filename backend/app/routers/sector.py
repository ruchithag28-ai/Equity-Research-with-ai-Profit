from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import requests
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List

from app.services.fake_news import predict_fake_news, train_fake_news

router = APIRouter()

INDIAN_SECTOR_INDICES = [
    ("NIFTY Bank", "^NSEBANK"),
    ("NIFTY IT", "^CNXIT"),
    ("NIFTY Auto", "^CNXAUTO"),
    ("NIFTY FMCG", "^CNXFMCG"),
    ("NIFTY Pharma", "^CNXPHARMA"),
    ("NIFTY Energy", "^CNXENERGY"),
    ("NIFTY Metal", "^CNXMETAL"),
    ("NIFTY Realty", "^CNXREALTY"),
    ("NIFTY Media", "^CNXMEDIA"),
    ("NIFTY PSU Bank", "^CNXPSUBANK"),
]

# These US-listed funds track the corresponding S&P 500 sector groups.
GLOBAL_SECTOR_ETFS = [
    ("Communication Services", "XLC"),
    ("Consumer Discretionary", "XLY"),
    ("Consumer Staples", "XLP"),
    ("Energy", "XLE"),
    ("Financials", "XLF"),
    ("Health Care", "XLV"),
    ("Industrials", "XLI"),
    ("Materials", "XLB"),
    ("Real Estate", "XLRE"),
    ("Technology", "XLK"),
    ("Utilities", "XLU"),
]

# Clearly marked demonstration quotes used only when Yahoo has no NSE sector
# quotes. These are reference values, not live prices.
SAMPLE_NSE_SECTOR_QUOTES = [
    ("NIFTY Bank", "^NSEBANK", 59_420.0, 0.42),
    ("NIFTY IT", "^CNXIT", 38_760.0, -0.31),
    ("NIFTY Pharma", "^CNXPHARMA", 22_180.0, 0.56),
    ("NIFTY Auto", "^CNXAUTO", 25_940.0, 0.27),
    ("NIFTY FMCG", "^CNXFMCG", 56_320.0, -0.12),
    ("NIFTY Energy", "^CNXENERGY", 43_650.0, 0.38),
]


def _sample_nse_quotes() -> list[dict]:
    return [
        {
            "region": "india", "name": name, "ticker": ticker,
            "price": price, "change": round(price * change_pct / 100, 2),
            "changePct": change_pct, "currency": "INR",
            "marketState": "SAMPLE_REFERENCE", "observedAt": None,
            "source": "Illustrative NSE reference fallback", "available": True,
            "isSample": True,
        }
        for name, ticker, price, change_pct in SAMPLE_NSE_SECTOR_QUOTES
    ]


def _fetch_market_quote(region: str, name: str, ticker: str) -> dict:
    """Fetch the latest available Yahoo Finance quote and previous close."""
    symbol = ticker.replace("^", "%5E")
    response = requests.get(
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
        params={"range": "5d", "interval": "1d", "events": "history"},
        headers={"User-Agent": "Mozilla/5.0 EquityResearchAI/1.0"},
        timeout=12,
    )
    response.raise_for_status()
    payload = response.json().get("chart", {})
    if payload.get("error") or not payload.get("result"):
        raise ValueError("No quote was returned by the market data provider")
    result = payload["result"][0]
    meta = result.get("meta", {})
    quote = (result.get("indicators", {}).get("quote") or [{}])[0]
    closes = [float(value) for value in quote.get("close", []) if value is not None]
    price = meta.get("regularMarketPrice")
    previous = closes[-2] if len(closes) >= 2 else (meta.get("previousClose") or meta.get("chartPreviousClose"))
    if price is None and closes:
        price = closes[-1]
    if price is None or previous is None or float(previous) == 0:
        raise ValueError("The provider did not return both a latest price and prior close")
    timestamp = meta.get("regularMarketTime")
    observed_at = datetime.fromtimestamp(timestamp, timezone.utc).isoformat() if timestamp else datetime.now(timezone.utc).isoformat()
    change = float(price) - float(previous)
    return {
        "region": region,
        "name": name,
        "ticker": ticker,
        "price": round(float(price), 4),
        "change": round(change, 4),
        "changePct": round((change / float(previous)) * 100, 4),
        "currency": meta.get("currency", "INR" if region == "india" else "USD"),
        "marketState": meta.get("marketState", "UNKNOWN"),
        "observedAt": observed_at,
        "source": "Yahoo Finance",
        "available": True,
    }


@router.get("/performance")
def sector_performance(region: str = Query("both", pattern="^(both|india|global)$")):
    """Return real NSE sector index and global sector ETF market quotes."""
    instruments = []
    if region in ("both", "india"):
        instruments.extend(("india", name, ticker) for name, ticker in INDIAN_SECTOR_INDICES)
    if region in ("both", "global"):
        instruments.extend(("global", name, ticker) for name, ticker in GLOBAL_SECTOR_ETFS)

    quotes = []
    with ThreadPoolExecutor(max_workers=10) as pool:
        pending = {
            pool.submit(_fetch_market_quote, market, name, ticker): (market, name, ticker)
            for market, name, ticker in instruments
        }
        for future in as_completed(pending):
            market, name, ticker = pending[future]
            try:
                quotes.append(future.result())
            except Exception as exc:
                quotes.append({
                    "region": market,
                    "name": name,
                    "ticker": ticker,
                    "price": None,
                    "change": None,
                    "changePct": None,
                    "currency": "INR" if market == "india" else "USD",
                    "marketState": "UNAVAILABLE",
                    "observedAt": None,
                    "source": "Yahoo Finance",
                    "available": False,
                    "error": str(exc),
                })

    quotes.sort(key=lambda item: (item["region"], item["name"]))
    sample_used = False
    if region in ("both", "india"):
        by_ticker = {item["ticker"]: item for item in quotes}
        for fallback in _sample_nse_quotes():
            current = by_ticker.get(fallback["ticker"])
            if current is None or not current.get("available"):
                by_ticker[fallback["ticker"]] = fallback
                sample_used = True
        quotes = list(by_ticker.values())
        quotes.sort(key=lambda item: (item["region"], item["name"]))
    return {
        "items": quotes,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "Yahoo Finance with illustrative NSE fallback" if sample_used else "Yahoo Finance",
        "sampleFallbackUsed": sample_used,
        "sampleNote": "Fallback figures are illustrative examples, not current NSE prices." if sample_used else None,
        "globalNote": "Global sectors are represented by State Street Select Sector SPDR ETFs; prices are fund prices, not index levels.",
    }

class PredictRequest(BaseModel):
    texts: List[str]

@router.post("/fake-news/predict")
def fake_news_predict(req: PredictRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail="texts must be a non-empty list")
    preds = predict_fake_news(req.texts)
    return {"items": preds}

class TrainRequest(BaseModel):
    dataset: str | None = "liar"
    output_dir: str | None = "models/fake_news"

@router.post("/fake-news/train")
def fake_news_train(req: TrainRequest):
    result = train_fake_news(model_out_dir=req.output_dir or "models/fake_news", dataset_name=req.dataset or "liar")
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("error") or "Training failed")
    return result

@router.get("/{sector_name}")
def sector_info(sector_name: str):
    # Placeholder logic (kept)
    return {"sector": sector_name, "top_companies": ["Apple", "Microsoft"]}

