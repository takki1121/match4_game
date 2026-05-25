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
    const width = CONFIG.COLS * (CONFIG.PIECE_SIZE + CONFIG.MARGIN) + CONFIG.MARGIN;
    const height = CONFIG.ROWS * (CONFIG.PIECE_SIZE + CONFIG.MARGIN) + CONFIG.MARGIN + 100; // UI用スペース
    
    createCanvas(width, height);
    
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
    
    text(`Score: ${gameState.score}`, 20, y);
    text(`Mode: ${gameState.mode}`, 200, y);
    
    if (gameState.mode === 'timemode') {
        text(`Time: ${gameState.timeRemaining}s`, 400, y);
    } else if (gameState.mode === 'turnmode') {
        text(`Turns: ${gameState.turnsRemaining}`, 400, y);
    }

    if (!gameState.gameActive) {
        textSize(28);
        fill(200, 0, 0);
        textAlign(CENTER, CENTER);
        text('GAME OVER', width / 2, height - 40);
        textAlign(LEFT, BASELINE);
        fill(0);
    }

    // ハイスコア表示（右側）
    textSize(14);
    textAlign(LEFT, TOP);
    text('Highscores', width - 180, 20);
    for (let i = 0; i < 5; i++) {
        const item = cachedHighscores[i];
        const label = item ? `${i + 1}. ${item.name} ${item.score}` : `${i + 1}. ---`;
        text(label, width - 180, 40 + i * 20);
    }
    textAlign(LEFT, BASELINE);
}

function refreshHighscores(mode) {
    if (!window.HighscoreAPI) return;
    HighscoreAPI.fetchHighscores(mode)
        .then(data => {
            cachedHighscores = data.highscores || [];
            cachedHighscoresMode = data.mode;
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
    } else {
        console.log('Swap failed - not adjacent or invalid position');
    }
}
