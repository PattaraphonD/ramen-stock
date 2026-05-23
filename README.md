# 🍜 Ramen Stock Manager

A professional stock management web app for ramen shops, connected to Google Sheets as a database and deployed free on GitHub Pages.

## Features

- **Inventory Tracking** — Track all ingredients with current stock, min levels, units, and unit costs
- **Low Stock Alerts** — Automatic flags when stock falls below your minimum threshold
- **Recipe Cost Calculator** — Calculate ingredient cost per bowl for each recipe
- **Sales & Usage Logs** — Log daily sales, automatically deducting from inventory
- **Purchase Order Management** — Create, track, and receive supplier orders

---

## 🚀 Setup Guide

### Step 1 — Set Up Google Sheets

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet
2. Name it **"Ramen Stock DB"**
3. Copy the Spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/[THIS_IS_YOUR_ID]/edit
   ```

### Step 2 — Deploy the Google Apps Script

1. Go to [script.google.com](https://script.google.com) → New Project
2. Delete the default code and paste the contents of `apps-script/Code.gs`
3. Replace `YOUR_SPREADSHEET_ID_HERE` with your actual Spreadsheet ID
4. **Run `setupSheets` once** to create all sheet tabs with sample data
5. Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy** and copy the Web App URL

> ⚠️ If prompted, authorize the script to access your Google Sheets.

### Step 3 — Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `ramen-stock`)
2. Push all files to the `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ramen-stock.git
   git push -u origin main
   ```
3. In your repo: **Settings → Pages → Source → GitHub Actions**
4. The workflow will auto-deploy. Your app will be live at:
   ```
   https://YOUR_USERNAME.github.io/ramen-stock/
   ```

### Step 4 — Connect the App to Google Sheets

1. Open your deployed app
2. Click **⚙ Settings** in the bottom-left sidebar
3. Paste your **Google Apps Script Web App URL**
4. Set your shop name and currency
5. Click **Save Settings** — the app will sync with your Google Sheet!

---

## 📁 Project Structure

```
ramen-stock/
├── index.html                    # Main app (single-page)
├── css/
│   └── style.css                 # All styles
├── js/
│   └── app.js                    # App logic + Sheets API calls
├── apps-script/
│   └── Code.gs                   # Google Apps Script backend
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Pages auto-deploy
└── README.md
```

## 🔧 Google Sheets Structure

The Apps Script creates 4 sheets automatically:

| Sheet | Columns |
|-------|---------|
| **Inventory** | name, category, quantity, minLevel, unit, unitCost |
| **Recipes** | name, servings, ingredients (JSON), totalCost |
| **UsageLogs** | date, recipe, servings, cost, ingredients |
| **PurchaseOrders** | id, date, supplier, items (JSON), total, status |

## 🌐 How It Works

```
Web App (GitHub Pages)
        ↕ fetch() / JSON
Google Apps Script Web App
        ↕ SpreadsheetApp API
Google Sheets (Database)
```

The web app sends GET/POST requests to the Apps Script URL. The script reads/writes Google Sheets and returns JSON. No server, no cost.

## 📱 Usage Tips

- **Sync button** — Manually sync latest data from Google Sheets
- **Settings** — Change shop name, currency, and Script URL any time
- **Adjust Stock** — Use this when you receive a delivery or record waste
- **Log Usage** — When recording sales, it auto-deducts from inventory
- **Demo mode** — Works offline with sample data when no Script URL is set

---

*Built with vanilla HTML/CSS/JS + Google Apps Script + GitHub Pages*
