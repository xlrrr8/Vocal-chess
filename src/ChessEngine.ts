import { Chess } from "chess.js";

// Piece values for evaluation
const PIECE_VALUES: Record<string, number> = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000,
};

// Piece-square tables for positional evaluation
const PAWN_TABLE = [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
];

const KNIGHT_TABLE = [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
];

const BISHOP_TABLE = [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
];

function getPST(type: string): number[] {
    switch (type) {
        case "p": return PAWN_TABLE;
        case "n": return KNIGHT_TABLE;
        case "b": return BISHOP_TABLE;
        default: return new Array(64).fill(0);
    }
}

function squareToIndex(sq: string): number {
    const file = sq.charCodeAt(0) - 97; // a=0
    const rank = parseInt(sq[1]) - 1;   // 1=0
    return (7 - rank) * 8 + file;
}

export function evaluate(game: Chess): number {
    let score = 0;
    const board = game.board();

    for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
            const piece = board[r][f];
            if (!piece) continue;

            const val = PIECE_VALUES[piece.type] || 0;
            const pst = getPST(piece.type);
            const idx = piece.color === "w" ? r * 8 + f : (7 - r) * 8 + f;
            const positional = pst[idx] || 0;

            if (piece.color === "w") {
                score += val + positional;
            } else {
                score -= val + positional;
            }
        }
    }

    return score;
}

function minimax(
    game: Chess,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean
): number {
    if (depth === 0 || game.isGameOver()) {
        return evaluate(game);
    }

    const moves = game.moves();

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            game.move(move);
            const val = minimax(game, depth - 1, alpha, beta, false);
            game.undo();
            maxEval = Math.max(maxEval, val);
            alpha = Math.max(alpha, val);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            game.move(move);
            const val = minimax(game, depth - 1, alpha, beta, true);
            game.undo();
            minEval = Math.min(minEval, val);
            beta = Math.min(beta, val);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

export function findBestMove(fen: string): string | null {
    const game = new Chess(fen);
    const moves = game.moves({ verbose: true });

    if (moves.length === 0) return null;

    const isWhite = game.turn() === "w";
    let bestMove = moves[0];
    let bestScore = isWhite ? -Infinity : Infinity;

    // Use depth 3 for fast response
    const depth = 3;

    for (const move of moves) {
        game.move(move.san);
        const score = minimax(game, depth - 1, -Infinity, Infinity, !isWhite);
        game.undo();

        if (isWhite) {
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        } else {
            if (score < bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
    }

    return bestMove.from + bestMove.to;
}
