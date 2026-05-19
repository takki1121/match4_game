/**
 * Piece クラス
 * 各ピースの状態と描画を管理
 */
class Piece {
    constructor(col, row, color) {
        this.col = col;
        this.row = row;
        this.color = color; // 0:赤, 1:黄緑, 2:青, 3:黄色
        this.isMatched = false;
        this.isAnimating = false;
        this.animationProgress = 0;
    }

    /**
     * ピースを描画
     */
    display(x, y, size) {
        const colors = [
            color(255, 0, 0),      // 赤
            color(0, 255, 0),      // 黄緑
            color(0, 0, 255),      // 青
            color(255, 255, 0)     // 黄色
        ];

        fill(colors[this.color]);
        stroke(0);
        strokeWeight(2);
        
        // マッチ状態の場合は透明度を下げる
        if (this.isMatched) {
            fill(...colors[this.color].levels.slice(0, 3), 100);
        }
        
        circle(x + size / 2, y + size / 2, size - 4);
    }

    /**
     * ピースの色を設定
     */
    setColor(color) {
        this.color = color;
    }

    /**
     * ピースをマッチ状態に設定
     */
    markForDeletion() {
        this.isMatched = true;
    }

    /**
     * ピースをリセット（マッチ状態を解除）
     */
    reset() {
        this.isMatched = false;
        this.isAnimating = false;
        this.animationProgress = 0;
    }

    /**
     * ランダムな色を割り当て
     */
    setRandomColor(numColors) {
        this.color = Math.floor(Math.random() * numColors);
    }
}
