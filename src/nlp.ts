import { Chess, Move } from 'chess.js';

export type VoiceAction = "global_command" | "move" | "ambiguous" | "error";

export interface NLPResult {
  rawTranscript: string;
  normalizedCommand: string;
  action: VoiceAction;
  interpretationFeedback: string;
  globalCommand?: "newgame" | "undo" | "history";
  parsedMove?: Move;
  ambiguousMoves?: Move[];
  errorReason?: string;
  parsedStr: string;
}

const VOICE_COMMANDS: Record<string, "newgame" | "undo" | "history"> = {
  "new game": "newgame",
  "new": "newgame",
  "start": "newgame",
  "undo": "undo",
  "take back": "undo",
  "back": "undo",
  "history": "history",
  "last moves": "history",
  "read moves": "history",
  "what happened": "history",
};

export const normalizeTranscript = (input: string): string => {
  let cleaned = input.toLowerCase().trim();

  // Common replacements for Whisper API
  const exactReplacements: Record<string, string> = {
    "before": "b4", "c for": "c4",
    "before1": "b1", "before2": "b2", "before3": "b3", "before4": "b4", "before5": "b5", "before6": "b6", "before7": "b7", "before8": "b8",
    "see1": "c1", "see2": "c2", "see3": "c3", "see4": "c4", "see5": "c5", "see6": "c6", "see7": "c7", "see8": "c8",
    "deep1": "d1", "deep2": "d2", "deep3": "d3", "deep4": "d4", "deep5": "d5", "deep6": "d6", "deep7": "d7", "deep8": "d8",
    "day1": "d1", "day2": "d2", "day3": "d3", "day4": "d4", "day5": "d5", "day6": "d6", "day7": "d7", "day8": "d8",
    "ea1": "e1", "ea2": "e2", "ea3": "e3", "ea4": "e4", "ea5": "e5", "ea6": "e6", "ea7": "e7", "ea8": "e8",
    "hey1": "a1", "hey2": "a2", "hey3": "a3", "hey4": "a4", "hey5": "a5", "hey6": "a6", "hey7": "a7", "hey8": "a8",
  };
  if (exactReplacements[cleaned]) cleaned = exactReplacements[cleaned];

  cleaned = cleaned.replace(/\b(see|sea)\b/g, "c")
                   .replace(/\b(bee|be)\b/g, "b")
                   .replace(/\b(ay)\b/g, "a")
                   .replace(/\b(dee|tea|day)\b/g, "d")
                   .replace(/\b(ee)\b/g, "e")
                   .replace(/\b(ef)\b/g, "f")
                   .replace(/\b(gee)\b/g, "g")
                   .replace(/\b(ache|each|age)\b/g, "h")
                   .replace(/\b(won|one)\b/g, "1")
                   .replace(/\b(to|too|two|2)\b/g, "2")
                   .replace(/\b(tree|three)\b/g, "3")
                   .replace(/\b(for|four)\b/g, "4")
                   .replace(/\b(ate|eight)\b/g, "8");

  cleaned = cleaned
    .replace(/\b(night|nite|light|right|knights|knife)\b/g, "knight")
    .replace(/\b(bish|shop|vishop|fish up|bishops)\b/g, "bishop")
    .replace(/\b(rock|look|book|hook|root|rooks|brook|crook|room|rug)\b/g, "rook")
    .replace(/\b(wean|green|quin|twin|screen|queens|clean|cream|win|quinn)\b/g, "queen")
    .replace(/\b(ping|ring|thing|kin|kings|bring|sing|kink)\b/g, "king")
    .replace(/\b(pon|pan|spawn|porn|prom|palm|pawns|pond|bond|pound)\b/g, "pawn");

  return cleaned;
};

