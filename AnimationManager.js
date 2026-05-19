/**
 * AnimationManager クラス
 * 消去と落下のアニメーション管理
 */
class AnimationManager {
    constructor() {
        this.animations = []; // 進行中のアニメーション
        this.animationDuration = 300; // ミリ秒
    }

    /**
     * 消去アニメーションを追加
     */
    addDeleteAnimation(col, row) {
        this.animations.push({
            type: 'delete',
            col,
            row,
            startTime: Date.now(),
            duration: this.animationDuration
        });
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
        matchPositions.forEach(({ col, row }) => {
            this.addDeleteAnimation(col, row);
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
        this.animations = this.animations.filter(anim => {
            const progress = this.getProgress(anim);
            return progress < 1;
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
                // 消去アニメーション：透明度が減少
                visuals.alpha = 255 * (1 - progress);
                visuals.scale = 1 - progress * 0.2; // 少し小さくなる
            } else if (anim.type === 'fall') {
                // 落下アニメーション：Y軸オフセット
                const startY = anim.fromRow;
                const endY = anim.toRow;
                const currentY = startY + (endY - startY) * progress;
                visuals.offsetY = (currentY - anim.fromRow) * (CONFIG.PIECE_SIZE + CONFIG.MARGIN);
            }
        }

        return visuals;
    }
}
