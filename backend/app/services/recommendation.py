from app.services.profit_analysis import get_company_financials
from app.services.sector_analysis import get_sector_profits


def get_recommendations() -> dict:
    companies, source = get_company_financials()
    sectors = get_sector_profits()["sectors"]
    if not sectors:
        return {"bestSector": None, "stocks": [], "riskLevel": "High", "expectedReturnPct": None, "source": source}

    # Transparent screening score: profitability, growth, and a volatility proxy.
    for sector in sectors:
        members = [item for item in companies if item["sector"] == sector["sector"]]
        growth = max(-30, min(40, sector["profitGrowthPct"]))
        margin = sector["profitMarginPct"] or 0
        variability = sum(abs(item["profitGrowthPct"]) for item in members) / max(1, len(members))
        sector["riskLevel"] = "High" if variability > 25 else "Medium" if variability > 15 else "Low"
        risk_penalty = {"Low": 0, "Medium": 5, "High": 12}[sector["riskLevel"]]
        sector["score"] = round(max(0, margin * 1.3 + growth * 0.35 - risk_penalty), 2)
    best_sector = max(sectors, key=lambda item: item["score"])
    candidates = list(companies)
    def stock_score(item: dict) -> float:
        margin = item["profitMarginPct"] or 0
        growth = max(-30, min(40, item["profitGrowthPct"]))
        risk_adjustment = 10 if item["sector"] in ("Metal", "Realty", "Auto") else 0
        return margin * 1.3 + growth * 0.35 - risk_adjustment
    candidates.sort(key=stock_score, reverse=True)
    stocks = []
    for item in candidates[:5]:
        growth = item["profitGrowthPct"]
        risk = "High" if abs(growth) > 25 or item["sector"] in ("Metal", "Realty", "Auto") else "Medium" if abs(growth) > 12 else "Low"
        action = "BUY" if growth > 12 and (item["profitMarginPct"] or 0) > 10 else "HOLD" if growth > 0 else "AVOID"
        stocks.append({
            "symbol": item["symbol"], "name": item["name"], "sector": item["sector"],
            "action": action, "riskLevel": risk,
            "expectedReturnPct": round(max(4, min(24, 6 + growth * 0.35)), 1),
            "reason": f"Latest reported profit was ₹{item['latestProfitCr']:,.0f} crore and changed {growth:.1f}% year over year. Review valuation and your own risk tolerance before investing.",
        })
    best_sector["reason"] = f"{best_sector['sector']} ranks first in this screen for profit margin and growth, adjusted for profit variability. This is a rules-based educational screen, not a personal forecast."
    return {
        "bestSector": best_sector,
        "stocks": stocks,
        "riskLevel": best_sector["riskLevel"],
        "expectedReturnPct": round(max(4, min(20, 5 + best_sector["profitGrowthPct"] * 0.3)), 1),
        "source": source,
        "method": "Profitability, latest annual growth, and historical profit variability; expected return is a screening estimate, not a guaranteed return.",
    }
