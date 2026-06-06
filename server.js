require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE = 'Budget';

// ✅ Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// ✅ Test connection
app.post('/api/test-connection', async (req, res) => {
  try {
    if (!AIRTABLE_TOKEN || !BASE_ID) {
      return res.status(400).json({ error: 'Server credentials not configured' });
    }
    const response = await axios.get(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE}?maxRecords=1`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    );
    res.json({ success: true, message: 'Connection successful' });
  } catch (err) {
    res.status(500).json({ error: `Connection failed: ${err.message}` });
  }
});

// ✅ Fetch all records
app.get('/api/records', async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE}?sort%5B0%5D%5Bfield%5D=Semester`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    );
    res.json({ records: response.data.records || [] });
  } catch (err) {
    res.status(500).json({ error: `Fetch failed: ${err.message}` });
  }
});

// ✅ Create/Update record
app.post('/api/records', async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    
    const response = await axios.patch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE}`,
      { records },
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: `Update failed: ${err.message}` });
  }
});

// ✅ Create new record
app.post('/api/records/create', async (req, res) => {
  try {
    const { fields } = req.body;
    const response = await axios.post(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE}`,
      { records: [{ fields }] },
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: `Create failed: ${err.message}` });
  }
});

// ✅ Delete record
app.delete('/api/records/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    await axios.delete(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE}/${recordId}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: `Delete failed: ${err.message}` });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));