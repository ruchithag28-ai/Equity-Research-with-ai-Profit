# Equity Research AI

An educational full-stack equity research dashboard for exploring Indian sectors, company profits, market news, and rule-based investment screens.

## What it does

Equity Research AI brings market context and company financial summaries into one web application. It combines a Next.js frontend with a FastAPI backend and external market/news data providers.

## Features

- **Sector Profits:** Compare annual profit, growth, margins, and leading companies across IT, Banking, Pharma, Auto, FMCG, Energy, Metal, and Realty.
- **Where to Invest:** Review a rules-based BUY / HOLD / AVOID screen using profit, growth, and risk measures.
- **Company Profit Comparison:** Explore five-year profit charts, quarterly summaries, peer comparisons, and a top-profitable company ranking.
- **Gold and Finance Charts:** View gold and currency history with price ranges, chart types, and market-data labels.
- **Sector Performance:** Compare NSE sector index quotes with global sector ETF proxies.
- **News and Watchlist:** Read headlines, review AI-assisted analysis, and save articles to a personal browser watchlist.

Financial statements and market prices depend on third-party providers and may be delayed or unavailable. When profit statements cannot be fetched, the backend labels its illustrative sample estimates. Recommendation scores and expected returns are educational screening estimates, not guarantees or personal financial advice.

## Tech Stack

- **Frontend:** Next.js App Router, React, TypeScript, Recharts, Tailwind CSS
- **Backend:** Python, FastAPI, SQLAlchemy
- **Market and news data:** Yahoo Finance, NSE index symbols, and configured news feeds

## Requirements

- Node.js and npm
- Python 3.10 or newer
- Internet access for live market/news feeds and package installation

## Run the Backend

Open a VS Code terminal at the project root and run:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python start.py
```

The API runs at `http://localhost:8000`. Interactive API documentation is at `http://localhost:8000/docs`.

## Run the Frontend

Open a second VS Code terminal at the project root and run:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The local API URL defaults to `http://localhost:8000`. If you need to set it manually, create `frontend/.env.local` with:

```text
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Restart the Next.js development server after changing `.env.local`.

## Folder Structure

```text
Equity-Research-AI/
├── frontend/     # Next.js web application
├── backend/      # FastAPI application and Python requirements
├── .gitignore
└── README.md
```

## Screenshots

Add project screenshots here when ready. For example, save images in `docs/screenshots/` and embed them with Markdown:

```markdown
![Dashboard](docs/screenshots/dashboard.png)
```

## GitHub Setup (VS Code on Windows)

1. On GitHub, create a new repository named `Equity-Research-AI`.
2. Choose **Private** for a project you are still developing, or **Public** if you want anyone to view it.
3. Leave **Add a README**, **Add .gitignore**, and **Choose a license** unchecked; these files are already managed in this project.
4. In VS Code, open this project folder and select **Terminal → New Terminal**. Run these commands one by one, replacing both placeholders with your GitHub details:

```powershell
git init
git add .
git status
git commit -m "Initial project commit"
git branch -M main
git remote add origin https://github.com/[YOUR-GITHUB-USERNAME]/[YOUR-REPO-NAME].git
git push -u origin main
```

If Git asks who you are, set your commit identity and retry the commit:

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### Common Git Errors

- **`git is not recognized`:** Install Git for Windows, restart VS Code, and reopen its terminal.
- **`remote origin already exists`:** Run `git remote set-url origin https://github.com/[YOUR-GITHUB-USERNAME]/[YOUR-REPO-NAME].git`.
- **`failed to push`:** Check `git remote -v`, confirm the repository URL, and sign in to GitHub when prompted.
- **Large files:** Confirm `git status --short` excludes `node_modules`, `.next`, virtual environments, databases, and `.env` files; if already staged, unstage/remove them before committing.

## Educational Purpose Only

This project is for educational and research purposes only. It is not investment advice. Always verify financial data independently and make investment decisions based on your own research and risk tolerance.
