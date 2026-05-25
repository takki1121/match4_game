// ゲーム設定
const CONFIG = {
    COLS: 7,
    ROWS: 7,
    COLORS: 4, // 赤、黄緑、青、黄色
    PIECE_SIZE: 50,
    MARGIN: 10
};

let grid;
let gameLogic;
let inputManager;
let matchDetector;
let animationManager;
let scoringSystem;
let gameState;
let selectedPiece = null;
let highlightedPositions = [];
let cachedHighscores = [];
let cachedHighscoresMode = null;

// ゲームフロー制御
let gamePhase = 'waiting'; // 'waiting', 'matching', 'animating', 'falling'
let chainLevel = 0; // 連鎖レベル

function setup() {
    // 動的にPIECE_SIZEを計算して画面にフィットさせる
    adjustPieceSizeToWindow();
    const width = CONFIG.COLS * (CONFIG.PIECE_SIZE + CONFIG.MARGIN) + CONFIG.MARGIN;
    const height = CONFIG.ROWS * (CONFIG.PIECE_SIZE + CONFIG.MARGIN) + CONFIG.MARGIN + 100; // UI用スペース

    createCanvas(width, height).parent('game-container');
    
    // グリッドの初期化
    grid = new Grid(CONFIG.COLS, CONFIG.ROWS, CONFIG.COLORS);
    grid.initializeBoardRandom();
    
    // ゲームロジックの初期化
    gameLogic = new GameLogic(grid, CONFIG);
    
    // 入力マネージャーの初期化
    inputManager = new Input(grid, CONFIG);
    
    // マッチ検出の初期化
    matchDetector = new MatchDetector(grid, CONFIG);
    
    // アニメーション管理の初期化
    animationManager = new AnimationManager();
    
    // スコアシステムの初期化
    scoringSystem = new ScoringSystem();
    
    // ゲーム状態の初期化（GameState クラス）
    gameState = new GameState(grid);
    gameState.score = 0;
    gameState.updateTabUI();

    refreshHighscores(gameState.mode);

    // グローバル関数：ゲームフローをリセット（GameState.resetForMode から呼ばれる）
    window.resetGameFlow = function() {
        gamePhase = 'waiting';
        chainLevel = 0;
        animationManager.clear();
    };

    // タブイベント設定
    const tabTime = document.getElementById('tab-timemode');
    const tabTurn = document.getElementById('tab-turnmode');
    const tabFree = document.getElementById('tab-freeplay');
    if (tabTime) tabTime.addEventListener('click', () => gameState.setMode('timemode'));
    if (tabTurn) tabTurn.addEventListener('click', () => gameState.setMode('turnmode'));
    if (tabFree) tabFree.addEventListener('click', () => gameState.setMode('freeplay'));
}

function windowResized() {
    // 画面回転やリサイズ時にピースサイズを調整
    adjustPieceSizeToWindow();
    const w = CONFIG.COLS * (CONFIG.PIECE_SIZE + CONFIG.MARGIN) + CONFIG.MARGIN;
    const h = CONFIG.ROWS * (CONFIG.PIECE_SIZE + CONFIG.MARGIN) + CONFIG.MARGIN + 100;
    resizeCanvas(w, h);
}

function adjustPieceSizeToWindow() {
    // 画面幅に合わせて PIECE_SIZE を自動決定（最小16px）
    const availableWidth = Math.min(windowWidth, 800) - (CONFIG.MARGIN * (CONFIG.COLS + 1));
    const maxSize = Math.floor(availableWidth / CONFIG.COLS);
    const availableHeight = Math.max(windowHeight - 140, 300) - (CONFIG.MARGIN * (CONFIG.ROWS + 1));
    const maxSizeH = Math.floor(availableHeight / CONFIG.ROWS);
    const size = Math.max(16, Math.min(maxSize, maxSizeH));
    CONFIG.PIECE_SIZE = size;
}

function draw() {
    background(240);
    
    // アニメーション更新
    animationManager.updateAnimations();

    // ゲーム状態の進行（タイマーなど）
    gameState.tick(deltaTime);
    updateGameState();
    
    // グリッドの描画
    drawGridWithHighlight();
    
    // 選択ピースのハイライト表示
    if (selectedPiece) {
        highlightSelectedPiece();
    }
    
    // UI情報の表示
    displayUI();
    renderUIToDOM();
}

/**
 * ゲーム状態を進行
 */
