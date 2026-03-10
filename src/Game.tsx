import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Chess } from "chess.js";
import ChessBoard from "./ChessBoard";
import { findBestMove, evaluate } from "./ChessEngine";
import { playMoveSound, playCaptureSound, playCheckSound, playGameOverSound, playIllegalMoveSound } from "./sounds";


const initialGame = new Chess();

export type MoveRecord = {
  san: string;
  moveNumber: number;
};

export type AnalysisData = {
  whiteAccuracy: number;
  blackAccuracy: number;
  whiteBlunders: number;
  blackBlunders: number;
  whiteMistakes: number;
  blackMistakes: number;
  evalHistory: number[];
};

const App: React.FC = () => {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const movesEndRef = useRef<HTMLDivElement>(null);

  const [isAiMode, setIsAiMode] = useState<boolean>(false);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [lastMoveSquares, setLastMoveSquares] = useState<{ from: string; to: string } | null>(null);
  const [animatingSquare, setAnimatingSquare] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  useEffect(() => {
    const list = movesEndRef.current?.closest('.moves-list');
    if (list) {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    }
  }, [moves]);

  // Trigger AI move when it's black's turn
  useEffect(() => {
    const game = gameRef.current;
    if (isAiMode && !game.isGameOver() && game.turn() === "b" && !isAiThinking) {
      setIsAiThinking(true);
      // Small delay so the UI shows "AI Thinking..." before blocking
      setTimeout(() => {
        try {
          const bestMove = findBestMove(game.fen());
          if (bestMove) {
            const from = bestMove.substring(0, 2);
            const to = bestMove.substring(2, 4);
            const move = game.move({ from, to, promotion: "q" });
            if (move) {
              safeUpdateGame(from, to);
            }
          }
        } catch (e) {
          console.error("AI error:", e);
        }
        setIsAiThinking(false);
      }, 100);
    }
  }, [fen, isAiMode]);

  const playSoundForMove = (game: InstanceType<typeof Chess>) => {
    if (game.isGameOver()) {
      playGameOverSound();
    } else if (game.isCheck()) {
      playCheckSound();
    } else {
      // check last move for capture
      const hist = game.history({ verbose: true });
      const last = hist[hist.length - 1];
      if (last?.captured) {
        playCaptureSound();
      } else {
        playMoveSound();
      }
    }
  };

  const safeUpdateGame = (from?: string, to?: string) => {
    const game = gameRef.current;
    setFen(game.fen());
    const history = game.history({ verbose: true });
    const formatted: MoveRecord[] = history.map((m, i) => ({
      san: m.san,
      moveNumber: Math.floor(i / 2) + 1,
    }));
    setMoves(formatted);

    // Track move for highlights and animation
    if (from && to) {
      setLastMoveSquares({ from, to });
      setAnimatingSquare(to);
      setTimeout(() => setAnimatingSquare(null), 300);
    }

    playSoundForMove(game);
  };

  const handleSquareClick = (from: string, to: string) => {
    try {
      const move = gameRef.current.move({ from, to, promotion: "q" });
      if (move) {
        safeUpdateGame(from, to);
      } else {
        playIllegalMoveSound();
      }
    } catch (e) {
      playIllegalMoveSound();
    }
  };

  const runAnalysis = () => {
    setIsAnalyzing(true);
    const history = gameRef.current.history({ verbose: true });
    const tempGame = new Chess();
    const evals: number[] = [0]; // Starting eval

    let wBlunders = 0, bBlunders = 0;
    let wMistakes = 0, bMistakes = 0;
    let wAccuracySum = 0, bAccuracySum = 0;

    // Small delay to allow UI to show "Analyzing..."
    setTimeout(() => {
      history.forEach((move, i) => {
        const prevEval = evaluate(tempGame);
        tempGame.move(move);
        const currentEval = evaluate(tempGame);
        evals.push(currentEval);

        const diff = Math.abs(currentEval - prevEval);
        const isWhite = i % 2 === 0;

        // Simple heuristic for analysis
        if (diff > 300) {
          isWhite ? wBlunders++ : bBlunders++;
        } else if (diff > 150) {
          isWhite ? wMistakes++ : bMistakes++;
        }

        // Fake accuracy based on eval stability
        const moveAccuracy = Math.max(0, 100 - (diff / 10));
        if (isWhite) wAccuracySum += moveAccuracy;
        else bAccuracySum += moveAccuracy;
      });

      const whiteMoves = Math.ceil(history.length / 2);
      const blackMoves = Math.floor(history.length / 2);

      setAnalysis({
        whiteAccuracy: whiteMoves ? Math.round(wAccuracySum / whiteMoves) : 100,
        blackAccuracy: blackMoves ? Math.round(bAccuracySum / blackMoves) : 100,
        whiteBlunders: wBlunders,
        blackBlunders: bBlunders,
        whiteMistakes: wMistakes,
        blackMistakes: bMistakes,
        evalHistory: evals
      });
      setIsAnalyzing(false);
    }, 500);
  };



  const handleNewGame = () => {
    setIsAiThinking(false);
    setAnalysis(null);
    setShowModal(true);
    gameRef.current = new Chess();
    safeUpdateGame();
  };

  const handleUndo = () => {
    setIsAiThinking(false);
    gameRef.current.undo();
    safeUpdateGame();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const game = gameRef.current;
  const isGameOver = game.isGameOver();
  let gameStatus = "";
  let winner = "";

  if (game.isCheckmate()) {
    const winnerColor = game.turn() === "w" ? "Black" : "White";
    gameStatus = `Checkmate — ${winnerColor} wins`;
    winner = winnerColor;
  } else if (game.isDraw()) {
    gameStatus = "Draw";
  } else if (game.isStalemate()) {
    gameStatus = "Stalemate";
  } else if (game.isCheck()) {
    gameStatus = `${game.turn() === "w" ? "White" : "Black"} is in check`;
  } else {
    gameStatus = `${game.turn() === "w" ? "White" : "Black"} to move`;
  }

  return (
    <div className="app-root">
      {isGameOver && showModal && (
        <div className="game-over-overlay">
          <div className="game-over-modal">
            <h2>Game Over</h2>
            <p className="result-text">{gameStatus}</p>
            {winner && <p className="winner-text">Winner: {winner}</p>}

            {!analysis && !isAnalyzing && (
              <button className="ghost-btn" style={{ margin: '15px 0' }} onClick={runAnalysis}>
                🔍 Analyze Game
              </button>
            )}

            {isAnalyzing && <p className="analyzing-text">Analyzing moves...</p>}

            {analysis && (
              <div className="analysis-summary">
                <div className="analysis-row">
                  <div className="accuracy-box white">
                    <span className="accuracy-val">{analysis.whiteAccuracy}%</span>
                    <span className="accuracy-label">White Accuracy</span>
                  </div>
                  <div className="accuracy-box black">
                    <span className="accuracy-val">{analysis.blackAccuracy}%</span>
                    <span className="accuracy-label">Black Accuracy</span>
                  </div>
                </div>
                <div className="stats-grid">
                  <div className="stat-item blunder">
                    <span>{analysis.whiteBlunders} / {analysis.blackBlunders}</span>
                    <label>Blunders</label>
                  </div>
                  <div className="stat-item mistake">
                    <span>{analysis.whiteMistakes} / {analysis.blackMistakes}</span>
                    <label>Mistakes</label>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="primary-btn" onClick={handleNewGame}>
                New Game
              </button>
              <button className="ghost-btn" onClick={() => setShowModal(false)} style={{ width: '100%', justifyContent: 'center' }}>
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="app-shell">
        <header className="app-header">
          <div>
            <h1 className="app-title">Vocal chess</h1>
            <p className="app-subtitle">Play chess. Make your moves.</p>
          </div>
          <div className="header-actions">
            <Link to="/" className="ghost-btn back-btn">
              <span className="back-arrow">←</span>
              Back to Home
            </Link>
            <button className="ghost-btn" onClick={handleNewGame}>
              New Game
            </button>
            <button className="ghost-btn" onClick={handleUndo} disabled={!moves.length || isGameOver}>
              Undo
            </button>
            <button className="ghost-btn" onClick={toggleFullscreen}>
              ⛶ Fullscreen
            </button>
            <button
              className={["ghost-btn", isAiMode ? "active-toggle" : ""].join(" ")}
              onClick={() => {
                setIsAiMode(!isAiMode);
              }}
              style={{
                background: isAiMode ? "var(--accent)" : "transparent",
                borderColor: isAiMode ? "var(--accent)" : "rgba(148, 163, 184, 0.4)"
              }}
            >
              {isAiMode ? "🤖 Computer: ON" : "🤖 Play Computer"}
            </button>
          </div>
        </header>

        <main className="app-main">
          <section className="board-section">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Board</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {isAiThinking && <span className="badge" style={{ background: 'var(--accent)', animation: 'pulse 1s infinite' }}>AI Thinking...</span>}
                  <span className="badge">{gameStatus}</span>
                </div>
              </div>
              <ChessBoard fen={fen} onMove={handleSquareClick} lastMoveSquares={lastMoveSquares} animatingSquare={animatingSquare} />
            </div>


          </section>

          <section className="side-section">
            <div className="card moves-card">
              <div className="card-header">
                <span className="card-title">Moves</span>
              </div>
              <div className="history-tags">
                <div />
                <div className="history-tag history-tag-white">White</div>
                <div className="history-tag history-tag-black">Black</div>
              </div>
              <div className="moves-list">
                {moves.length === 0 && (
                  <p className="empty-state">No moves yet. Start the game!</p>
                )}
                {moves.length > 0 && (
                  <ol>
                    {(() => {
                      const rows: JSX.Element[] = [];
                      for (let i = 0; i < moves.length; i += 2) {
                        rows.push(
                          <li key={i} className="moves-row">
                            <span className="move-number">
                              {moves[i].moveNumber}.
                            </span>
                            <span className="move-san">
                              {moves[i]?.san || ""}
                            </span>
                            <span className="move-san">
                              {moves[i + 1]?.san || ""}
                            </span>
                          </li>
                        );
                      }
                      return rows;
                    })()}
                    <div ref={movesEndRef} />
                  </ol>
                )}
              </div>
            </div>
          </section>
        </main>

        <footer className="app-footer">
          <span>Built for chess in a dark, minimal UI.</span>
        </footer>
      </div>
    </div>
  );
};

export default App;
