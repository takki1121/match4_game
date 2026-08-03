/**
 * AnimationManager クラス
 * 消去と落下のアニメーション管理
 */
class AnimationManager {
    constructor() {
        this.animations = []; // 進行中のアニメーション
        this.animationDuration = 300; // ミリ秒
        this.particles = []; // 消去時のパーティクル
        this.config = null;
        this.comboPulse = null; // コンボ演出の状態
        this.screenShake = null; // 画面揺れの状態（コンボ時のみ）

        // 消去演出の各フェーズの時間（ミリ秒）
        // ①一瞬縮む → ②少し大きくなる → ③白く光る → （④星・ハート飛散） → ⑤フェードアウト
        // ①～④は視認しやすいようゆっくりめに設定
        this.deletePhase = {
            shrink: 80,
            grow: 160,
            flash: 90,
            fade: 150
        };
        this.deletePhase.total =
            this.deletePhase.shrink + this.deletePhase.grow + this.deletePhase.flash + this.deletePhase.fade;
    }

    /**
     * 消去アニメーションを追加
     * ①一瞬縮む(0.03s) → ②1.15倍に膨らむ → ③白く光る(0.03s) → ④星・ハート飛散 → ⑤フェードアウト
     */
    addDeleteAnimation(col, row, colorIndex = null) {
        let cx = null;
        let cy = null;
        if (this.config) {
            const size = this.config.PIECE_SIZE;
            const margin = this.config.MARGIN;
            cx = col * (size + margin) + margin + size / 2;
            cy = row * (size + margin) + margin + size / 2;
        }

        this.animations.push({
            type: 'delete',
            col,
            row,
            startTime: Date.now(),
            duration: this.deletePhase.total,
            colorIndex,
            cx,
            cy,
            particlesSpawned: false
        });
    }