function updateGameState() {
    if (gamePhase === 'waiting') {
        // ユーザー入力待機
        return;
    }
    
    if (gamePhase === 'matching') {
        // マッチ判定
        const matches = matchDetector.detectAllMatches();
        
        if (matches.length > 0) {
            // マッチが見つかった
            console.log(`Match found: ${matches.length} pieces`);
            
            // アニメーション追加
            animationManager.addMultipleDeleteAnimations(matches);
            
            // アニメーション待機
            gamePhase = 'animating';
        } else {
            // マッチなし
            chainLevel = 0;
            gamePhase = 'waiting';
        }
    }
    
    if (gamePhase === 'animating') {
        // アニメーション中
        if (!animationManager.isAnimating()) {
            // アニメーション完了
            const matches = matchDetector.detectAllMatches();
            
            if (matches.length > 0) {
                // ピースを削除
                const deletedCount = matchDetector.removeMatches(matches);
                console.log(`Deleted ${deletedCount} pieces`);
                
                // スコア加算
                const score = scoringSystem.calculateScore(deletedCount, chainLevel + 1);
                gameState.score += score;
                console.log(`Score: +${score} (total: ${gameState.score})`);
                
                chainLevel++;
                gamePhase = 'falling';
            } else {
                gamePhase = 'waiting';
            }
        }
    }
    
    if (gamePhase === 'falling') {
        // 重力適用と新ピース生成
        matchDetector.applyGravity();
        matchDetector.fillEmptySpaces();
        
        gamePhase = 'matching';
    }
}

/**
 * グリッドをハイライト付きで描画
 */
function drawGridWithHighlight() {
    const margin = CONFIG.MARGIN;
    const size = CONFIG.PIECE_SIZE;

    for (let row = 0; row < CONFIG.ROWS; row++) {
        for (let col = 0; col < CONFIG.COLS; col++) {
            const x = col * (size + margin) + margin;
            const y = row * (size + margin) + margin;

            // 背景
            fill(200);
            stroke(150);
            strokeWeight(1);
            rect(x, y, size, size);

            // ハイライト表示
            let isHighlighted = false;
            for (let pos of highlightedPositions) {
                if (pos.col === col && pos.row === row) {
                    fill(100, 200, 255, 150);
                    rect(x, y, size, size);
                    isHighlighted = true;
                    break;
                }
            }

            // ピース描画
            const piece = grid.getPiece(col, row);
            if (piece) {
                const visuals = animationManager.getAnimationVisuals(col, row);
                
                // アニメーション適用
                push();
                translate(x + size / 2, y + size / 2 + visuals.offsetY);
                scale(visuals.scale);
                translate(-size / 2, -size / 2);
                
                const colors = [
                    color(255, 0, 0),      // 赤
                    color(0, 255, 0),      // 黄緑
                    color(0, 0, 255),      // 青
                    color(255, 255, 0)     // 黄色
                ];
                
                fill(...colors[piece.color].levels.slice(0, 3), visuals.alpha);
                stroke(0);
                strokeWeight(2);
                circle(size / 2, size / 2, size - 4);
                
                pop();
            }
        }
    }
}

/**
 * 選択ピースをハイライト
 */
function highlightSelectedPiece() {
    const { col, row } = selectedPiece;
    const margin = CONFIG.MARGIN;
    const size = CONFIG.PIECE_SIZE;
    const x = col * (size + margin) + margin;
    const y = row * (size + margin) + margin;
    
    // 外枠を描画
    stroke(255, 255, 0);
    strokeWeight(3);
    fill(255, 255, 0, 50);
    rect(x, y, size, size);
}

function displayUI() {
    fill(0);
    textSize(16);
    const y = CONFIG.ROWS * (CONFIG.PIECE_SIZE + CONFIG.MARGIN) + CONFIG.MARGIN + 20;
    // Score and mode on the right side to avoid overlapping the play area
    const uiRightX = Math.max(width - 240, CONFIG.COLS * (CONFIG.PIECE_SIZE + CONFIG.MARGIN) + CONFIG.MARGIN + 20);
    text(`Score: ${gameState.score}`, uiRightX, y);
    text(`Mode: ${gameState.mode}`, uiRightX + 140, y);

    if (gameState.mode === 'timemode') {
        text(`Time: ${gameState.timeRemaining}s`, uiRightX, y + 20);
    } else if (gameState.mode === 'turnmode') {
        text(`Turns: ${gameState.turnsRemaining}`, uiRightX, y + 20);
    }

    if (!gameState.gameActive) {
        textSize(28);
        fill(200, 0, 0);
        textAlign(CENTER, CENTER);
        text('GAME OVER', width / 2, height - 40);
        textAlign(LEFT, BASELINE);
        fill(0);
    }

    // ハイスコアは外部の DOM サイドバーに表示するためここでは描画しない
}

