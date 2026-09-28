class GameState {
    constructor(grid) {
        this.grid = grid;
        this.mode = 'freeplay';
        this.score = 0;
        this.initialTime = 10; // 秒（タイムモードの初期値）
        this.initialTurns = 2; // ターンモードの初期値
        this.timeRemaining = this.initialTime;
        this.turnsRemaining = this.initialTurns;
        this.gameActive = true;
        this.timeStarted = false; // タイムモードのカウントが開始されたか
        this._accumulator = 0; // ミリ秒蓄積（tick用）
    }

    setMode(mode) {
        if (this.mode === mode) return;

        // フリープレイから別モードに切り替える際、必要ならフリープレイのスコアを保存するためのフックを呼ぶ
        if (this.mode === 'freeplay' && mode !== 'freeplay') {
            if (typeof window.onLeaveFreeplay === 'function') {
                try {
                    window.onLeaveFreeplay(this);
                } catch (e) {
                    console.warn('onLeaveFreeplay handler threw', e);
                }
            }
        }

        this.mode = mode;
        this.resetForMode();
        this.updateTabUI();
        if (window.refreshHighscores) {
            window.refreshHighscores(this.mode);
        }
    }

    resetForMode() {
        // モード切替時はスコアをリセットし、盤面とカウントを初期化する
        this.score = 0;
        this.gameActive = true;
        this.timeStarted = false;
        if (this.mode === 'timemode') {
            this.timeRemaining = this.initialTime;
        } else if (this.mode === 'turnmode') {
            this.turnsRemaining = this.initialTurns;
        }

        // 盤面は新規生成（ユーザーが新モードで再挑戦できるように）
        this.grid.initializeBoardRandom();
        // 外部で管理しているゲームフローを初期化
        if (window.resetGameFlow) window.resetGameFlow();
    }

    tick(deltaMs) {
        if (!this.gameActive) return;
        if (this.mode !== 'timemode') return;
        if (!this.timeStarted) return;

        this._accumulator += deltaMs;
        // 1秒ごとにデクリメントする
        if (this._accumulator >= 1000) {
            const seconds = Math.floor(this._accumulator / 1000);
            this.timeRemaining = Math.max(0, this.timeRemaining - seconds);
            this._accumulator -= seconds * 1000;
            if (this.timeRemaining === 0) {
                this._endGame();
            }
        }
    }

    // タイムモードのカウントを開始する（最初のピース移動後に呼ぶ）
    startTimer() {
        if (this.mode !== 'timemode') return;
        this.timeStarted = true;
        this._accumulator = 0;
    }

    consumeTurn() {
        if (this.mode !== 'turnmode' || !this.gameActive) return;
        this.turnsRemaining = Math.max(0, this.turnsRemaining - 1);
        if (this.turnsRemaining === 0) this._endGame();
    }

    _endGame() {
        if (!this.gameActive) return;
        this.gameActive = false;
        if (typeof window.onGameEnd === 'function') {
            try {
                window.onGameEnd(this);
            } catch (e) {
                console.warn('onGameEnd handler threw', e);
            }
        }
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
