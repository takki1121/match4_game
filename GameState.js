class GameState {
    constructor(grid) {
        this.grid = grid;
        this.mode = 'freeplay';
        this.score = 0;
        this.timeRemaining = 120; // 秒（タイムモードの初期値）
        this.turnsRemaining = 50; // ターンモードの初期値
        this.gameActive = true;
        this._accumulator = 0; // ミリ秒蓄積（tick用）
    }

    setMode(mode) {
        if (this.mode === mode) return;
        this.mode = mode;
        this.resetForMode();
        this.updateTabUI();
    }

    resetForMode() {
        // スコアは保持するが、盤面とカウントはリセットする
        this.gameActive = true;
        if (this.mode === 'timemode') {
            this.timeRemaining = 120;
        } else if (this.mode === 'turnmode') {
            this.turnsRemaining = 50;
        }

        // 盤面は新規生成（ユーザーが新モードで再挑戦できるように）
        this.grid.initializeBoardRandom();
        // 外部で管理しているゲームフローを初期化
        if (window.resetGameFlow) window.resetGameFlow();
    }

    tick(deltaMs) {
        if (!this.gameActive) return;
        if (this.mode !== 'timemode') return;

        this._accumulator += deltaMs;
        // 1秒ごとにデクリメントする
        if (this._accumulator >= 1000) {
            const seconds = Math.floor(this._accumulator / 1000);
            this.timeRemaining = Math.max(0, this.timeRemaining - seconds);
            this._accumulator -= seconds * 1000;
            if (this.timeRemaining === 0) {
                this.gameActive = false;
            }
        }
    }

    consumeTurn() {
        if (this.mode !== 'turnmode' || !this.gameActive) return;
        this.turnsRemaining = Math.max(0, this.turnsRemaining - 1);
        if (this.turnsRemaining === 0) this.gameActive = false;
    }

    updateTabUI() {
        // タブの active クラスを更新
        const ids = {
            timemode: 'tab-timemode',
            turnmode: 'tab-turnmode',
            freeplay: 'tab-freeplay'
        };
        Object.values(ids).forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove('active');
        });
        const activeId = ids[this.mode];
        const activeEl = document.getElementById(activeId);
        if (activeEl) activeEl.classList.add('active');
    }
}

// 互換用にグローバル参照を設定（sketch.js から呼び出すため）
window.GameState = GameState;
