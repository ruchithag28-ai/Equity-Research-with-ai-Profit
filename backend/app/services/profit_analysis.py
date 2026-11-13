"""Financial statement data for NSE company and sector profit analysis.

Yahoo Finance data is used when yfinance can return statements. The bundled
fallback is explicitly identified as illustrative and is never labelled live.
All profit and revenue figures are INR crore.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from functools import lru_cache
from typing import Any


# company, sector, latest sample net profit (INR crore), net-profit growth
# assumptions for the last five financial years, latest net margin percent
SEED_COMPANIES = [
    ("TCS", "Tata Consultancy Services", "IT", 48000, [0.10, 0.09, 0.08, 0.07, 0.06], 19.0),
    ("INFY", "Infosys", "IT", 26000, [0.12, 0.09, 0.08, 0.07, 0.06], 17.5),
    ("HCLTECH", "HCL Technologies", "IT", 17000, [0.11, 0.09, 0.08, 0.07, 0.06], 15.0),
    ("HDFCBANK", "HDFC Bank", "Banking", 70000, [0.18, 0.15, 0.12, 0.10, 0.08], 15.5),
    ("ICICIBANK", "ICICI Bank", "Banking", 50000, [0.24, 0.20, 0.15, 0.12, 0.09], 17.0),
    ("SBIN", "State Bank of India", "Banking", 70000, [0.35, 0.30, 0.20, 0.15, 0.10], 13.0),
    ("SUNPHARMA", "Sun Pharmaceutical", "Pharma", 12000, [0.20, 0.15, 0.12, 0.10, 0.08], 15.0),
    ("DRREDDY", "Dr. Reddy's Laboratories", "Pharma", 6000, [0.15, 0.13, 0.10, 0.08, 0.07], 19.0),
    ("CIPLA", "Cipla", "Pharma", 5000, [0.18, 0.15, 0.12, 0.09, 0.07], 14.0),
    ("MARUTI", "Maruti Suzuki India", "Auto", 14000, [0.25, 0.20, 0.16, 0.12, 0.08], 8.0),
    ("M&M", "Mahindra & Mahindra", "Auto", 12000, [0.30, 0.22, 0.18, 0.14, 0.10], 8.5),
    ("TATAMOTORS", "Tata Motors", "Auto", 28000, [0.45, 0.35, 0.25, 0.18, 0.12], 7.0),
    ("HINDUNILVR", "Hindustan Unilever", "FMCG", 10500, [0.12, 0.10, 0.09, 0.08, 0.07], 16.0),
    ("ITC", "ITC", "FMCG", 25000, [0.14, 0.12, 0.10, 0.08, 0.07], 27.0),
    ("NESTLEIND", "Nestle India", "FMCG", 3300, [0.15, 0.12, 0.10, 0.08, 0.07], 16.0),
    ("RELIANCE", "Reliance Industries", "Energy", 79000, [0.18, 0.14, 0.12, 0.10, 0.08], 7.5),
    ("NTPC", "NTPC", "Energy", 22000, [0.14, 0.12, 0.10, 0.09, 0.07], 10.0),
    ("POWERGRID", "Power Grid Corporation", "Energy", 15000, [0.12, 0.10, 0.09, 0.08, 0.07], 32.0),
    ("TATASTEEL", "Tata Steel", "Metal", 8500, [0.40, 0.30, 0.20, 0.12, 0.08], 5.0),
    ("HINDALCO", "Hindalco Industries", "Metal", 11000, [0.30, 0.24, 0.18, 0.12, 0.08], 6.0),
    ("JSWSTEEL", "JSW Steel", "Metal", 8000, [0.32, 0.25, 0.18, 0.12, 0.08], 5.5),
    ("DLF", "DLF", "Realty", 5000, [0.35, 0.28, 0.22, 0.15, 0.10], 24.0),
    ("GODREJPROP", "Godrej Properties", "Realty", 1700, [0.38, 0.30, 0.22, 0.15, 0.10], 12.0),
    ("LODHA", "Lodha Developers", "Realty", 1900, [0.34, 0.27, 0.20, 0.14, 0.10], 13.0),
]

YEARS = ["FY2021", "FY2022", "FY2023", "FY2024", "FY2025"]


def _sample_company(seed: tuple) -> dict[str, Any]:
    symbol, name, sector, latest, growth, margin = seed
    profits = [float(latest)]
    for rate in growth[:4]:
        profits.append(profits[-1] / (1 + rate))
    profits.reverse()
    latest_revenue = latest / (margin / 100)
    revenues = [latest_revenue * (0.70 + index * 0.075) for index in range(5)]
    annual = [
        {"year": year, "profitCr": round(profit, 2), "revenueCr": round(revenue, 2)}
        for year, profit, revenue in zip(YEARS, profits, revenues)
    ]
    quarter_factors = [0.94, 1.01, 1.04, 1.01]
    quarters = [
        {"quarter": f"FY2025 Q{index + 1}", "profitCr": round(latest * factor / 4, 2)}
        for index, factor in enumerate(quarter_factors)
    ]
    return _company_result(symbol, name, sector, annual, quarters, "Sample estimate")


def _company_result(symbol: str, name: str, sector: str, annual: list, quarters: list, source: str) -> dict:
    annual = sorted(annual, key=lambda row: row["year"])
    latest = annual[-1]["profitCr"] if annual else 0
    previous = annual[-2]["profitCr"] if len(annual) > 1 else 0
    revenue = annual[-1].get("revenueCr") or 0
    return {
        "symbol": symbol, "name": name, "sector": sector, "annual": annual,
        "quarterly": quarters, "latestProfitCr": round(latest, 2),
        "profitGrowthPct": round((latest - previous) / abs(previous) * 100, 2) if previous else 0,
        "profitMarginPct": round(latest / revenue * 100, 2) if revenue else None,
        "dataSource": source,
    }


def _fetch_yfinance(seed: tuple) -> dict | None:
    try:
        import yfinance as yf
        symbol, name, sector, *_ = seed
        ticker = yf.Ticker(f"{symbol}.NS")
        statement = ticker.income_stmt
        if statement is None or statement.empty or "Net Income" not in statement.index:
            return None
        annual = []
        for period in list(statement.columns)[:5]:
            profit = statement.loc["Net Income", period]
            revenue = statement.loc["Total Revenue", period] if "Total Revenue" in statement.index else None
            if profit is None or str(profit) == "nan":
                continue
            annual.append({
                "year": f"FY{period.year}",
                "profitCr": round(float(profit) / 10_000_000, 2),
                "revenueCr": round(float(revenue) / 10_000_000, 2) if revenue is not None and str(revenue) != "nan" else None,
            })
        annual.sort(key=lambda row: row["year"])
        if len(annual) < 2:
            return None
        quarterly = []
        quarter_statement = ticker.quarterly_income_stmt
        if quarter_statement is not None and not quarter_statement.empty and "Net Income" in quarter_statement.index:
            for period in list(quarter_statement.columns)[:4]:
                value = quarter_statement.loc["Net Income", period]
                if value is not None and str(value) != "nan":
                    quarterly.append({"quarter": period.strftime("%b %Y"), "profitCr": round(float(value) / 10_000_000, 2)})
        return _company_result(symbol, name, sector, annual, quarterly, "Yahoo Finance (NSE: .NS)")
    except Exception:
        return None


@lru_cache(maxsize=1)
def get_company_financials() -> tuple[list[dict], str]:
    """Load available live statements once per process; label fallback clearly."""
    records = [_sample_company(seed) for seed in SEED_COMPANIES]
    try:
        import yfinance  # noqa: F401
        live_by_symbol = {}
        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = {pool.submit(_fetch_yfinance, seed): seed[0] for seed in SEED_COMPANIES}
            for future in as_completed(futures, timeout=45):
                record = future.result()
                if record:
                    live_by_symbol[record["symbol"]] = record
        records = [live_by_symbol.get(row["symbol"], row) for row in records]
    except Exception:
        pass
    live_count = sum(row["dataSource"].startswith("Yahoo") for row in records)
    if live_count == len(records):
        source = "Yahoo Finance live company financial statements"
    elif live_count:
        source = f"Yahoo Finance live data for {live_count} of {len(records)} companies; sample estimates for the rest"
    else:
        source = "Illustrative sample estimates (live statements unavailable)"
    return records, source


def get_company(symbol: str) -> dict | None:
    return next((row for row in get_company_financials()[0] if row["symbol"].lower() == symbol.lower()), None)
