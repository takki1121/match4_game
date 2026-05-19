const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'highscores.json');

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { timemode: [], turnmode: [], freeplay: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// GET /highscores?mode=timemode
app.get('/highscores', (req, res) => {
  const mode = req.query.mode || 'freeplay';
  const data = readData();
  const list = (data[mode] || []).slice().sort((a,b) => b.score - a.score).slice(0, 50);
  res.json({ mode, highscores: list.slice(0, 5) });
});

// POST /highscores  { mode, name, score }
app.post('/highscores', (req, res) => {
  const { mode, name, score } = req.body;
  if (!mode || !name || typeof score !== 'number') {
    return res.status(400).json({ error: 'mode, name, score required' });
  }

  const data = readData();
  if (!data[mode]) data[mode] = [];

  data[mode].push({ name: name.slice(0, 32), score, date: new Date().toISOString() });
  // keep top 100
  data[mode] = data[mode].sort((a,b) => b.score - a.score).slice(0, 100);
  writeData(data);

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Highscore server listening on port ${PORT}`);
});
