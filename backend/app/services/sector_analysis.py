from collections import defaultdict

from app.services.profit_analysis import get_company_financials


def get_sector_profits() -> dict:
    companies, source = get_company_financials()
    grouped = defaultdict(list)
    for company in companies:
        grouped[company["sector"]].append(company)
    sectors = []
    for name, members in grouped.items():
        latest_profit = sum(item["latestProfitCr"] for item in members)
        previous_profit = sum(item["annual"][-2]["profitCr"] for item in members if len(item["annual"]) > 1)
        revenue = sum((item["annual"][-1].get("revenueCr") or 0) for item in members)
        top = sorted(members, key=lambda item: item["latestProfitCr"], reverse=True)[:3]
        sectors.append({
            "sector": name, "totalProfitCr": round(latest_profit, 2),
            "profitGrowthPct": round((latest_profit - previous_profit) / previous_profit * 100, 2) if previous_profit else 0,
            "profitMarginPct": round(latest_profit / revenue * 100, 2) if revenue else None,
            "companies": len(members),
            "topCompanies": [{"symbol": item["symbol"], "name": item["name"], "profitCr": item["latestProfitCr"]} for item in top],
        })
    sectors.sort(key=lambda item: item["totalProfitCr"], reverse=True)
    return {"sectors": sectors, "source": source, "currency": "INR crore", "period": "Latest annual financial year", "updatedAt": __import__("datetime").datetime.now().astimezone().isoformat()}
