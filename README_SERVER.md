Highscore server

Run the simple Express server to provide highscore storage for development.

Install dependencies and start:

```bash
cd game/server
npm install
npm start
```

Server will run on http://localhost:3000

Endpoints:
- GET /highscores?mode=freeplay
- POST /highscores  { mode, name, score }
