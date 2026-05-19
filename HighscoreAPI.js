// ブラウザ側の高スコアAPIラッパー
const HighscoreAPI = (function() {
    const BASE = 'http://localhost:3000';

    async function fetchHighscores(mode = 'freeplay') {
        const url = `${BASE}/highscores?mode=${encodeURIComponent(mode)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch highscores');
        return res.json();
    }

    async function submitHighscore(mode, name, score) {
        const url = `${BASE}/highscores`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, name, score })
        });
        if (!res.ok) throw new Error('Failed to submit highscore');
        return res.json();
    }

    return { fetchHighscores, submitHighscore };
})();

window.HighscoreAPI = HighscoreAPI;
