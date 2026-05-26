/**
 * MatchDetector クラス
 * マッチ判定と消去ロジック
 */
class MatchDetector {
    constructor(grid, config) {
        this.grid = grid;
        this.config = config;
        this.MIN_MATCH = 4; // 4つ以上で消える
        this.animationManager = null;
    }

    setAnimationManager(animMgr) {
        this.animationManager = animMgr;
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
        // matchPositions を起点に、隣接する同色領域も含めて削除する
        const toDeleteSet = new Set();
        const seen = new Set();

        const key = (c, r) => `${c},${r}`;

        for (const start of matchPositions) {
            const sk = key(start.col, start.row);
            if (seen.has(sk)) continue;

            const startPiece = this.grid.getPiece(start.col, start.row);
            if (!startPiece) continue;
            const color = startPiece.color;

            // BFSで連結領域を探索
            const queue = [ { col: start.col, row: start.row } ];
            while (queue.length > 0) {
                const p = queue.shift();
                const pk = key(p.col, p.row);
                if (seen.has(pk)) continue;
                seen.add(pk);

                const piece = this.grid.getPiece(p.col, p.row);
                if (!piece) continue;
                if (piece.color !== color) continue;

                toDeleteSet.add(pk);

                // 4方向の隣接を追加
                const neighbors = [
                    { col: p.col - 1, row: p.row },
                    { col: p.col + 1, row: p.row },
                    { col: p.col, row: p.row - 1 },
                    { col: p.col, row: p.row + 1 }
                ];
                for (const n of neighbors) {
                    if (n.col < 0 || n.col >= this.grid.cols || n.row < 0 || n.row >= this.grid.rows) continue;
                    const nk = key(n.col, n.row);
                    if (!seen.has(nk)) queue.push(n);
                }
            }
        }

        // 実際に削除
        for (const entry of toDeleteSet) {
            const [c, r] = entry.split(',').map(Number);
            this.grid.setPiece(c, r, null);
        }

        return toDeleteSet.size;
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

                        // アニメーションを追加（上から下へ落ちる動き）
                        if (this.animationManager) {
                            this.animationManager.addFallAnimation(col, sourceRow, row);
                        }
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
                    const newPiece = new Piece(col, row, randomColor);
                    this.grid.setPiece(col, row, newPiece);

                    // 新規生成したピースは上から落ちてくるようにアニメーションを追加
                    if (this.animationManager) {
                        // fromRow を -1 にして上から落ちてくる表現にする
                        this.animationManager.addFallAnimation(col, -1, row);
                    }
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

    /**
     * 指定されたマッチ位置から拡張して、隣接同色領域を含む削除対象一覧を返す
     * @returns {Array} [{col,row}, ...]
     */
    expandMatches(matchPositions) {
        const toDeleteSet = new Set();
        const seen = new Set();
        const key = (c, r) => `${c},${r}`;

        for (const start of matchPositions) {
            const sk = key(start.col, start.row);
            if (seen.has(sk)) continue;

            const startPiece = this.grid.getPiece(start.col, start.row);
            if (!startPiece) continue;
            const color = startPiece.color;

            const queue = [ { col: start.col, row: start.row } ];
            while (queue.length > 0) {
                const p = queue.shift();
                const pk = key(p.col, p.row);
                if (seen.has(pk)) continue;
                seen.add(pk);

                const piece = this.grid.getPiece(p.col, p.row);
                if (!piece) continue;
                if (piece.color !== color) continue;

                toDeleteSet.add(pk);

                const neighbors = [
                    { col: p.col - 1, row: p.row },
                    { col: p.col + 1, row: p.row },
                    { col: p.col, row: p.row - 1 },
                    { col: p.col, row: p.row + 1 }
                ];
                for (const n of neighbors) {
                    if (n.col < 0 || n.col >= this.grid.cols || n.row < 0 || n.row >= this.grid.rows) continue;
                    const nk = key(n.col, n.row);
                    if (!seen.has(nk)) queue.push(n);
                }
            }
        }

        return Array.from(toDeleteSet).map(s => {
            const [c, r] = s.split(',').map(Number);
            return { col: c, row: r };
        });
    }
}
