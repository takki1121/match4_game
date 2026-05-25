/**
 * Input クラス
 * マウス入力を処理（ドラッグとクリック2回）
 */
class Input {
    constructor(grid, config) {
        this.grid = grid;
        this.config = config;
        
        // ドラッグ操作
        this.isDragging = false;
        this.dragStartCol = null;
        this.dragStartRow = null;
        this.dragStartX = null;
        this.dragStartY = null;
        this.dragThreshold = 15; // ドラッグ判定のしきい値
        
        // クリック2回操作
        this.firstClickCol = null;
        this.firstClickRow = null;
        this.firstClickTime = null;
        this.doubleClickTimeLimit = 500; // ミリ秒
    }

    /**
     * マウス座標をグリッド座標に変換
     */
    screenToGrid(screenX, screenY) {
        const { PIECE_SIZE, MARGIN } = this.config;
        // 描画側では各セルが left/top に MARGIN のオフセットで描かれるため
        // 入力座標から MARGIN を引いてからセル計算を行う
        const col = Math.floor((screenX - MARGIN) / (PIECE_SIZE + MARGIN));
        const row = Math.floor((screenY - MARGIN) / (PIECE_SIZE + MARGIN));

        return { col, row };
    }

    /**
     * グリッド座標が有効か
     */
    isValidGridPosition(col, row) {
        return col >= 0 && col < this.grid.cols && row >= 0 && row < this.grid.rows;
    }

    /**
     * マウスが隣同士のピースか判定
     */
    isAdjacent(col1, row1, col2, row2) {
        const distance = Math.abs(col1 - col2) + Math.abs(row1 - row2);
        return distance === 1;
    }

    /**
     * マウスプレス時の処理
     */
    handleMousePressed(mouseX, mouseY) {
        const { col, row } = this.screenToGrid(mouseX, mouseY);
        
        if (!this.isValidGridPosition(col, row)) {
            return null;
        }
        
        const now = Date.now();
        
        // ドラッグ開始
        this.isDragging = true;
        this.dragStartCol = col;
        this.dragStartRow = row;
        this.dragStartX = mouseX;
        this.dragStartY = mouseY;
        
        // クリック2回判定
        if (
            this.firstClickCol !== null &&
            this.firstClickCol === col &&
            this.firstClickRow === row &&
            now - this.firstClickTime < this.doubleClickTimeLimit
        ) {
            // 同じピースを2回クリック - キャンセル
            this.firstClickCol = null;
            this.firstClickRow = null;
            return null;
        }
        
        if (
            this.firstClickCol !== null &&
            now - this.firstClickTime < this.doubleClickTimeLimit
        ) {
            // 2回目のクリック（異なるピース）
            const swapResult = {
                from: { col: this.firstClickCol, row: this.firstClickRow },
                to: { col, row },
                type: 'click'
            };
            
            this.firstClickCol = null;
            this.firstClickRow = null;
            
            return swapResult;
        }
        
        // 1回目のクリック
        this.firstClickCol = col;
        this.firstClickRow = row;
        this.firstClickTime = now;
        
        return null;
    }

    // エイリアス（タッチ用に同じ引数で呼べるようにする）
    handlePointerPressed(x, y) {
        return this.handleMousePressed(x, y);
    }

    /**
     * マウスドラッグ時の処理
     */
    handleMouseDragged(mouseX, mouseY) {
        if (!this.isDragging || this.dragStartCol === null) {
            return null;
        }
        
        const dx = mouseX - this.dragStartX;
        const dy = mouseY - this.dragStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // ドラッグ距離がしきい値を超えた場合
        if (distance < this.dragThreshold) {
            return null;
        }
        
        // ドラッグ方向を判定
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        
        let targetCol = this.dragStartCol;
        let targetRow = this.dragStartRow;
        
        // 横方向のドラッグ
        if (absDx > absDy) {
            if (dx > 0) {
                targetCol = this.dragStartCol + 1; // 右
            } else {
                targetCol = this.dragStartCol - 1; // 左
            }
        }
        // 縦方向のドラッグ
        else {
            if (dy > 0) {
                targetRow = this.dragStartRow + 1; // 下
            } else {
                targetRow = this.dragStartRow - 1; // 上
            }
        }
        
        if (!this.isValidGridPosition(targetCol, targetRow)) {
            return null;
        }
        
        return {
            from: { col: this.dragStartCol, row: this.dragStartRow },
            to: { col: targetCol, row: targetRow },
            type: 'drag'
        };
    }

    handlePointerDragged(x, y) {
        return this.handleMouseDragged(x, y);
    }

    /**
     * マウスリリース時の処理
     */
    handleMouseReleased() {
        this.isDragging = false;
        this.dragStartCol = null;
        this.dragStartRow = null;
        this.dragStartX = null;
        this.dragStartY = null;
    }

    handlePointerReleased() {
        return this.handleMouseReleased();
    }

    /**
     * 入力状態をリセット
     */
    reset() {
        this.isDragging = false;
        this.dragStartCol = null;
        this.dragStartRow = null;
        this.dragStartX = null;
        this.dragStartY = null;
        this.firstClickCol = null;
        this.firstClickRow = null;
        this.firstClickTime = null;
    }
}
