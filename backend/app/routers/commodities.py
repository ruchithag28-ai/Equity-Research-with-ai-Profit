import csv
import datetime
import io
import math
from typing import Dict, List, Optional

import requests
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()


STOOQ_SOURCES = {
    # Daily CSV with columns: Date,Open,High,Low,Close,Volume
    "gold": "https://stooq.com/q/d/l/?s=xauusd&i=d",  # Gold in USD
    "oil": "https://stooq.com/q/d/l/?s=cl.f&i=d",     # WTI Crude Oil Futures in USD
}


def _fetch_yahoo_gold(days: int) -> List[Dict[str, str]]:
    """Fetch daily COMEX gold futures closes (USD per troy ounce)."""
    url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF"
    if days <= 1:
        period, interval = "1d", "5m"
    elif days <= 7:
        period, interval = "1mo", "30m"
    elif days <= 30:
        period, interval = "1mo", "1d"
    elif days <= 90:
        period, interval = "3mo", "1d"
    elif days <= 365:
        period, interval = "1y", "1d"
    else:
        period, interval = "5y", "1d"
    response = requests.get(
        url,
        params={"range": period, "interval": interval},
        headers={"User-Agent": "Mozilla/5.0 (compatible; EquityResearchAI/1.0)"},
        timeout=20,
    )
    response.raise_for_status()
    chart = response.json().get("chart", {})
    if chart.get("error") or not chart.get("result"):
        raise RuntimeError("Yahoo Finance returned no gold price data")
    result = chart["result"][0]
    timestamps = result.get("timestamp", [])
    quote = (result.get("indicators", {}).get("quote") or [{}])[0]
    closes = quote.get("close", [])
    rows = []
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days) if days <= 7 else None
    for index, (timestamp, close) in enumerate(zip(timestamps, closes)):
        if close is not None:
            stamp = datetime.datetime.fromtimestamp(timestamp, datetime.timezone.utc)
            if cutoff and stamp < cutoff:
                continue
            day = stamp.strftime("%Y-%m-%dT%H:%M:%S") if days <= 1 else stamp.date().isoformat()
            row = {"Date": day, "Close": str(close)}
            for field, key in (("Open", "open"), ("High", "high"), ("Low", "low")):
                values = quote.get(key, [])
                if index < len(values) and values[index] is not None:
                    row[field] = str(values[index])
            rows.append(row)
    if not rows:
        raise RuntimeError("Yahoo Finance returned no usable gold prices")
    return rows


def _sample_gold_points(days: int, currency: str, unit: str) -> List[Dict[str, float]]:
    """Smooth deterministic demo series for offline charts; not a live quote."""
    now = datetime.datetime.now(datetime.timezone.utc)
    count = 24 if days == 1 else min(days, 1825)
    base = 7850.0 if currency == "INR" and unit == "gram" else 7850.0 * 31.1034768 if currency == "INR" else 2650.0
    if unit == "gram" and currency != "INR":
        base /= 31.1034768
    points = []
    previous = base
    for index in range(count):
        progress = index / max(count - 1, 1)
        value = base * (1 + 0.025 * progress + 0.006 * math.sin(index / max(count / 9, 1)) + 0.002 * math.sin(index / max(count / 27, 1)))
        opened = previous
        high = max(opened, value) * 1.0018
        low = min(opened, value) * 0.9982
        if days == 1:
            stamp = now - datetime.timedelta(hours=count - index - 1)
            date_label = stamp.strftime("%Y-%m-%dT%H:%M:%S")
        else:
            stamp = now.date() - datetime.timedelta(days=count - index - 1)
            date_label = stamp.isoformat()
        points.append({"date": date_label, "open": round(opened, 2), "high": round(high, 2), "low": round(low, 2), "value": round(value, 2)})
        previous = value
    return points


def _fetch_stooq_csv(url: str) -> List[Dict[str, str]]:
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()
    text = resp.text
    rdr = csv.DictReader(io.StringIO(text))
    rows = [r for r in rdr if r.get("Date") and r.get("Close") and r["Close"] != "-" ]
    return rows


def _fetch_usdinr_timeseries(days: int) -> Dict[str, float]:
    end = datetime.date.today()
    start = end - datetime.timedelta(days=days + 5)
    url = "https://api.exchangerate.host/timeseries"
    params = {"start_date": start.isoformat(), "end_date": end.isoformat(), "base": "USD", "symbols": "INR"}
    try:
        r = requests.get(url, params=params, timeout=20)
        r.raise_for_status()
        j = r.json()
        if not j.get("success"):
            raise RuntimeError("forex timeseries not successful")
        rates = j.get("rates", {})
        return {k: float(v.get("INR")) for k, v in rates.items() if v.get("INR") is not None}
    except Exception:
        try:
            r = requests.get(
                f"https://api.frankfurter.app/{start.isoformat()}..{end.isoformat()}",
                params={"from": "USD", "to": "INR"}, timeout=20,
            )
            r.raise_for_status()
            rates = r.json().get("rates", {})
            return {day: float(value["INR"]) for day, value in rates.items() if value.get("INR") is not None}
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Exchange-rate providers are unavailable") from exc


