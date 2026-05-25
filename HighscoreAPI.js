// ブラウザ内保存のハイスコア管理
const HighscoreAPI = (function() {
    const STORAGE_KEY = 'match4-highscores';
    const MODES = ['timemode', 'turnmode', 'freeplay'];
    const DEFAULT_DATA = {
        timemode: [],
        turnmode: [],
        freeplay: []
    };

    function cloneDefaultData() {
        return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    function normalizeData(data) {
        const result = cloneDefaultData();
        for (const mode of MODES) {
            if (Array.isArray(data?.[mode])) {
                result[mode] = data[mode]
                    .filter(item => item && typeof item.score === 'number')
                    .map(item => ({
                        name: String(item.name ?? 'anonymous').slice(0, 32),
                        score: Number(item.score) || 0,
                        date: item.date || new Date().toISOString()
                    }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 5);
            }
        }
        return result;
    }

    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return cloneDefaultData();
            return normalizeData(JSON.parse(raw));
        } catch (error) {
            console.warn('Failed to load highscores from localStorage', error);
            return cloneDefaultData();
        }
    }

    function saveData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeData(data)));
    }

    function fetchHighscores(mode = 'freeplay') {
        const data = loadData();
        return Promise.resolve({
            mode,
            highscores: data[mode] || []
        });
    }

    function submitHighscore(mode, name, score) {
        if (!MODES.includes(mode)) {
            return Promise.reject(new Error(`Invalid mode: ${mode}`));
        }

        const data = loadData();
        data[mode].push({
            name: String(name || 'anonymous').slice(0, 32),
            score: Number(score) || 0,
            date: new Date().toISOString()
        });
        data[mode] = data[mode].sort((a, b) => b.score - a.score).slice(0, 5);
        saveData(data);

        return Promise.resolve({ ok: true, mode, highscores: data[mode] });
    }

    function resetHighscores() {
        saveData(cloneDefaultData());
        return Promise.resolve({ ok: true });
    }

    return { fetchHighscores, submitHighscore, resetHighscores };
})();

window.HighscoreAPI = HighscoreAPI;
