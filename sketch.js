// ゲーム設定
const CONFIG = {
    COLS: 7,
    ROWS: 7,
    COLORS: 4, // 赤、黄緑、青、黄色
    PIECE_SIZE: 50,
    MARGIN: 10
};

// テクスチャに合わせた共通カラー（ピース描画のフォールバックとパーティクルで使用）
const PIECE_COLORS = [
    [67, 134, 255],   // blue.png
    [166, 230, 102],  // light_green.png
    [255, 154, 201],  // pink.png
    [255, 229, 102]   // yellow.png
];

// 削除後に一時的に空白にする待ち時間（ミリ秒）
CONFIG.DELETE_PAUSE_MS = 300;

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
let textures = [];
let comboImages = []; // comboImages[1]～comboImages[8]：Nコンボ表示用画像

// ゲームフロー制御
let gamePhase = 'waiting'; // 'waiting', 'matching', 'animating', 'falling'
let chainLevel = 0; // 連鎖レベル
let pauseUntil = 0; // 一時停止解除時刻（ms since epoch）

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
    // アニメーション管理の初期化
    animationManager = new AnimationManager();
    animationManager.setConfig(CONFIG);

    matchDetector = new MatchDetector(grid, CONFIG);
    matchDetector.setAnimationManager(animationManager);
    
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

