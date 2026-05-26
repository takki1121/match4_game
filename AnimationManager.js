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
        }
    }

    /**
     * 落下アニメーションを追加
     */
    addFallAnimation(col, fromRow, toRow) {
        this.animations.push({
            type: 'fall',
            col,
            fromRow,
            toRow,
            startTime: Date.now(),
            duration: this.animationDuration,
            distance: Math.abs(toRow - fromRow)
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
            p.alpha = Math.max(0, 255 * (1 - t / p.life));
            return p.alpha > 5;
        });
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
            offsetY: 0
        };

        for (let anim of this.animations) {
            if (anim.col !== col || anim.row !== row) continue;

            const progress = this.getProgress(anim);

            if (anim.type === 'delete') {
                // 消去アニメーション：ポップしてフェードアウト
                visuals.alpha = 255 * (1 - progress);
                // 初めに少し大きく（パッ）、その後縮小して消える
                visuals.scale = 1 + Math.sin(progress * Math.PI) * 0.6 * (1 - progress);
            } else if (anim.type === 'fall') {
                // 落下アニメーション：最終行（grid に移動済み）に対して
                // 初期は上から落ちてくるように見せ、最終位置で offsetY = 0 になる
                const distance = anim.toRow - anim.fromRow;
                const totalPixels = distance * (CONFIG.PIECE_SIZE + CONFIG.MARGIN);
                // progress=0 -> offsetY = -totalPixels (上に位置), progress=1 -> 0
                visuals.offsetY = - (1 - progress) * totalPixels;
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
