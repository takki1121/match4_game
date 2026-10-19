class GameState {
    constructor(grid) {
        this.grid = grid;
        this.mode = 'freeplay';
        this.score = 0;
        this.initialTime = 10; // 秒（タイムモードの初期値）
        this.initialTurns = 7; // ターンモードの初期値
        this.timeRemaining = this.initialTime;
        this.turnsRemaining = this.initialTurns;
        this.gameActive = true;
        this.timeStarted = false; // タイムモードのカウントが開始されたか
        this._accumulator = 0; // ミリ秒蓄積（tick用）
    }

    setMode(mode) {
        // 同じモードのボタンを押した場合は、そのモードのまま盤面・スコアをリセットする

        // フリープレイを抜ける（別モードへの切替・フリープレイのリセット）際、必要ならフリープレイのスコアを保存するためのフックを呼ぶ
        if (this.mode === 'freeplay') {
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
        // モード切替・リセット時はスコアをリセットし、盤面とカウントを初期化する
        this.score = 0;
        this.gameActive = true;
        this.timeStarted = false;
        this._accumulator = 0;
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
            // 残り5秒からはカウントダウン音を鳴らす
            if (this.timeRemaining > 0 && this.timeRemaining <= 5 && window.SoundManager) {
                SoundManager.play('countdown');
            }
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
        // 手数が0になってもすぐには終了しない（連鎖やフィーバータイムが終わるのを待つ）。
        // 終了判定は sketch.js から endTurnModeIfReady() で行う
        this.turnsRemaining = Math.max(0, this.turnsRemaining - 1);
    }

    // ターンモードで手数を使い切っていて、連鎖・フィーバータイムがすべて終わっていればゲーム終了
    endTurnModeIfReady(isBusy) {
        if (this.mode !== 'turnmode' || !this.gameActive) return;
        if (this.turnsRemaining > 0 || isBusy) return;
        this._endGame();
    }

    _endGame() {
        if (!this.gameActive) return;
        this.gameActive = false;
        if (window.SoundManager) SoundManager.play('gameover');
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
