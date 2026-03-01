import React, { useMemo, useState } from "react";
import { Chess } from "chess.js";

interface ChessBoardProps {
  fen: string;
  onMove: (from: string, to: string) => void;
  lastMoveSquares?: { from: string; to: string } | null;
  animatingSquare?: string | null;
}

type Square = {
  file: string;
  rank: number;
  coord: string;
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

const ChessBoard: React.FC<ChessBoardProps> = ({ fen, onMove, lastMoveSquares, animatingSquare }) => {
  const [selected, setSelected] = useState<string | null>(null);

  const pieceMap = useMemo(() => {
    const chess = new Chess(fen);
    const map: Record<string, string> = {};
    for (let file of FILES) {
      for (let rank of RANKS) {
        const sq = `${file}${rank}`;
        const piece = chess.get(sq as any);
        if (piece) {
          map[sq] = (piece.color === "w" ? piece.type.toUpperCase() : piece.type.toLowerCase());
        }
      }
    }
    return map;
  }, [fen]);

  const squares: Square[] = [];
  for (const rank of RANKS) {
    for (const file of FILES) {
      squares.push({ file, rank, coord: `${file}${rank}` });
    }
  }

  const handleSquareClick = (coord: string) => {
    if (!selected) {
      setSelected(coord);
      return;
    }
    if (selected === coord) {
      setSelected(null);
      return;
    }
    onMove(selected, coord);
    setSelected(null);
  };

  const handleDragStart = (e: React.DragEvent, coord: string) => {
    e.dataTransfer.setData("from", coord);
    setSelected(coord);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, to: string) => {
    e.preventDefault();
    const from = e.dataTransfer.getData("from");
    if (from && from !== to) {
      onMove(from, to);
    }
    setSelected(null);
  };

  const renderPiece = (symbol: string, coord: string, isAnimating: boolean = false) => {
    const isWhite = symbol === symbol.toUpperCase();
    const type = symbol.toLowerCase();

    const classes = [
      "piece",
      isWhite ? "piece-white" : "piece-black",
      `piece-${type}`,
      isAnimating ? "piece-pop" : "",
    ].join(" ");

    const unicodeMap: Record<string, string> = {
      p: isWhite ? "♙" : "♟",
      r: isWhite ? "♖" : "♜",
      n: isWhite ? "♘" : "♞",
      b: isWhite ? "♗" : "♝",
      q: isWhite ? "♕" : "♛",
      k: isWhite ? "♔" : "♚",
    };

    return (
      <span
        draggable
        onDragStart={(e) => handleDragStart(e, coord)}
        className={classes}
      >
        {unicodeMap[type]}
      </span>
    );
  };

  return (
    <div className="board-wrapper">
      <div className="board-grid-container">
        {/* The grid is 9 columns x 9 rows: 
            Column 1: Rank labels
            Columns 2-9: Squares
            Rows 1-8: Squares/Ranks
            Row 9: File labels
        */}

        {/* 8 rows of (Rank Label + 8 Squares) */}
        {RANKS.map((rank) => (
          <React.Fragment key={rank}>
            <div className="coord-rank">{rank}</div>
            {FILES.map((file) => {
              const coord = `${file}${rank}`;
              const isDark = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 1;
              const piece = pieceMap[coord];
              const isSelected = selected === coord;
              const isLastMoveFrom = lastMoveSquares?.from === coord;
              const isLastMoveTo = lastMoveSquares?.to === coord;
              const isAnimating = animatingSquare === coord;
              return (
                <div
                  key={coord}
                  className="square-container"
                >
                  <button
                    aria-label={coord}
                    className={[
                      "square",
                      isDark ? "square-dark" : "square-light",
                      isSelected ? "square-selected" : "",
                      (isLastMoveFrom || isLastMoveTo) ? "square-last-move" : "",
                    ].join(" ")}
                    onClick={() => handleSquareClick(coord)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, coord)}
                  >
                    {piece && renderPiece(piece, coord, isAnimating)}
                  </button>
                </div>
              );
            })}
          </React.Fragment>
        ))}

        {/* Row 9: Bottom File Labels (plus an empty corner at Column 1) */}
        <div className="coord-corner" />
        {FILES.map((f) => (
          <div key={`bot-${f}`} className="coord-file">{f}</div>
        ))}
      </div>
    </div>
  );
};

export default ChessBoard;
