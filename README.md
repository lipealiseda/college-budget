# 🎓 College Budget Tracker

A secure, shareable 4-year college budget tracker with Airtable sync and real-time charts.

## Features

✅ **Secure Backend** - Airtable credentials stay on the server  
✅ **Shareable** - Safe to share with anyone  
✅ **Real-time Charts** - 4 live doughnut charts  
✅ **4-Year Planning** - Pre-configured semester structure  
✅ **Parent Tracking** - Split costs between Pai/Mãe  
✅ **Status Management** - Paid/Partial/Pending states  
✅ **What-If Simulator** - Test budget scenarios  
✅ **CSV Export** - Download your data  

## Tech Stack

- **Backend**: Node.js + Express
- **API**: Airtable REST API
- **Frontend**: Vanilla JS + Chart.js
- **Deployment**: Vercel / Railway / Heroku

## Quick Start

### 1. Setup Airtable

1. Create a new base at [airtable.com](https://airtable.com)
2. Create a table called `Budget` with these fields:
   - `Semester` (Text)
   - `Expense` (Text)
   - `Parent` (Text: "pai" or "mae")
   - `Amount` (Number)
   - `Status` (Text: "paid", "partial", "pending")
   - `Comment` (Text)
   - `Type` (Text: "fouryear" or "current")

3. Get your credentials:
   - **Base ID**: From the URL when you open your base
   - **Personal Access Token**: Go to [airtable.com/account/tokens](https://airtable.com/account/tokens)

### 2. Deploy Backend

#### Option A: Vercel (Recommended)

```bash
# Push to GitHub
git push origin main

# Go to vercel.com and connect your repo
# Add environment variables in Project Settings:
# AIRTABLE_TOKEN = your_token
# AIRTABLE_BASE_ID = your_base_id
# ALLOWED_ORIGINS = https://yourdomain.com
```

#### Option B: Railway

```bash
railway login
railway init
railway up

# Add env vars in dashboard
```

#### Option C: Heroku

```bash
heroku login
heroku create college-budget-api
heroku config:set AIRTABLE_TOKEN=your_token
heroku config:set AIRTABLE_BASE_ID=your_base_id
git push heroku main
```

#### Option D: Local Development

```bash
npm install

# Create .env file
cp .env.example .env
# Edit .env with your credentials

# Start server
npm start
# Or with auto-reload:
npm run dev
```

### 3. Use Frontend

1. Open `public/index.html` or deploy to GitHub Pages
2. Enter backend URL (e.g., `https://college-budget.vercel.app`)
3. Click "Test Connection"
4. Click "Save & Load"
5. Start managing your budget!

## Environment Variables

```env
AIRTABLE_TOKEN=pat_xxxxxxxxxxxxx        # Personal Access Token
AIRTABLE_BASE_ID=appxxxxxxxxxxxxx       # Your Airtable Base ID
ALLOWED_ORIGINS=http://localhost:3000   # Frontend domain(s)
PORT=3001                                # Server port
```

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/test-connection` - Test Airtable connection
- `GET /api/records` - Fetch all expenses
- `POST /api/records/create` - Create new expense
- `PATCH /api/records` - Update expense(s)
- `DELETE /api/records/:recordId` - Delete expense

## Security Notes

🔒 **Never expose your Airtable token in the frontend**

✅ Credentials are stored on the server  
✅ Frontend communicates only with backend  
✅ Use HTTPS in production  
✅ Rotate tokens regularly  
✅ Use fine-scoped Personal Access Tokens  

## Deployment Checklist

- [ ] Airtable base created with correct fields
- [ ] Personal Access Token generated
- [ ] Backend deployed (Vercel/Railway/Heroku)
- [ ] Environment variables set
- [ ] Test connection works
- [ ] Frontend points to correct backend URL
- [ ] Share the frontend URL with family!

## Troubleshooting

**Backend connection fails**
- Check backend URL is correct
- Verify environment variables are set
- Check ALLOWED_ORIGINS includes your frontend domain

**Data not loading**
- Check Airtable table has correct field names
- Verify Personal Access Token is valid
- Check Base ID is correct

**CORS errors**
- Add your frontend domain to ALLOWED_ORIGINS env var
- Restart backend

## Contributing

Feel free to open issues and PRs!

## License

MIT