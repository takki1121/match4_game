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

// フィーバータイム設定
// - 消去数バーが満タン（CLEAR_BAR_TIER_SIZE個）になったらフィーバータイムに突入
//   （3つ揃い・斜めマッチが有効になり、スコアも倍になる）
const FEVER_DURATION_MS = 10000;
const FEVER_SCORE_MULTIPLIER = 2;
const FEVER_TRANSITION_DELAY_MS = 500; // ゲージが満タンになってからフィーバー突入までの間（0.5秒）
let feverUntil = 0; // フィーバータイム終了時刻（ms since epoch）。0/過去なら非アクティブ
let feverPendingUntil = 0; // フィーバー移行待ち終了時刻（0なら待機していない）

// 消去数バー設定（消したピース数の累計をバーに溜めていく）
const CLEAR_BAR_TIER_SIZE = 50; // このピース数でバーが満タンになり、次の周へ
let totalCleared = 0; // これまでに消したピースの累計数

// スマホ表示時はゲージをプレイ画面下の横向き専用枠に表示する
const mobileGaugeMQ = window.matchMedia('(max-width: 820px)');

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
let comboImages = []; // comboImages[1]～comboImages[10]：Nコンボ表示用画像
let perfectImage; // 11コンボ以上で表示するPERFECT画像
let pixelFont; // GAME OVER 等で使う、他のUI文字（見出し）と同じピクセルフォント

// ゲームフロー制御
let gamePhase = 'waiting'; // 'waiting', 'matching', 'animating', 'falling'
let chainLevel = 0; // 連鎖レベル
let pauseUntil = 0; // 一時停止解除時刻（ms since epoch）

function setup() {
    // 動的にPIECE_SIZEを計算して画面にフィットさせる
    adjustPieceSizeToWindow();
    const width = CONFIG.COLS * (CONFIG.PIECE_SIZE + CONFIG.MARGIN) + CONFIG.MARGIN;
    const height = CONFIG.ROWS * (CONFIG.PIECE_SIZE + CONFIG.MARGIN) + CONFIG.MARGIN; // 盤面ぴったり（スコア等はDOM側に表示）

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
        feverUntil = 0; // モード切替・リセット時はフィーバータイムも解除
        feverPendingUntil = 0; // フィーバー移行待ちも解除
        totalCleared = 0; // 消去数バーもリセット
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

    // コンボ数表示用画像（1com.png ～ 10com.png、11コンボ以上はperfect.pngを表示）
    for (let i = 1; i <= 10; i++) {
        comboImages[i] = loadImage(`img/${i}com.png`);
    }
    perfectImage = loadImage('img/perfect.png');

    // 他のUI見出し（MISSION、TIME、TURNS等）と同じ 'Press Start 2P' を、
    // p5.loadFont() でフォントファイルとして直接読み込む。
    // CSS経由の文字列指定だと読み込みタイミングによってフォールバックフォントで
    // 描画されてしまうことがあるため、確実に同じ書体になるようこちらを使う。
    pixelFont = loadFont('https://fonts.gstatic.com/s/pressstart2p/v16/e3t4euO8T-267oIAQAu6jDQyK0nS.ttf');
}

function windowResized() {
    // 画面回転やリサイズ時にピースサイズを調整
    adjustPieceSizeToWindow();
    const w = CONFIG.COLS * (CONFIG.PIECE_SIZE + CONFIG.MARGIN) + CONFIG.MARGIN;
    const h = CONFIG.ROWS * (CONFIG.PIECE_SIZE + CONFIG.MARGIN) + CONFIG.MARGIN;
    resizeCanvas(w, h);
}

