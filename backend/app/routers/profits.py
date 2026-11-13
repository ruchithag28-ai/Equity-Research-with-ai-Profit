from io import BytesIO

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.services.profit_analysis import get_company, get_company_financials
from app.services.recommendation import get_recommendations
from app.services.sector_analysis import get_sector_profits

router = APIRouter()


@router.get("/api/sectors/profits")
def sector_profits():
    return get_sector_profits()


@router.get("/api/recommendations")
def recommendations():
    return get_recommendations()


@router.get("/api/companies/top-profitable")
def top_profitable_companies():
    companies, source = get_company_financials()
    return {"companies": sorted(companies, key=lambda row: row["latestProfitCr"], reverse=True)[:10], "source": source, "currency": "INR crore"}


@router.get("/api/companies/{symbol}/profits")
def company_profits(symbol: str):
    company = get_company(symbol)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found in the NSE profit dataset")
    return company


@router.get("/api/reports/profit-summary.pdf")
def download_profit_report():
    sectors = get_sector_profits()["sectors"]
    rec = get_recommendations()
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), title="Equity Research Profit Summary")
    styles = getSampleStyleSheet()
    story = [Paragraph("Equity Research AI — Profit Summary", styles["Title"]), Spacer(1, 10)]
    story.append(Paragraph("Latest annual profit comparison by sector. Figures are INR crore.", styles["BodyText"]))
    story.append(Spacer(1, 10))
    rows = [["Sector", "Total profit (₹ Cr)", "Growth", "Margin", "Top profitable companies"]]
    for sector in sectors:
        top = ", ".join(company["symbol"] for company in sector["topCompanies"])
        rows.append([sector["sector"], f"{sector['totalProfitCr']:,.0f}", f"{sector['profitGrowthPct']:.1f}%", f"{sector['profitMarginPct'] or 0:.1f}%", top])
    table = Table(rows, repeatRows=1, colWidths=[100, 115, 75, 75, 300])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf2ff")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#173b70")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#ccd7e5")),
        ("PADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.extend([table, Spacer(1, 18), Paragraph("Where to Invest — screening summary", styles["Heading2"])])
    best = rec.get("bestSector") or {}
    story.append(Paragraph(f"Best sector in this screen: {best.get('sector', 'Unavailable')} · Risk: {rec.get('riskLevel', 'Unavailable')} · Illustrative expected return: {rec.get('expectedReturnPct', 0)}%", styles["BodyText"]))
    story.append(Spacer(1, 8))
    picks = [["Company", "Screen", "Risk", "Estimated return"]]
    picks.extend([[stock["name"], stock["action"], stock["riskLevel"], f"{stock['expectedReturnPct']}%"] for stock in rec.get("stocks", [])])
    stock_table = Table(picks, repeatRows=1, colWidths=[300, 100, 100, 130])
    stock_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf2ff")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#ccd7e5")),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(stock_table)
    story.append(Spacer(1, 8))
    story.append(Paragraph("This report is for research and education. Recommendations and expected returns are screening estimates, not personal financial advice or guarantees. Company figures may use explicitly labelled sample estimates when live statements are unavailable.", styles["Italic"]))
    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=equity-profit-summary.pdf"})
