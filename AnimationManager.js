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
    }

    /**
     * 消去アニメーションを追加
     */
    addDeleteAnimation(col, row, colorIndex = null) {
        this.animations.push({
            type: 'delete',
            col,
            row,
            startTime: Date.now(),
            duration: this.animationDuration
        });

        // パーティクルを生成（パッというエフェクト）
        if (this.config) {
            const size = this.config.PIECE_SIZE;
            const margin = this.config.MARGIN;
            const cx = col * (size + margin) + margin + size / 2;
            const cy = row * (size + margin) + margin + size / 2;

            const count = 8;
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

            // 星スパークルを少数追加
            const starCount = 3;
            for (let i = 0; i < starCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 0.6 + Math.random() * 1.2;
                this.particles.push({
                    x: cx + (Math.random() - 0.5) * 8,
                    y: cy + (Math.random() - 0.5) * 8,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 0.3,
                    radius: 10 + Math.random() * 8,
                    alpha: 255,
                    life: 400 + Math.random() * 300,
                    start: Date.now(),
                    colorIndex: colorIndex,
                    kind: 'star',
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.2
                });
            }
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
            duration: this.animationDuration
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
            offsetY: 0
        };

        for (let anim of this.animations) {
            if (anim.col !== col) continue;

            // press はクリックされたピースを一瞬だけ縮小させる
            if (anim.type === 'press') {
                if (anim.row !== row) continue;
                const progress = this.getProgress(anim);
                visuals.scale = 1 - 0.05 * progress;
            }

            // delete は anim.row と一致するピースに適用
            if (anim.type === 'delete') {
                if (anim.row !== row) continue;
                const progress = this.getProgress(anim);
                visuals.alpha = 255 * (1 - progress);
                visuals.scale = 1 + Math.sin(progress * Math.PI) * 0.6 * (1 - progress);
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