function adjustPieceSizeToWindow() {
    // 画面幅に合わせて PIECE_SIZE を自動決定（最小16px）
    // デスクトップ表示ではハイスコア／ミッション欄とスコア欄が盤面の左右に並ぶため、
    // その幅を差し引いてから盤面サイズを計算する（差し引かないと盤面がはみ出し、
    // 下部のモード切替ボタンなどが画面外に切れてしまう）
    const isStackedLayout = mobileGaugeMQ.matches;
    const reservedWidth = isStackedLayout ? 60 : 560;
    const availableWidth = Math.min(windowWidth - reservedWidth, 800) - (CONFIG.MARGIN * (CONFIG.COLS + 1));
    const maxSize = Math.floor(availableWidth / CONFIG.COLS);
    const availableHeight = Math.max(windowHeight - 140, 300) - (CONFIG.MARGIN * (CONFIG.ROWS + 1));
    const maxSizeH = Math.floor(availableHeight / CONFIG.ROWS);
    const size = Math.max(16, Math.min(maxSize, maxSizeH));
    CONFIG.PIECE_SIZE = size;
}

/**
 * フィーバータイム中かどうか
 */
function isFeverActive() {
    return Date.now() < feverUntil;
}

/**
 * ゲージが満タンになり、フィーバータイム突入を待っている最中かどうか
 */
function isFeverPending() {
    return feverPendingUntil > 0 && Date.now() < feverPendingUntil;
}