export const parseVoiceToMove = (rawTranscript: string, game: Chess): NLPResult => {
  const norm = normalizeTranscript(rawTranscript);

  // 1. Check Global Commands
  for (const [cmd, action] of Object.entries(VOICE_COMMANDS)) {
    if (rawTranscript.toLowerCase().includes(cmd)) {
      return {
        rawTranscript,
        normalizedCommand: norm,
        action: "global_command",
        globalCommand: action,
        interpretationFeedback: `Interpreted "${cmd}" as global command: ${action}.`,
        parsedStr: `global: ${action}`
      };
    }
  }

  // conversational phrases removal to help matching length
  const simplifiedNorm = norm.replace(/\b(move the|move|go on|go|from|play|i want to|can you|please|on)\b/g, " ").replace(/\s+/g, " ").trim();

  // 2. Identify legal moves aliases
  const validMoves = game.moves({ verbose: true });
  const pieceNames: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

  const matches: { move: Move; matchLength: number; alias: string }[] = [];

  for (const vm of validMoves) {
    const pieceName = pieceNames[vm.piece];
    const aliases: string[] = [];

    // Conversational & standard logic
    aliases.push(`${pieceName} ${vm.to}`);
    aliases.push(`${pieceName} to ${vm.to}`);
    aliases.push(`${vm.piece.toUpperCase()}${vm.to}`);
    aliases.push(vm.san.toLowerCase());
    aliases.push(`${vm.from} to ${vm.to}`);
    aliases.push(`${vm.from} ${vm.to}`);

    // Additional variations: "move the knight on g1 to f3" -> "knight g1 to f3"
    aliases.push(`${pieceName} ${vm.from} to ${vm.to}`);
    aliases.push(`${pieceName} ${vm.from} ${vm.to}`);

    if (vm.captured) {
      const capPiece = pieceNames[vm.captured];
      aliases.push(`${pieceName} takes ${vm.to}`);
      aliases.push(`${pieceName} captures ${vm.to}`);
      aliases.push(`${pieceName} takes ${capPiece}`);
      aliases.push(`${pieceName} takes ${capPiece} on ${vm.to}`);
      aliases.push(`take ${vm.to}`);
      aliases.push(`take on ${vm.to}`);
      aliases.push(`take ${capPiece}`);
      aliases.push(`captures ${vm.to}`);
      if (vm.piece === "p") {
        aliases.push(`pawn takes ${vm.to}`);
        aliases.push(`${vm.from[0]} takes ${vm.to}`);
        aliases.push(`${vm.from[0]} takes ${capPiece}`);
      }
    }

    if (vm.promotion) {
      const promPiece = pieceNames[vm.promotion];
      aliases.push(`${pieceName} ${vm.to} promote to ${promPiece}`);
      aliases.push(`${vm.to} promote to ${promPiece}`);
      aliases.push(`promote to ${promPiece}`);
      aliases.push(`promote ${promPiece}`);
      aliases.push(`${vm.from} ${vm.to} promote to ${promPiece}`);
    }

    if (vm.san === "O-O") {
      aliases.push("castle kingside", "short castle", "castles kingside", "castle short");
    } else if (vm.san === "O-O-O") {
      aliases.push("castle queenside", "long castle", "castles queenside", "castle long");
    }

    // Direct squares match like "e2 e4", handled by exact matching lengths mostly
    aliases.push(`${vm.from}${vm.to}`); // e2e4

    for (const a of aliases) {
      const cleanA = a.toLowerCase().replace(/[-_+#x=]/g, " ").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
      if (!cleanA) continue;

      // check if it matches in the simplified text
      const isMatch = new RegExp(`\\b${cleanA}\\b`).test(simplifiedNorm) || cleanA === simplifiedNorm;
      
      if (isMatch) {
         matches.push({ move: vm, matchLength: cleanA.length, alias: cleanA });
      }
    }
  }

  if (matches.length > 0) {
     const maxLen = Math.max(...matches.map(m => m.matchLength));
     const bestMatches = matches.filter(m => m.matchLength === maxLen);

     // deduplicate completely matching SANs
     const uniqueMovesMap = new Map<string, Move>();
     bestMatches.forEach(bm => uniqueMovesMap.set(bm.move.san, bm.move));
     const uniqueMoves = Array.from(uniqueMovesMap.values());

     if (uniqueMoves.length === 1) {
         const m = uniqueMoves[0];
         return {
             rawTranscript,
             normalizedCommand: norm,
             action: "move",
             parsedMove: m,
             interpretationFeedback: `Interpreted "${bestMatches[0].alias}" as ${pieceNames[m.piece]} to ${m.to} (${m.san}).`,
             parsedStr: `${m.from} \u2192 ${m.to}`
         };
     } else if (uniqueMoves.length > 1) {
         return {
            rawTranscript,
            normalizedCommand: norm,
            action: "ambiguous",
            ambiguousMoves: uniqueMoves,
            interpretationFeedback: `Detected ambiguity. Multiple pieces can move there. Did you mean ${uniqueMoves.map(m => m.san).join(" or ")}?`,
            parsedStr: `Ambiguous (${uniqueMoves.length} options)`
         };
     }
  }

  // 3. Fallback direct parsing for exactly two squares
  const squaresPattern = /\b([a-h][1-8])\s*([a-h][1-8])\b/;
  const sqMatch = simplifiedNorm.match(squaresPattern);
  if (sqMatch) {
      const fromSq = sqMatch[1] as import("chess.js").Square;
      const toSq = sqMatch[2] as import("chess.js").Square;
      try {
          const testGame = new Chess(game.fen());
          const maybePromoList = ["q", "r", "n", "b"]; // try promotion if applicable
          let pMove = null;
          for (let p of maybePromoList) {
             try {
                pMove = testGame.move({from: fromSq, to: toSq, promotion: p});
                if (pMove) break;
             } catch(ee) {}
          }
          if (pMove) {
              return {
                  rawTranscript,
                  normalizedCommand: norm,
                  action: "move",
                  parsedMove: pMove,
                  interpretationFeedback: `Interpreted squares: ${fromSq} to ${toSq}.`,
                  parsedStr: `${fromSq} \u2192 ${toSq}`
              };
          }
      } catch(e) {}
  }
  
  // 4. Intelligent Error Analysis
  const piecesMentioned = simplifiedNorm.match(/\b(pawn|knight|bishop|rook|queen|king)\b/gi);
  const squaresMentioned = norm.match(/\b([a-h][1-8])\b/gi);

  let errorReason = "I couldn't find a valid piece or target square in your command.";
  
  if (squaresMentioned && squaresMentioned.length === 2) {
       const fromSq = squaresMentioned[0];
       const toSq = squaresMentioned[1];
       const startPiece = game.get(fromSq as any);
       if (!startPiece) {
           errorReason = `Invalid: No piece at starting square ${fromSq}.`;
       } else if (startPiece.color !== game.turn()) {
           errorReason = `Invalid: Piece at ${fromSq} isn't yours to move!`;
       } else {
           errorReason = `Invalid: You cannot legally move the piece from ${fromSq} to ${toSq}.`;
           if (game.isCheck()) {
               errorReason = `Invalid: Your King is in check! The move from ${fromSq} to ${toSq} does not prevent checkmate.`;
           }
       }
  } else if (squaresMentioned && squaresMentioned.length === 1 && piecesMentioned) {
       const sq = squaresMentioned[0];
       const piece = piecesMentioned[0];
       errorReason = `Invalid: The ${piece} cannot move to ${sq}.`;
       
       const targetPiece = game.get(sq as any);
       if (targetPiece && targetPiece.color === game.turn()) {
           errorReason = `Invalid: ${sq} is already occupied by your piece.`;
       }
       if (game.isCheck()) {
           errorReason = `Invalid: Your king is in check. You must resolve the check!`;
       }
  } else if (rawTranscript.trim().length > 0) {
      errorReason = `Unrecognized command. Please provide a clear chess move.`;
  }

  return {
     rawTranscript,
     normalizedCommand: norm,
     action: "error",
     errorReason,
     interpretationFeedback: errorReason,
     parsedStr: "Failed to parse"
  };
};
