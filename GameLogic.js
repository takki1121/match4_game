/**
 * GameLogic クラス
 * ゲームロジック全般を管理
 */
class GameLogic {
    constructor(grid, config) {
        this.grid = grid;
        this.config = config;
    }

    /**
     * 2つのピースを交換
     * @returns {boolean} 交換が成功したかどうか
     */
    swapPieces(fromCol, fromRow, toCol, toRow) {
        // グリッド範囲をチェック
        if (!this.isValidPosition(fromCol, fromRow) || !this.isValidPosition(toCol, toRow)) {
            return false;
        }

        // 隣同士か確認
        if (!this.isAdjacent(fromCol, fromRow, toCol, toRow)) {
            return false;
        }

        // ピースを交換
        this.grid.swapPieces(fromCol, fromRow, toCol, toRow);
        return true;
    }

    /**
     * 位置が有効か確認
     */
    isValidPosition(col, row) {
        return col >= 0 && col < this.grid.cols && row >= 0 && row < this.grid.rows;
    }

    /**
     * 2つの位置が隣同士か確認（縦横のみ）
     */
    isAdjacent(col1, row1, col2, row2) {
        const distance = Math.abs(col1 - col2) + Math.abs(row1 - row2);
        return distance === 1;
    }

    /**
     * 指定位置の周囲をハイライト表示（UI用）
     */
    getAdjacentPositions(col, row) {
        const adjacent = [];
        
        // 上
        if (row > 0) adjacent.push({ col, row: row - 1 });
        // 下
        if (row < this.grid.rows - 1) adjacent.push({ col, row: row + 1 });
        // 左
        if (col > 0) adjacent.push({ col: col - 1, row });
        // 右
        if (col < this.grid.cols - 1) adjacent.push({ col: col + 1, row });
        
        return adjacent;
    }

    /**
     * ピースの色を取得
     */
    getPieceColor(col, row) {
        const piece = this.grid.getPiece(col, row);
        return piece ? piece.color : null;
    }

    /**
     * ピースを置き換え
     */
    replacePiece(col, row, newColor) {
        const piece = this.grid.getPiece(col, row);
        if (piece) {
            piece.setColor(newColor);
        }
    }
}
