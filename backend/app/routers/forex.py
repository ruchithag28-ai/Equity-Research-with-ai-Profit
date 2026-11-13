import datetime
from typing import Optional

import requests
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

EXCHANGERATE_HOST = "https://api.exchangerate.host"
FRANKFURTER = "https://api.frankfurter.app"


def _validate_date(date_str: str) -> str:
    try:
        datetime.datetime.strptime(date_str, "%Y-%m-%d")
        return date_str
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")


def _fetch_exchangerate_host_timeseries(base: str, symbols: str, start_date: str, end_date: str):
    url = f"{EXCHANGERATE_HOST}/timeseries"
    params = {
        "start_date": start_date,
        "end_date": end_date,
        "base": base.upper(),
        "symbols": symbols.upper(),
    }
    resp = requests.get(url, params=params, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("success"):
        raise HTTPException(status_code=502, detail=data)
    return data


def _fetch_frankfurter_timeseries(base: str, symbols: str, start_date: str, end_date: str):
    url = f"{FRANKFURTER}/{start_date}..{end_date}"
    params = {
        "from": base.upper(),
        "to": symbols.upper(),
    }
    resp = requests.get(url, params=params, timeout=20)
    resp.raise_for_status()
    j = resp.json()
    # Convert to exchangerate.host-like structure
    return {
        "success": True,
        "base": base.upper(),
        "start_date": start_date,
        "end_date": end_date,
        "rates": j.get("rates", {}),
    }


@router.get("/timeseries")
def forex_timeseries(
    base: str = Query("USD", min_length=3, max_length=3),
    symbols: str = Query("EUR,INR", description="Comma-separated list of target currency codes"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
):
    today = datetime.date.today()
    if not end_date:
        end_date = today.isoformat()
    if not start_date:
        start_date = (today - datetime.timedelta(days=90)).isoformat()

    _validate_date(start_date)
    _validate_date(end_date)

    try:
        # Primary provider
        return _fetch_exchangerate_host_timeseries(base, symbols, start_date, end_date)
    except Exception:
        # Fallback provider
        try:
            return _fetch_frankfurter_timeseries(base, symbols, start_date, end_date)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Currency-rate providers are unavailable") from exc


