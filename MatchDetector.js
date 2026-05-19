/**
 * MatchDetector クラス
 * マッチ判定と消去ロジック
 */
class MatchDetector {
    constructor(grid, config) {
        this.grid = grid;
        this.config = config;
        this.MIN_MATCH = 4; // 4つ以上で消える
    }

    /**
     * 全ボード内のマッチを検出
     * @returns {Array} マッチしたピースの位置 [{col, row}, ...]
     */
    detectAllMatches() {
        const matches = new Set();
        
        // すべてのピースについてチェック
        for (let row = 0; row < this.grid.rows; row++) {
            for (let col = 0; col < this.grid.cols; col++) {
                const horizontalMatches = this.findHorizontalMatches(col, row);
                const verticalMatches = this.findVerticalMatches(col, row);
                
                horizontalMatches.forEach(pos => matches.add(JSON.stringify(pos)));
                verticalMatches.forEach(pos => matches.add(JSON.stringify(pos)));
            }
        }
        
        return Array.from(matches).map(str => JSON.parse(str));
    }

    /**
     * 指定位置からの横方向マッチを検出
     */
    findHorizontalMatches(col, row) {
        const piece = this.grid.getPiece(col, row);
        if (!piece) return [];

        const matches = [{ col, row }];
        const color = piece.color;

        // 左方向を探索
        let leftCol = col - 1;
        while (leftCol >= 0 && this.grid.getPiece(leftCol, row)?.color === color) {
            matches.push({ col: leftCol, row });
            leftCol--;
        }

        // 右方向を探索
        let rightCol = col + 1;
        while (rightCol < this.grid.cols && this.grid.getPiece(rightCol, row)?.color === color) {
            matches.push({ col: rightCol, row });
            rightCol++;
        }

        // 4つ以上でマッチ
        return matches.length >= this.MIN_MATCH ? matches : [];
    }

    /**
     * 指定位置からの縦方向マッチを検出
     */
    findVerticalMatches(col, row) {
        const piece = this.grid.getPiece(col, row);
        if (!piece) return [];

        const matches = [{ col, row }];
        const color = piece.color;

        // 上方向を探索
        let upRow = row - 1;
        while (upRow >= 0 && this.grid.getPiece(col, upRow)?.color === color) {
            matches.push({ col, row: upRow });
            upRow--;
        }

        // 下方向を探索
        let downRow = row + 1;
        while (downRow < this.grid.rows && this.grid.getPiece(col, downRow)?.color === color) {
            matches.push({ col, row: downRow });
            downRow++;
        }

        // 4つ以上でマッチ
        return matches.length >= this.MIN_MATCH ? matches : [];
    }

    /**
     * マッチしたピースをマークして削除
     */
    removeMatches(matchPositions) {
        const deletedCount = matchPositions.length;
        
        matchPositions.forEach(({ col, row }) => {
            const piece = this.grid.getPiece(col, row);
            if (piece) {
                this.grid.setPiece(col, row, null);
            }
        });

        return deletedCount;
    }

    /**
     * ピースが落下（重力適用）
     * @returns {boolean} ピースが移動したか
     */
    applyGravity() {
        let pieceMoved = false;

        // 下から上へスキャン（重力の影響を正確に）
        for (let row = this.grid.rows - 1; row > 0; row--) {
            for (let col = 0; col < this.grid.cols; col++) {
                if (!this.grid.getPiece(col, row)) {
                    // 空いている場合、上から落ちてくるピースを探す
                    let sourceRow = row - 1;
                    while (sourceRow >= 0 && !this.grid.getPiece(col, sourceRow)) {
                        sourceRow--;
                    }

                    if (sourceRow >= 0) {
                        const piece = this.grid.getPiece(col, sourceRow);
                        this.grid.setPiece(col, row, piece);
                        this.grid.setPiece(col, sourceRow, null);
                        pieceMoved = true;
                    }
                }
            }
        }

        return pieceMoved;
    }

    /**
     * 空いた位置に新しいピースを生成
     */
    fillEmptySpaces() {
        for (let row = 0; row < this.grid.rows; row++) {
            for (let col = 0; col < this.grid.cols; col++) {
                if (!this.grid.getPiece(col, row)) {
                    const randomColor = Math.floor(Math.random() * this.grid.numColors);
                    this.grid.setPiece(col, row, new Piece(col, row, randomColor));
                }
            }
        }
    }

    /**
     * 連鎖判定（現在のボード状態でマッチがあるか）
     */
    hasMatches() {
        return this.detectAllMatches().length > 0;
    }
}
