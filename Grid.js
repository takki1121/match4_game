/**
 * Grid クラス
 * ゲーム盤面全体を管理
 */
class Grid {
    constructor(cols, rows, numColors) {
        this.cols = cols;
        this.rows = rows;
        this.numColors = numColors;
        this.board = []; // 2D配列でピースを管理
    }

    /**
     * ボードをランダムな色で初期化
     */
    initializeBoardRandom() {
        this.board = [];
        for (let row = 0; row < this.rows; row++) {
            this.board[row] = [];
            for (let col = 0; col < this.cols; col++) {
                const randomColor = Math.floor(Math.random() * this.numColors);
                this.board[row][col] = new Piece(col, row, randomColor);
            }
        }
    }

    /**
     * ボードをクリア（空の状態で初期化）
     */
    clearBoard() {
        this.board = [];
        for (let row = 0; row < this.rows; row++) {
            this.board[row] = [];
            for (let col = 0; col < this.cols; col++) {
                this.board[row][col] = null;
            }
        }
    }

    /**
     * 指定位置のピースを取得
     */
    getPiece(col, row) {
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            return this.board[row][col];
        }
        return null;
    }

    /**
     * 指定位置にピースを設定
     */
    setPiece(col, row, piece) {
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            this.board[row][col] = piece;
            if (piece) {
                piece.col = col;
                piece.row = row;
            }
        }
    }

    /**
     * 2つのピースを交換
     */
    swapPieces(col1, row1, col2, row2) {
        const piece1 = this.getPiece(col1, row1);
        const piece2 = this.getPiece(col2, row2);

        this.setPiece(col1, row1, piece2);
        this.setPiece(col2, row2, piece1);
    }

    /**
     * グリッドを描画
     */
    display() {
        const margin = CONFIG.MARGIN;
        const size = CONFIG.PIECE_SIZE;

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const x = col * (size + margin) + margin;
                const y = row * (size + margin) + margin;

                // 背景
                fill(200);
                stroke(150);
                strokeWeight(1);
                rect(x, y, size, size);

                // ピース
                const piece = this.getPiece(col, row);
                if (piece) {
                    piece.display(x, y, size);
                }
            }
        }
    }

    /**
     * 行のピースを新しいピースで満たす（ランダムな色）
     */
    fillEmptyRow(row) {
        for (let col = 0; col < this.cols; col++) {
            if (!this.getPiece(col, row)) {
                const randomColor = Math.floor(Math.random() * this.numColors);
                this.setPiece(col, row, new Piece(col, row, randomColor));
            }
        }
    }

    /**
     * 列のピースを新しいピースで満たす（ランダムな色）
     */
    fillEmptyColumn(col) {
        for (let row = 0; row < this.rows; row++) {
            if (!this.getPiece(col, row)) {
                const randomColor = Math.floor(Math.random() * this.numColors);
                this.setPiece(col, row, new Piece(col, row, randomColor));
            }
        }
    }
}