function refreshHighscores(mode) {
    if (!window.HighscoreAPI) return;
    HighscoreAPI.fetchHighscores(mode)
        .then(data => {
            cachedHighscores = data.highscores || [];
            cachedHighscoresMode = data.mode;
            renderHighscoresToDOM();
            if (gameState && gameState.mode === mode) {
                redraw();
            }
        })
        .catch(error => {
            console.warn('Highscore load failed', error);
            cachedHighscores = [];
            cachedHighscoresMode = null;
        });
}

function renderHighscoresToDOM() {
    const panel = document.getElementById('highscores-panel');
    if (!panel) return;
    panel.innerHTML = '';

    const title = document.createElement('h3');
    title.textContent = 'Highscores';
    panel.appendChild(title);

    const list = document.createElement('ul');
    const maxEntries = 3;
    for (let i = 0; i < maxEntries; i++) {
        const li = document.createElement('li');
        const item = cachedHighscores[i];
        li.textContent = item ? `${i + 1}. ${item.name} ${item.score}` : `${i + 1}. ---`;
        list.appendChild(li);
    }
    panel.appendChild(list);
}

function renderUIToDOM() {
    const ui = document.getElementById('ui-container');
    if (!ui || !gameState) return;

    // Clear and build compact UI: Score, Mode, Time/Turns
    ui.innerHTML = '';

    const scoreEl = document.createElement('div');
    scoreEl.className = 'ui-item';
    scoreEl.textContent = `Score: ${gameState.score}`;
    ui.appendChild(scoreEl);

    const modeEl = document.createElement('div');
    modeEl.className = 'ui-item';
    modeEl.textContent = `Mode: ${gameState.mode}`;
    ui.appendChild(modeEl);

    if (gameState.mode === 'timemode') {
        const timeEl = document.createElement('div');
        timeEl.className = 'ui-item ui-time';
        timeEl.textContent = `Time: ${gameState.timeRemaining}s`;
        ui.appendChild(timeEl);
    } else if (gameState.mode === 'turnmode') {
        const turnsEl = document.createElement('div');
        turnsEl.className = 'ui-item';
        turnsEl.textContent = `Turns: ${gameState.turnsRemaining}`;
        ui.appendChild(turnsEl);
    }
}

function mousePressed() {
    if (!gameState.gameActive || gamePhase !== 'waiting') return false;
    
    const swapAction = inputManager.handleMousePressed(mouseX, mouseY);
    
    if (swapAction) {
        // ピース交換実行
        const { from, to } = swapAction;
        executeSwap(from.col, from.row, to.col, to.row, swapAction.type);
        selectedPiece = null;
        highlightedPositions = [];
        
        // マッチング開始
        chainLevel = 0;
        gamePhase = 'matching';
    } else if (inputManager.firstClickCol !== null) {
        // クリック操作での選択
        selectedPiece = {
            col: inputManager.firstClickCol,
            row: inputManager.firstClickRow
        };
        highlightedPositions = gameLogic.getAdjacentPositions(
            inputManager.firstClickCol,
            inputManager.firstClickRow
        );
    }
    
    return false;
}

// Touch handlers for mobile
function _getCanvasAndRect() {
    const canvasEl = document.querySelector('canvas');
    if (!canvasEl) return null;
    const rect = canvasEl.getBoundingClientRect();
    return { canvasEl, rect };
}

// Use event coordinates and canvas bounding rect to compute accurate canvas-local coords
function touchStarted(event) {
    const info = _getCanvasAndRect();
    if (!info) return false;
    const { canvasEl, rect } = info;
    if (event && event.touches && event.touches.length > 0) {
        event.preventDefault();
        const t = event.touches[0];
        const scaleX = canvasEl.width / rect.width;
        const scaleY = canvasEl.height / rect.height;
        const cx = (t.clientX - rect.left) * scaleX;
        const cy = (t.clientY - rect.top) * scaleY;

        const prevMouseX = mouseX;
        const prevMouseY = mouseY;
        mouseX = cx;
        mouseY = cy;
        const result = mousePressed();
        mouseX = prevMouseX;
        mouseY = prevMouseY;
        return result;
    }
    return false;
}

function touchMoved(event) {
    const info = _getCanvasAndRect();
    if (!info) return false;
    const { canvasEl, rect } = info;
    if (event && event.touches && event.touches.length > 0) {
        event.preventDefault();
        const t = event.touches[0];
        const scaleX = canvasEl.width / rect.width;
        const scaleY = canvasEl.height / rect.height;
        const cx = (t.clientX - rect.left) * scaleX;
        const cy = (t.clientY - rect.top) * scaleY;

        const prevMouseX = mouseX;
        const prevMouseY = mouseY;
        mouseX = cx;
        mouseY = cy;
        const result = mouseDragged();
        mouseX = prevMouseX;
        mouseY = prevMouseY;
        return result;
    }
    return false;
}