    /**
     * ④星・ハートが飛び散るパーティクルを生成
     */
    _spawnDeleteParticles(cx, cy, colorIndex) {
        if (cx === null || cy === null) return;

        // 星パーティクル
        const starCount = 4;
        for (let i = 0; i < starCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.8 + Math.random() * 2;
            this.particles.push({
                x: cx + (Math.random() - 0.5) * 8,
                y: cy + (Math.random() - 0.5) * 8,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.5,
                radius: 8 + Math.random() * 7,
                alpha: 255,
                life: 400 + Math.random() * 300,
                start: Date.now(),
                colorIndex: colorIndex,
                kind: 'star',
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.3
            });
        }

        // ハートパーティクル
        const heartCount = 3;
        for (let i = 0; i < heartCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.6 + Math.random() * 1.6;
            this.particles.push({
                x: cx + (Math.random() - 0.5) * 8,
                y: cy + (Math.random() - 0.5) * 8,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.6,
                radius: 7 + Math.random() * 6,
                alpha: 255,
                life: 450 + Math.random() * 300,
                start: Date.now(),
                colorIndex: colorIndex,
                kind: 'heart',
                rotation: (Math.random() - 0.5) * 0.6,
                rotSpeed: (Math.random() - 0.5) * 0.15
            });
        }

        // 細かい飛び散り粒
        const count = 6;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            this.particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.5,
                radius: 2 + Math.random() * 3,
                alpha: 255,
                life: 300 + Math.random() * 200,
                start: Date.now(),
                colorIndex: colorIndex
            });
        }
    }

    /**
     * 落下アニメーションを追加
     */
    addFallAnimation(col, fromRow, toRow) {
        const distance = Math.abs(toRow - fromRow);
        // 距離に応じてアニメーション時間を伸ばす
        const duration = Math.max(this.animationDuration, this.animationDuration * distance);

        // ピクセルでの開始/終了位置を計算（マスを無視して連続的に落ちる表現）
        const size = this.config ? this.config.PIECE_SIZE : CONFIG.PIECE_SIZE;
        const margin = this.config ? this.config.MARGIN : CONFIG.MARGIN;
        const cell = size + margin;
        const startY = fromRow * cell + margin; // fromRow が -1 の場合は上に出現する
        const endY = toRow * cell + margin;

        this.animations.push({
            type: 'fall',
            col,
            fromRow,
            toRow,
            startY,
            endY,
            startTime: Date.now(),
            duration: duration,
            distance: distance
        });
    }

    /**
     * クリック（プレス）した瞬間に少し縮む演出を追加
     * 100% → 95% へ約0.05秒で縮む
     */
    addPressAnimation(col, row) {
        this.animations.push({
            type: 'press',
            col,
            row,
            startTime: Date.now(),
            duration: 50
        });
    }

    /**
     * 指を離した瞬間のバウンス演出を追加
     * 95% → 105% → 100% を約0.12秒で行う
     */
    addReleaseAnimation(col, row) {
        this.animations.push({
            type: 'release',
            col,
            row,
            startTime: Date.now(),
            duration: 220
        });
    }

    /**
     * 交換（スワップ）アニメーションを追加
     * col, row: このピースの交換後（現在）の位置
     * fromCol, fromRow: 交換前の位置
     */
    addSwapAnimation(col, row, fromCol, fromRow) {
        this.animations.push({
            type: 'swap',
            col,
            row,
            fromCol,
            fromRow,
            startTime: Date.now(),
            duration: 150 // 入れ替えはテンポよく感じられるよう短めに
        });
    }

    /**
     * 複数のピース削除アニメーション
     */
    addMultipleDeleteAnimations(matchPositions) {
        // 互換性のため、第二引数に grid を渡せる。渡されたらピースの色をパーティクルに反映する
        const grid = arguments[1];
        matchPositions.forEach(({ col, row }) => {
            const piece = grid ? grid.getPiece(col, row) : null;
            const colorIndex = piece ? piece.color : null;
            this.addDeleteAnimation(col, row, colorIndex);
        });
    }

    /**
     * アニメーション中か
     */
    isAnimating() {
        return this.animations.length > 0;
    }

    /**
     * アニメーション進捗を取得（0～1）
     */
    getProgress(animation) {
        const elapsed = Date.now() - animation.startTime;
        return Math.min(elapsed / animation.duration, 1);
    }

    /**
     * 完了したアニメーションを削除
     */
    updateAnimations() {
        const now = Date.now();

        // ④白く光った直後のタイミングで星・ハートを飛び散らせる
        const spawnAt = this.deletePhase.shrink + this.deletePhase.grow + this.deletePhase.flash;
        for (const anim of this.animations) {
            if (anim.type !== 'delete' || anim.particlesSpawned) continue;
            if (now - anim.startTime >= spawnAt) {
                this._spawnDeleteParticles(anim.cx, anim.cy, anim.colorIndex);
                anim.particlesSpawned = true;
            }
        }

        this.animations = this.animations.filter(anim => {
            const progress = this.getProgress(anim);
            return progress < 1;
        });

        // パーティクル更新
        this.particles = this.particles.filter(p => {
            const t = now - p.start;
            if (t > p.life) return false;
            // 物理風味の更新
            p.vy += 0.06; // 重力
            p.x += p.vx * (1 + t / 200);
            p.y += p.vy * (1 + t / 200);
            if (typeof p.rotation === 'number' && typeof p.rotSpeed === 'number') {
                p.rotation += p.rotSpeed * (1 + t / 200);
            }
            p.alpha = Math.max(0, 255 * (1 - t / p.life));
            return p.alpha > 5;
        });

        // comboPulse の終了チェック
        if (this.comboPulse) {
            if (Date.now() - this.comboPulse.start > this.comboPulse.duration) {
                this.comboPulse = null;
            }
        }

        // 画面揺れの終了チェック
        if (this.screenShake) {
            if (Date.now() - this.screenShake.start > this.screenShake.duration) {
                this.screenShake = null;
            }
        }
    }

    /**
     * ⑥画面が少し揺れる演出を追加（コンボ時のみ呼び出す想定）
     */
    addScreenShake(intensity = 6, duration = 250) {
        this.screenShake = {
            start: Date.now(),
            duration,
            intensity
        };
    }

    /**
     * 現在の画面揺れオフセットを取得（{x, y}）。揺れていなければ {x:0, y:0}
     */
    getScreenShakeOffset() {
        if (!this.screenShake) return { x: 0, y: 0 };
        const elapsed = Date.now() - this.screenShake.start;
        const progress = Math.min(elapsed / this.screenShake.duration, 1);
        // 時間とともに減衰させる
        const damp = 1 - progress;
        const amount = this.screenShake.intensity * damp;
        return {
            x: (Math.random() - 0.5) * 2 * amount,
            y: (Math.random() - 0.5) * 2 * amount
        };
    }

    /**
     * コンボ演出のバーストを追加
     * x,y: ピクセル座標
     */
    addComboBurst(x, y, comboCount) {
        const now = Date.now();
        // 演出の派手さは8コンボで頭打ちにする（それ以上は同じ強さのまま）
        const intensity = Math.min(comboCount, 8);
        const burstCount = 28 + intensity * 5;
        for (let i = 0; i < burstCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.6 + Math.random() * 4 * (1 + intensity / 5);
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.6,
                radius: 4 + Math.random() * (6 + intensity),
                alpha: 255,
                life: 500 + Math.random() * 600,
                start: now,
                colorIndex: null,
                kind: 'star',
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.4
            });
        }

        // 大きな画面パルス（フラッシュ）
        this.comboPulse = {
            start: now,
            duration: 600 + intensity * 100,
            x,
            y,
            combo: comboCount
        };
    }

    getComboPulse() {
        return this.comboPulse;
    }

    /**
     * アニメーションをすべてクリア
     */
    clear() {
        this.animations = [];
    }

    /**
     * アニメーション中のピースを特別な方法で描画（透明度や拡大など）
     */
    getAnimationVisuals(col, row) {
        const visuals = {
            alpha: 255,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            flashAlpha: 0
        };

        for (let anim of this.animations) {
            if (anim.col !== col) continue;

            // press はクリックされたピースを一瞬だけ縮小させる
            if (anim.type === 'press') {
                if (anim.row !== row) continue;
                const progress = this.getProgress(anim);
                visuals.scale = 1 - 0.05 * progress;
            }

            // release は指を離した瞬間のバウンス（95%→105%→100%）
            if (anim.type === 'release') {
                if (anim.row !== row) continue;
                const progress = this.getProgress(anim);
                if (progress < 0.5) {
                    const p = progress / 0.5;
                    const eased = 1 - Math.pow(1 - p, 2);
                    visuals.scale = 0.85 + eased * (1.22 - 0.85);
                } else {
                    const p = (progress - 0.5) / 0.5;
                    const eased = 1 - Math.pow(1 - p, 2);
                    visuals.scale = 1.22 + eased * (1 - 1.22);
                }
            }

            // delete は anim.row と一致するピースに適用
            // ①一瞬縮む → ②1.15倍に膨らむ → ③白く光る → ⑤フェードアウト
            if (anim.type === 'delete') {
                if (anim.row !== row) continue;
                const elapsed = Date.now() - anim.startTime;
                const { shrink, grow, flash, fade } = this.deletePhase;

                if (elapsed < shrink) {
                    // ①一瞬縮む（1.0 → 0.85）
                    const p = elapsed / shrink;
                    visuals.scale = 1 + (0.85 - 1) * p;
                    visuals.alpha = 255;
                } else if (elapsed < shrink + grow) {
                    // ②少し大きくなる（0.85 → 1.15）
                    const p = (elapsed - shrink) / grow;
                    const eased = 1 - Math.pow(1 - p, 2);
                    visuals.scale = 0.85 + eased * (1.15 - 0.85);
                    visuals.alpha = 255;
                } else if (elapsed < shrink + grow + flash) {
                    // ③白く光る（大きさ1.15を保ったまま白フラッシュ）
                    const p = (elapsed - shrink - grow) / flash;
                    visuals.scale = 1.15;
                    visuals.alpha = 255;
                    visuals.flashAlpha = 255 * Math.sin(Math.min(p, 1) * Math.PI);
                } else {
                    // ⑤本体がフェードアウト
                    const p = Math.min((elapsed - shrink - grow - flash) / fade, 1);
                    visuals.scale = 1.15;
                    visuals.alpha = 255 * (1 - p);
                    visuals.flashAlpha = 0;
                }
            }

            // fall は最終到達行（toRow）にいるピースに対して表示を調整
            if (anim.type === 'fall') {
                if (anim.toRow !== row) continue;
                const progress = this.getProgress(anim);
                // イージング（easeOutCubic）
                const eased = 1 - Math.pow(1 - progress, 3);
                const currentY = anim.startY + eased * (anim.endY - anim.startY);
                // 描画側は最終位置(anim.endY)に描くため、その差分を offsetY として返す
                visuals.offsetY = currentY - anim.endY;
            }

            // swap は交換後の位置（col, row）にいるピースに対して表示を調整
            if (anim.type === 'swap') {
                if (anim.row !== row) continue;
                const progress = this.getProgress(anim);
                const eased = 1 - Math.pow(1 - progress, 3);
                const size = this.config ? this.config.PIECE_SIZE : CONFIG.PIECE_SIZE;
                const margin = this.config ? this.config.MARGIN : CONFIG.MARGIN;
                const cell = size + margin;
                const fromX = anim.fromCol * cell;
                const fromY = anim.fromRow * cell;
                const toX = anim.col * cell;
                const toY = anim.row * cell;
                const currentX = fromX + eased * (toX - fromX);
                const currentY = fromY + eased * (toY - fromY);
                visuals.offsetX = currentX - toX;
                visuals.offsetY = currentY - toY;
            }
        }

        return visuals;
    }

    // 外部から config を設定（createCanvas 後にセットする）
    setConfig(cfg) {
        this.config = cfg;
    }

    getParticles() {
        return this.particles;
    }
}
