/**
 * ScoringSystem クラ
 * スコア計算ロジック
 */
class ScoringSystem {
    constructor() {
        this.baseScore = 10; // 1ピースあたりのスコア
        this.chainMultiplier = 1.5; // 連鎖時のスコア倍率
    }

    /**
     * 消去ピース数でスコアを計算
     */
    calculateScore(pieceCount, chainNumber = 1) {
        // 基本スコア = ピース数 × 基本スコア
        let score = pieceCount * this.baseScore;

        // 連鎖ボーナス
        if (chainNumber > 1) {
            score = Math.floor(score * Math.pow(this.chainMultiplier, chainNumber - 1));
        }

        return score;
    }

    /**
     * 複数の消去グループがある場合のスコア計算（同時消去ボーナス）
     */
    calculateMultiGroupScore(groupSizes) {
        let totalScore = 0;
        
        groupSizes.forEach((size, index) => {
            const groupScore = this.calculateScore(size);
            // 同時グループが多いほどボーナス
            const simultaneousBonus = 1 + (groupSizes.length - 1) * 0.1;
            totalScore += Math.floor(groupScore * simultaneousBonus);
        });

        return totalScore;
    }

    /**
     * 連鎖スコアを計算（落下後の新たなマッチ）
     */
    calculateChainScore(pieceCount, chainLevel) {
        return this.calculateScore(pieceCount, chainLevel);
    }
}