function draw() {
    // 待機時間が経過したらフィーバータイムへ移行（ゲージはここでリセット）
    if (feverPendingUntil > 0 && Date.now() >= feverPendingUntil) {
        feverPendingUntil = 0;
        totalCleared = 0;
        feverUntil = Date.now() + FEVER_DURATION_MS;
    }

    // フィーバータイム中は背景を暖色にして分かりやすくする（通常時は宇宙テーマの暗い面）
    background(isFeverActive() ? color(46, 24, 8) : color(19, 15, 38));

    // マッチ判定の条件をフィーバー状態に同期（3つ揃い・斜めマッチの切り替え）
    matchDetector.setFeverActive(isFeverActive());

    // アニメーション更新
    animationManager.updateAnimations();

    // ゲーム状態の進行（タイマーなど）
    gameState.tick(deltaTime);
    updateGameState();
    
    // ⑥コンボ時の画面の揺れを適用してグリッドを描画
    const shake = animationManager.getScreenShakeOffset();
    push();
    translate(shake.x, shake.y);

    // グリッドの描画
    drawGridWithHighlight();

    // 選択ピースのハイライト表示
    if (selectedPiece) {
        highlightSelectedPiece();
    }
    pop();

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

                // 消去数バーに累計を加算。満タンになったら0.1秒待ってからフィーバータイム発動
                // （フィーバータイム中・移行待ち中は消去数を増やさない）
                if (!isFeverActive() && !isFeverPending()) {
                    totalCleared += deletedCount;
                    if (totalCleared >= CLEAR_BAR_TIER_SIZE) {
                        feverPendingUntil = Date.now() + FEVER_TRANSITION_DELAY_MS;
                    }
                }

                // スコア加算（削除時点で加算）
                const chainNumber = chainLevel + 1;
                let score = scoringSystem.calculateScore(deletedCount, chainNumber);
                // 連続（コンボ）補正: 連続回数 * 1.3倍を適用
                if (chainNumber > 1) {
                    const comboMultiplier = chainNumber * 1.3;
                    score = Math.floor(score * comboMultiplier);
                }
                // フィーバータイム中はスコアさらに倍
                if (isFeverActive()) {
                    score = Math.floor(score * FEVER_SCORE_MULTIPLIER);
                }
                gameState.score += score;
                console.log(`Score: +${score} (total: ${gameState.score})`);

                chainLevel++;

                // 連鎖が2以上ならコンボ扱いにして派手な演出
                if (chainLevel > 1) {
                    const centerX = width / 2;
                    const centerY = CONFIG.MARGIN + 40; // グリッド上部あたりに表示
                    animationManager.addComboBurst(centerX, centerY, chainLevel);
                    // ⑥コンボ時のみ画面を少し揺らす（8コンボで頭打ち）
                    const shakeIntensity = Math.min(chainLevel, 8);
                    animationManager.addScreenShake(3 + shakeIntensity * 1.5, 250);
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

            // 背景（宇宙テーマの暗い角丸マス）
            const isFever = isFeverActive();
            fill(isFever ? color(74, 46, 20) : color(45, 38, 88));
            stroke(isFever ? color(120, 74, 30) : color(104, 90, 180));
            strokeWeight(2);
            rect(x, y, size, size, 10);

            // ハイライト表示
            let isHighlighted = false;
            for (let pos of highlightedPositions) {
                if (pos.col === col && pos.row === row) {
                    noStroke();
                    fill(120, 210, 255, 120);
                    rect(x, y, size, size, 8);
                    isHighlighted = true;
                    break;
                }
            }

            // ピース描画
            const piece = grid.getPiece(col, row);
            if (piece) {
                const visuals = animationManager.getAnimationVisuals(col, row);

                // ドラッグ中のピースだけ少し浮かせて影をつける
                const isDragged = inputManager && inputManager.isDragging &&
                    inputManager.dragStartCol === col && inputManager.dragStartRow === row;
                const liftOffset = isDragged ? -10 : 0;
                const dragScale = isDragged ? 1.1 : 1;

                if (isDragged) {
                    // 元の位置に落ちる影
                    push();
                    noStroke();
                    fill(0, 0, 0, 90);
                    ellipse(x + size / 2, y + size / 2 + size * 0.4, size * 0.7, size * 0.25);
                    pop();
                }

                // アニメーション適用（テクスチャがある場合は画像で描画）
                push();
                translate(x + size / 2 + visuals.offsetX, y + size / 2 + visuals.offsetY + liftOffset);
                scale(visuals.scale * dragScale);

                if (textures && textures[piece.color]) {
                    imageMode(CENTER);
                    tint(255, visuals.alpha);
                    image(textures[piece.color], 0, 0, size - 8, size - 8);
                    noTint();
                } else {
                    // フォールバック：従来の丸描画
                    fill(...PIECE_COLORS[piece.color], visuals.alpha);
                    stroke(0);
                    strokeWeight(2);
                    circle(0, 0, size - 4);
                }

                // ③消去時：白く光るオーバーレイ
                if (visuals.flashAlpha > 0) {
                    noStroke();
                    fill(255, 255, 255, visuals.flashAlpha);
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
        } else if (p.kind === 'heart') {
            push();
            translate(p.x, p.y);
            rotate(p.rotation || 0);
            noStroke();
            fill(...fillColor, p.alpha);
            const s = p.radius;
            // シンプルなハート形状（ベジェ曲線）
            beginShape();
            vertex(0, s * 0.35);
            bezierVertex(s * 0.55, -s * 0.35, s * 1.1, s * 0.15, 0, s * 0.85);
            bezierVertex(-s * 1.1, s * 0.15, -s * 0.55, -s * 0.35, 0, s * 0.35);
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
            // 画像の派手さ（大きさ）は10コンボで頭打ちにする（それ以上は同じ大きさのまま）
            const comboIntensity = Math.min(combo, 10);
            // 11コンボ以上はperfect.pngを表示する
            const comboImg = combo >= 11 ? perfectImage : comboImages[comboIntensity];
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
    stroke(255, 210, 63);
    strokeWeight(3);
    fill(255, 210, 63, 55);
    rect(x, y, size, size, 8);
}

// モード名の日本語ラベル（DOM表示用）
const MODE_LABELS = {
    timemode: 'タイムモード',
    turnmode: 'ターンモード',
    freeplay: 'フリープレイ'
};

// 秒数を mm:ss 形式に整形
function formatClock(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
}

function displayUI() {
    // スコア・モード・残り時間は右側の DOM パネルに表示するため、
    // キャンバス上では GAME OVER の演出のみ描画する
    if (!gameState.gameActive) {
        push();
        noStroke();
        fill(10, 8, 24, 180);
        rect(0, 0, width, height);
        textAlign(CENTER, CENTER);
        // preload() で loadFont() 済みの pixelFont を使うことで、他のUI見出しと
        // 確実に同じ 'Press Start 2P' で描画する（未読み込み時は 'Press Start 2P' 文字列にフォールバック）。
        textFont(pixelFont || 'Press Start 2P');
        textSize(Math.max(30, Math.min(60, width / 3.5)));
        fill(255, 210, 63);
        text('GAME OVER', width / 2, height / 2);
        pop();
        textAlign(LEFT, BASELINE);
    }
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

    const title = document.createElement('div');
    title.className = 'hs-title';
    title.textContent = '♛ HIGHSCORES ♛';
    panel.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'hs-list';
    const medals = ['👑', '🥈', '🥉']; // 👑 🥈 🥉
    const maxEntries = 3;
    for (let i = 0; i < maxEntries; i++) {
        const item = cachedHighscores[i];
        const li = document.createElement('li');
        li.className = `hs-item rank-${i + 1}`;

        const rank = document.createElement('span');
        rank.className = 'hs-rank';
        rank.textContent = medals[i] || (i + 1);

        const name = document.createElement('span');
        name.className = 'hs-name';
        name.textContent = item ? item.name : '---';

        const score = document.createElement('span');
        score.className = 'hs-score';
        score.textContent = item ? Number(item.score).toLocaleString() : '0';

        li.appendChild(rank);
        li.appendChild(name);
        li.appendChild(score);
        list.appendChild(li);
    }
    panel.appendChild(list);
}

function renderUIToDOM() {
    const ui = document.getElementById('ui-container');
    if (!ui || !gameState) return;

    // Clear and build compact UI: Score, Mode, Time/Turns
    ui.innerHTML = '';

    // 「ラベル＋値」の1パネルを作る小ヘルパー
    const makeItem = (cls, label, value) => {
        const el = document.createElement('div');
        el.className = `ui-item ${cls}`;
        const l = document.createElement('span');
        l.className = 'ui-label';
        l.textContent = label;
        const v = document.createElement('span');
        v.className = 'ui-value';
        v.textContent = value;
        el.appendChild(l);
        el.appendChild(v);
        return el;
    };

    const modeIcon = { timemode: '⏱', turnmode: '⚑', freeplay: '▶' }[gameState.mode] || '';
    ui.appendChild(makeItem('ui-score', '★ SCORE ★', Number(gameState.score).toLocaleString()));
    ui.appendChild(makeItem('ui-mode', 'MODE', `${modeIcon} ${MODE_LABELS[gameState.mode] || gameState.mode}`));

    if (gameState.mode === 'timemode') {
        ui.appendChild(makeItem('ui-time', 'TIME', formatClock(gameState.timeRemaining)));
    } else if (gameState.mode === 'turnmode') {
        ui.appendChild(makeItem('ui-turns', 'TURNS', gameState.turnsRemaining));
    }

    // 消去数ゲージとフィーバーゲージを1つのバーとして共用する。
    // 通常時: 消去数（0〜CLEAR_BAR_TIER_SIZE）を溜めていくゲージ
    // フィーバー中: 同じ枠をそのまま使い、残り時間が減っていくゲージに切り替える
    // スマホ表示ではサイドバーが狭すぎるので、プレイ画面下の横向き専用枠に表示する
    const mobileGaugeContainer = document.getElementById('mobile-gauge-container');
    const isMobileGauge = !!(mobileGaugeContainer && mobileGaugeMQ.matches);
    if (mobileGaugeContainer) mobileGaugeContainer.innerHTML = '';

    const gaugeEl = document.createElement('div');
    let ratio;

    if (isFeverActive()) {
        ratio = Math.max(0, Math.min(1, (feverUntil - Date.now()) / FEVER_DURATION_MS));
        gaugeEl.className = 'ui-item ui-clear ui-fever';
    } else {
        ratio = Math.min(totalCleared / CLEAR_BAR_TIER_SIZE, 1);
        gaugeEl.className = 'ui-item ui-clear';
    }

    const gaugeLabel = document.createElement('span');
    gaugeLabel.className = 'ui-clear-label';
    gaugeLabel.textContent = isFeverActive() ? 'FEVER!!' : 'TIME GAUGE';
    gaugeEl.appendChild(gaugeLabel);

    const barOuter = document.createElement('div');
    barOuter.className = 'ui-clear-bar-outer';
    // barOuter の背景（青→オレンジの固定グラデーション）を、未達成の割合だけ
    // 覆い隠すことで、常にトラック全体基準の色（50%なら中間色、100%なら
    // 端までオレンジ）が見えるようにする。
    // 縦ゲージ（PC）は上から高さで覆い、横ゲージ（スマホ）は右から幅で覆う
    const barCover = document.createElement('div');
    barCover.className = 'ui-clear-bar-inner';
    if (isMobileGauge) {
        barCover.style.width = `${(1 - ratio) * 100}%`;
    } else {
        barCover.style.height = `${(1 - ratio) * 100}%`;
    }
    barOuter.appendChild(barCover);
    gaugeEl.appendChild(barOuter);

    if (isMobileGauge) {
        mobileGaugeContainer.appendChild(gaugeEl);
    } else {
        ui.appendChild(gaugeEl);
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
    // 離した瞬間のバウンス演出。スワップが発生した場合は executeSwap 側で
    // 既に両ピース分のバウンスを付けているので、ここでは二重に付けない
    // （gamePhase が 'waiting' のままなら、このジェスチャーでスワップは起きていない）
    if (gamePhase === 'waiting' && inputManager.isDragging &&
        inputManager.dragStartCol !== null && inputManager.dragStartRow !== null) {
        animationManager.addReleaseAnimation(inputManager.dragStartCol, inputManager.dragStartRow);
    }
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

        // 入れ替えるために離した瞬間も、両方のピースに同じバウンスをつける
        animationManager.addReleaseAnimation(toCol, toRow);
        animationManager.addReleaseAnimation(fromCol, fromRow);

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

// ハイスコア登録時の名前入力をモーダルで行う。OKなら入力値（空なら defaultName）、
// キャンセルなら null を resolve する
function showNameInputModal(message, defaultName) {
    return new Promise((resolve) => {
        const modal = document.getElementById('name-input-modal');
        const messageEl = document.getElementById('name-input-message');
        const inputEl = document.getElementById('name-input-field');
        const okBtn = document.getElementById('name-input-ok');
        const cancelBtn = document.getElementById('name-input-cancel');
        if (!modal || !messageEl || !inputEl || !okBtn || !cancelBtn) {
            resolve(defaultName);
            return;
        }

        messageEl.textContent = message;
        inputEl.value = defaultName;
        modal.hidden = false;
        inputEl.focus();
        inputEl.select();

        function cleanup() {
            modal.hidden = true;
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            inputEl.removeEventListener('keydown', onKeydown);
        }
        function onOk() {
            const value = inputEl.value.trim();
            cleanup();
            resolve(value || defaultName);
        }
        function onCancel() {
            cleanup();
            resolve(null);
        }
        function onKeydown(e) {
            if (e.key === 'Enter') onOk();
            else if (e.key === 'Escape') onCancel();
        }

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        inputEl.addEventListener('keydown', onKeydown);
    });
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
        showNameInputModal('ハイスコア！名前を入力してください', defaultName).then(name => {
            if (name === null) name = 'anonymous';

            HighscoreAPI.submitHighscore(mode, name, state.score)
                .then(() => {
                    // DOM を更新
                    if (typeof renderHighscoresToDOM === 'function') renderHighscoresToDOM();
                })
                .catch(err => console.warn('Failed to submit highscore', err));
        });
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
        showNameInputModal('フリープレイのスコアがランキング入りしました。名前を入力してください', defaultName).then(name => {
            if (name === null) name = 'anonymous';

            HighscoreAPI.submitHighscore(mode, name, state.score)
                .then(() => {
                    if (typeof renderHighscoresToDOM === 'function') renderHighscoresToDOM();
                })
                .catch(err => console.warn('Failed to submit freeplay highscore', err));
        });
    }).catch(err => console.warn('Failed to fetch freeplay highscores', err));
};