function touchEnded(event) {
    // Use changedTouches when touches is empty
    const info = _getCanvasAndRect();
    if (!info) return mouseReleased();
    if (event && event.changedTouches && event.changedTouches.length > 0) {
        event.preventDefault();
        const { canvasEl, rect } = info;
        const t = event.changedTouches[0];
        const scaleX = canvasEl.width / rect.width;
        const scaleY = canvasEl.height / rect.height;
        const cx = (t.clientX - rect.left) * scaleX;
        const cy = (t.clientY - rect.top) * scaleY;

        const prevMouseX = mouseX;
        const prevMouseY = mouseY;
        mouseX = cx;
        mouseY = cy;
        const result = mouseReleased();
        mouseX = prevMouseX;
        mouseY = prevMouseY;
        return result;
    }

    return mouseReleased();
}

function mouseDragged() {
    if (!gameState.gameActive || !inputManager.isDragging || gamePhase !== 'waiting') return false;
    
    const swapAction = inputManager.handleMouseDragged(mouseX, mouseY);
    
    if (swapAction) {
        // ドラッグでピース交換実行
        const { from, to } = swapAction;
        executeSwap(from.col, from.row, to.col, to.row, swapAction.type);
        inputManager.handleMouseReleased();
        selectedPiece = null;
        highlightedPositions = [];
        
        // マッチング開始
        chainLevel = 0;
        gamePhase = 'matching';
    }
    
    return false;
}

function mouseReleased() {
    inputManager.handleMouseReleased();
    return false;
}

/**
 * ピース交換を実行
 */
function executeSwap(fromCol, fromRow, toCol, toRow, type) {
    const success = gameLogic.swapPieces(fromCol, fromRow, toCol, toRow);
    
    if (success) {
        console.log(`Swap successful: (${fromCol}, ${fromRow}) ↔ (${toCol}, ${toRow})`);
        // ターンモードなら1ターン消費
        if (gameState && gameState.mode === 'turnmode') {
            gameState.consumeTurn();
        }
        // タイムモードでは最初の有効な移動が行われたタイミングでカウントダウンを開始
        if (gameState && gameState.mode === 'timemode' && !gameState.timeStarted) {
            gameState.startTimer();
        }
    } else {
        console.log('Swap failed - not adjacent or invalid position');
    }
}

// ゲーム終了時のハンドラ：タイム/ターンモードでランキング入りする場合のみ保存
window.onGameEnd = function(state) {
    if (!window.HighscoreAPI) return;
    const mode = state.mode;
    if (mode !== 'timemode' && mode !== 'turnmode') return;

    HighscoreAPI.fetchHighscores(mode).then(res => {
        const list = res.highscores || [];
        const lowest = list[list.length - 1];
        const qualifies = list.length < 3 || state.score > (lowest ? lowest.score : -Infinity);
        if (!qualifies) return;

        // 名前を尋ねて登録（簡易実装）。キャンセルされたら匿名 'anonymous' を利用
        const defaultName = 'player';
        let name = null;
        try {
            name = window.prompt('ハイスコア！名前を入力してください（キャンセルで匿名）', defaultName);
        } catch (e) {
            name = defaultName;
        }
        if (name === null) name = 'anonymous';

        HighscoreAPI.submitHighscore(mode, name, state.score)
            .then(() => {
                // DOM を更新
                if (typeof renderHighscoresToDOM === 'function') renderHighscoresToDOM();
            })
            .catch(err => console.warn('Failed to submit highscore', err));
    }).catch(err => console.warn('Failed to fetch highscores', err));
};

// フリープレイから他モードに切り替えたときに、フリープレイのスコアがランキング入りする場合のみ保存
window.onLeaveFreeplay = function(state) {
    if (!window.HighscoreAPI) return;
    const mode = 'freeplay';

    HighscoreAPI.fetchHighscores(mode).then(res => {
        const list = res.highscores || [];
        const lowest = list[list.length - 1];
        const qualifies = list.length < 3 || state.score > (lowest ? lowest.score : -Infinity);
        if (!qualifies) return;

        const defaultName = 'player';
        let name = null;
        try {
            name = window.prompt('フリープレイのスコアがランキング入りしました。名前を入力してください（キャンセルで匿名）', defaultName);
        } catch (e) {
            name = defaultName;
        }
        if (name === null) name = 'anonymous';

        HighscoreAPI.submitHighscore(mode, name, state.score)
            .then(() => {
                if (typeof renderHighscoresToDOM === 'function') renderHighscoresToDOM();
            })
            .catch(err => console.warn('Failed to submit freeplay highscore', err));
    }).catch(err => console.warn('Failed to fetch freeplay highscores', err));
};