@router.get("/timeseries")
def commodity_timeseries(
    commodity: str = Query("gold", pattern="^(gold|oil)$"),
    currency: str = Query("INR", min_length=3, max_length=3),
    days: int = Query(30, ge=1, le=1825),
    unit: str = Query("ounce", description="Unit for pricing (ounce|gram). Applies to gold."),
):
    source = STOOQ_SOURCES.get(commodity)
    if not source:
        raise HTTPException(status_code=400, detail="Unsupported commodity")

    price_source = "Stooq"
    sample_fallback = False
    try:
        try:
            if commodity == "gold" and days <= 7:
                rows = _fetch_yahoo_gold(days)
                price_source = "Yahoo Finance COMEX gold futures (GC=F)"
            else:
                rows = _fetch_stooq_csv(source)
            if not rows:
                raise RuntimeError("Stooq returned no commodity prices")
        except Exception:
            if commodity != "gold":
                raise
            try:
                rows = _fetch_yahoo_gold(days)
                price_source = "Yahoo Finance COMEX gold futures (GC=F)"
            except Exception:
                rows = []
                sample_fallback = True
                price_source = "Illustrative smooth sample (not a live price)"
        if sample_fallback:
            unit_name = unit.lower() if commodity == "gold" else "ounce"
            sample_currency = currency.upper() if currency.upper() in ("INR", "USD") else "INR"
            points = _sample_gold_points(days, sample_currency, unit_name)
            return {"commodity": commodity, "currency": sample_currency, "unit": unit_name, "source": price_source, "isSample": True, "points": points}
        # Intraday Yahoo ranges already contain all points for the requested day/week.
        if not (commodity == "gold" and days <= 7):
            rows = rows[-days:]
        series_usd = [
            {"date": r["Date"], "value": float(r["Close"]),
             "open": float(r.get("Open") or r["Close"]),
             "high": float(r.get("High") or r["Close"]),
             "low": float(r.get("Low") or r["Close"])}
            for r in rows
            if r.get("Date") and r.get("Close") not in (None, "-")
        ]
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Gold price feeds are unavailable. Check the backend internet connection and retry.",
        ) from exc

    if not series_usd:
        if commodity == "gold" and currency.upper() in ("INR", "USD"):
            sample_unit = unit.lower() if currency.upper() == "INR" else "ounce"
            return {"commodity": "gold", "currency": currency.upper(), "unit": sample_unit, "source": "Illustrative smooth sample (not a live price)", "isSample": True, "points": _sample_gold_points(days, currency.upper(), sample_unit)}
        raise HTTPException(status_code=502, detail="The price provider returned no recent commodity prices")

    if currency.upper() == "USD":
        return {"commodity": commodity, "currency": "USD", "source": price_source, "isSample": False, "points": series_usd}

    if currency.upper() == "INR":
        try:
            fx = _fetch_usdinr_timeseries(days)
        except HTTPException:
            if commodity == "gold":
                return {"commodity": "gold", "currency": "INR", "unit": unit.lower(), "source": "Illustrative smooth sample (not a live price)", "isSample": True, "points": _sample_gold_points(days, "INR", unit.lower())}
            raise
        converted = []
        for p in series_usd:
            rate = fx.get(p["date"]) or list(sorted(fx.items()))[-1][1]
            inr_value = p["value"] * rate
            # If gold and unit is gram, convert troy ounce to grams
            if commodity == "gold" and unit.lower() == "gram":
                inr_value = inr_value / 31.1034768
            factor = rate / (31.1034768 if commodity == "gold" and unit.lower() == "gram" else 1)
            converted.append({"date": p["date"], "value": round(inr_value, 2), "open": round(p["open"] * factor, 2), "high": round(p["high"] * factor, 2), "low": round(p["low"] * factor, 2)})
        return {"commodity": commodity, "currency": "INR", "unit": unit.lower(), "source": price_source, "isSample": False, "points": converted}

    # For other currencies, attempt convert via USD->target using exchangerate.host on end date
    try:
        end = series_usd[-1]["date"]
        fx_url = f"https://api.exchangerate.host/convert"
        fx_params = {"from": "USD", "to": currency.upper(), "amount": 1}
        rr = requests.get(fx_url, params=fx_params, timeout=15)
        rr.raise_for_status()
        rate = float(rr.json().get("result") or 1.0)
    except Exception:
        raise HTTPException(status_code=502, detail="Exchange-rate provider is unavailable")
    converted_vals = []
    for p in series_usd:
        val = p["value"] * rate
        if commodity == "gold" and unit.lower() == "gram":
            val = val / 31.1034768
        factor = rate / (31.1034768 if commodity == "gold" and unit.lower() == "gram" else 1)
        converted_vals.append({"date": p["date"], "value": round(val, 2), "open": round(p["open"] * factor, 2), "high": round(p["high"] * factor, 2), "low": round(p["low"] * factor, 2)})
    return {"commodity": commodity, "currency": currency.upper(), "unit": unit.lower(), "source": price_source, "isSample": False, "points": converted_vals}