// 画像読み込み
function preload() {
    // テクスチャは game/index.html の相対パスで読み込まれる（このファイルは game/ 配下）
    textures[0] = loadImage('img/blue.png');
    textures[1] = loadImage('img/light_green.png');
    textures[2] = loadImage('img/pink.png');
    textures[3] = loadImage('img/yellow.png');

    // コンボ数表示用画像（1com.png ～ 8com.png、8コンボ以上は8com.pngを使い回す）
    for (let i = 1; i <= 8; i++) {
        comboImages[i] = loadImage(`img/${i}com.png`);
    }
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

    if (gamePhase === 'swapping') {
        // 交換アニメーションの再生中はマッチ判定を待つ
        if (!animationManager.isAnimating()) {
            gamePhase = 'matching';
        }
        return;
    }

    if (gamePhase === 'matching') {
        // マッチ判定
        const matches = matchDetector.detectAllMatches();
        
        if (matches.length > 0) {
            // マッチが見つかった
            console.log(`Match found: ${matches.length} pieces`);
            
            // マッチを拡張して、隣接同色も含む全削除対象を取得
            const expanded = matchDetector.expandMatches(matches);
            // アニメーション追加（拡張対象すべて）
            animationManager.addMultipleDeleteAnimations(expanded, grid);
            
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
                console.log(`Deleted ${deletedCount} pieces (waiting before fall)`);

                // スコア加算（削除時点で加算）
                const chainNumber = chainLevel + 1;
                let score = scoringSystem.calculateScore(deletedCount, chainNumber);
                // 連続（コンボ）補正: 連続回数 * 1.3倍を適用
                if (chainNumber > 1) {
                    const comboMultiplier = chainNumber * 1.3;
                    score = Math.floor(score * comboMultiplier);
                }
                gameState.score += score;
                console.log(`Score: +${score} (total: ${gameState.score})`);

                chainLevel++;

                // 連鎖が2以上ならコンボ扱いにして派手な演出
                if (chainLevel > 1) {
                    const centerX = width / 2;
                    const centerY = CONFIG.MARGIN + 40; // グリッド上部あたりに表示
                    animationManager.addComboBurst(centerX, centerY, chainLevel);
                    // コンボ表示タイマー（UI描画用）
                    window.currentCombo = {
                        count: chainLevel,
                        until: Date.now() + 1200
                    };
                }

                // 一旦空白を保ったまま短い待ち時間を設け、その後落下処理を行う
                pauseUntil = Date.now() + CONFIG.DELETE_PAUSE_MS;
                gamePhase = 'pause_after_delete';
            } else {
                gamePhase = 'waiting';
            }
        }
    }
    
    if (gamePhase === 'falling') {
        // 落下アニメーション再生中の待機フェーズ
        // animationManager による落下エフェクトが完了するまで待ち、
        // 完了後に短いポーズを挟んでから次のマッチ判定へ移行する
        if (animationManager.isAnimating()) {
            // まだアニメーション中 → 何もしない
            return;
        } else {
            // 落下アニメーション完了 → 少し待ってからマッチ判定へ
            pauseUntil = Date.now() + CONFIG.DELETE_PAUSE_MS;
            gamePhase = 'post_fall_pause';
        }
    }

    if (gamePhase === 'pause_after_delete') {
        if (Date.now() >= pauseUntil) {
            // 待機完了 → 落下処理を開始（この時点で落下アニメーションが追加される）
            matchDetector.applyGravity();
            matchDetector.fillEmptySpaces();
            // 実際の落下の視覚表現が終わるまで待つフェーズへ
            gamePhase = 'falling';
        }
    }

    if (gamePhase === 'post_fall_pause') {
        if (Date.now() >= pauseUntil) {
            // 落下後の小休止が終わったらマッチ判定へ
            gamePhase = 'matching';
        }
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

                // アニメーション適用（テクスチャがある場合は画像で描画）
                push();
                translate(x + size / 2 + visuals.offsetX, y + size / 2 + visuals.offsetY);
                scale(visuals.scale);

                if (textures && textures[piece.color]) {
                    imageMode(CENTER);
                    tint(255, visuals.alpha);
                    image(textures[piece.color], 0, 0, size - 4, size - 4);
                    noTint();
                } else {
                    // フォールバック：従来の丸描画
                    fill(...PIECE_COLORS[piece.color], visuals.alpha);
                    stroke(0);
                    strokeWeight(2);
                    circle(0, 0, size - 4);
                }

                pop();
            }
        }
    }

    // パーティクル描画（消去のエフェクト）
    const particles = animationManager.getParticles();
    noStroke();
    for (const p of particles) {
        const colIdx = p.colorIndex;
        let fillColor = [200, 200, 200];
        if (typeof colIdx === 'number' && PIECE_COLORS[colIdx]) {
            fillColor = PIECE_COLORS[colIdx];
        }

        if (p.kind === 'star') {
            push();
            translate(p.x, p.y);
            rotate(p.rotation || 0);
            noStroke();
            fill(...fillColor, p.alpha);
            // 5ポイントの星を描く（半径: p.radius、内半径: p.radius*0.45）
            beginShape();
            const points = 5;
            for (let i = 0; i < points * 2; i++) {
                const angle = (i * Math.PI) / points;
                const r = (i % 2 === 0) ? p.radius : p.radius * 0.45;
                const vx = Math.cos(angle) * r;
                const vy = Math.sin(angle) * r;
                vertex(vx, vy);
            }
            endShape(CLOSE);
            pop();
        } else {
            fill(...fillColor, p.alpha);
            circle(p.x, p.y, p.radius);
        }
    }

    // コンボの画面パルスとテキスト表示
    const pulse = animationManager.getComboPulse ? animationManager.getComboPulse() : null;
    if (pulse) {
        const t = (Date.now() - pulse.start) / pulse.duration;
        const eased = 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
        push();
        // 中央に向けて白フラッシュ（アルファは強→0）
        noStroke();
        fill(255, 240, 200, 200 * (1 - eased));
        rect(0, 0, width, height);
        pop();

        // 大きいコンボ画像（Nコンボ！の文字画像）
        if (window.currentCombo && Date.now() < window.currentCombo.until) {
            const combo = window.currentCombo.count;
            // 画像の派手さ（大きさ）も8コンボで頭打ちにする（それ以上は同じ大きさのまま、9com.png以降は無いので8com.pngを使い回す）
            const comboIntensity = Math.min(combo, 8);
            const comboImg = comboImages[comboIntensity];
            if (comboImg) {
                push();
                const scaleFactor = 1 + 0.6 * (1 - Math.abs(0.5 - t) * 2);
                translate(width / 2, height / 2 - 60);
                scale(scaleFactor);
                imageMode(CENTER);
                const targetW = Math.min(width * 1.15, 380 + comboIntensity * 30);
                const targetH = targetW * (comboImg.height / comboImg.width);
                image(comboImg, 0, 0, targetW, targetH);
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

    // クリックされたピースを一瞬縮ませて「押した感」を出す
    if (inputManager.dragStartCol !== null && inputManager.dragStartRow !== null) {
        animationManager.addPressAnimation(inputManager.dragStartCol, inputManager.dragStartRow);
    }

    if (swapAction) {
        // ピース交換実行
        const { from, to } = swapAction;
        const success = executeSwap(from.col, from.row, to.col, to.row, swapAction.type);
        selectedPiece = null;
        highlightedPositions = [];

        // 交換アニメーションの後にマッチング判定を開始
        chainLevel = 0;
        gamePhase = success ? 'swapping' : 'waiting';
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

// p5.js registers touch listeners on `window`, so these fire for taps anywhere
// on the page (e.g. the tab bar buttons), not just the canvas. Ignore those so
// we don't preventDefault() their native click/tap behavior.
function _isEventOnCanvas(event, canvasEl) {
    const target = event && event.target;
    return !!(target && (target === canvasEl || canvasEl.contains(target)));
}

// Use event coordinates and canvas bounding rect to compute accurate canvas-local coords
function touchStarted(event) {
    const info = _getCanvasAndRect();
    if (!info) return false;
    const { canvasEl, rect } = info;
    if (!_isEventOnCanvas(event, canvasEl)) return true;
    if (event && event.touches && event.touches.length > 0) {
        event.preventDefault();
        const t = event.touches[0];
        // Use p5's user-space width/height to compute scale between
        // DOM rect (CSS pixels) and p5 coordinates (user-space pixels).
        const scaleX = width / rect.width;
        const scaleY = height / rect.height;
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
    if (!_isEventOnCanvas(event, canvasEl)) return true;
    if (event && event.touches && event.touches.length > 0) {
        event.preventDefault();
        const t = event.touches[0];
        // Use p5's user-space width/height for correct mapping on high-DPR
        const scaleX = width / rect.width;
        const scaleY = height / rect.height;
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
    const { canvasEl } = info;
    if (!_isEventOnCanvas(event, canvasEl)) return true;
    if (event && event.changedTouches && event.changedTouches.length > 0) {
        event.preventDefault();
        const { rect } = info;
        const t = event.changedTouches[0];
        // Use p5's user-space width/height for correct mapping on high-DPR
        const scaleX = width / rect.width;
        const scaleY = height / rect.height;
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
        const success = executeSwap(from.col, from.row, to.col, to.row, swapAction.type);
        inputManager.handleMouseReleased();
        selectedPiece = null;
        highlightedPositions = [];

        // 交換アニメーションの後にマッチング判定を開始
        chainLevel = 0;
        gamePhase = success ? 'swapping' : 'waiting';
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

        // 2つのピースがそれぞれの新しい位置へスライドするアニメーション
        animationManager.addSwapAnimation(toCol, toRow, fromCol, fromRow);
        animationManager.addSwapAnimation(fromCol, fromRow, toCol, toRow);

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

    return success;
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
