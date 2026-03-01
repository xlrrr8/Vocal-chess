import React, { useEffect, useRef, useState } from "react";

export type VoiceStatus =
  | "idle"
  | "ready"
  | "listening"
  | "processing"
  | "error"
  | "unsupported";

interface VoiceControllerProps {
  onMove: (move: string | { from: string; to: string }) => void;
  onNewGame: () => void;
  onUndo: () => void;
  status: VoiceStatus;
  setStatus: (s: VoiceStatus) => void;
  setLastCommand: (cmd: string) => void;
}

const normalizeSquare = (input: string): string | null => {
  if (!input) return null;
  let cleaned = input.toLowerCase().trim().replace(/\s+/g, "");

  // Handle common misinterpretations
  const replacements: Record<string, string> = {
    "before": "b4", "see4": "c4", "deep4": "d4", "before1": "b1", "before2": "b2", "before3": "b3", "before4": "b4", "before5": "b5", "before6": "b6", "before7": "b7", "before8": "b8",
    "ea": "e8", "e8": "e8", "a1": "a1", "hey1": "a1", "day4": "d4", "see1": "c1", "see2": "c2", "see3": "c3"
  };

  if (replacements[cleaned]) cleaned = replacements[cleaned];

  if (/^[a-h][1-8]$/.test(cleaned)) return cleaned;

  const fileMap: Record<string, string> = {
    a: "a", hey: "a", ay: "a",
    b: "b", be: "b", bee: "b",
    c: "c", see: "c", sea: "c",
    d: "d", dee: "d", tea: "d",
    e: "e",
    f: "f", ef: "f",
    g: "g", gee: "g",
    h: "h", ache: "h",
  };

  const rankMap: Record<string, string> = {
    one: "1", won: "1", 1: "1",
    two: "2", to: "2", too: "2", 2: "2",
    three: "3", tree: "3", 3: "3",
    four: "4", for: "4", 4: "4",
    five: "5", 5: "5",
    six: "6", 6: "6",
    seven: "7", 7: "7",
    eight: "8", ate: "8", 8: "8",
  };

  // Try to find file and rank in the string
  let file: string | null = null;
  let rank: string | null = null;

  for (const [word, char] of Object.entries(fileMap)) {
    if (cleaned.includes(word)) {
      file = char;
      break;
    }
  }

  for (const [word, char] of Object.entries(rankMap)) {
    if (cleaned.includes(word)) {
      rank = char;
      break;
    }
  }

  if (file && rank) return `${file}${rank}`;

  // Fallback for direct matches like "e 4"
  const match = cleaned.match(/([a-h])\s*([1-8])/);
  if (match) return `${match[1]}${match[2]}`;

  return null;
};

const normalizeAlgebraic = (text: string): string | null => {
  let t = text.toLowerCase().trim();

  // Piece mapping
  const pieceMap: Record<string, string> = {
    knight: "N", night: "N", nite: "N",
    bishop: "B", shop: "B",
    rook: "R", rock: "R", broke: "R",
    queen: "Q",
    king: "K",
    pawn: "",
  };

  // Check for piece name
  for (const [word, char] of Object.entries(pieceMap)) {
    if (t.startsWith(word)) {
      t = char + t.slice(word.length).trim();
      break;
    }
  }

  // Common spoken patterns
  t = t.replace(/\s*takes\s*|\s*x\s*/g, "x");
  t = t.replace(/\s*to\s*/g, "");
  t = t.replace(/\s+/g, "");

  // Capitalize piece letter if present
  if (/^[nbqrk]/.test(t)) {
    t = t[0].toUpperCase() + t.slice(1);
  }

  // Strict SAN regexes
  // 1. Piece moves: Nf3, Nxe4, Rad1, R1e2, Qh4xf6
  if (/^[NBRQK][a-h]?[1-8]?x?[a-h][1-8]$/.test(t)) return t;
  // 2. Pawn moves: e4, d5, exd5, e8=Q
  if (/^[a-h]x?[a-h]?[1-8](=[NBRQ])?$/.test(t)) return t;
  // 3. Castling: O-O, O-O-O
  if (t === "o-o" || t === "0-0") return "O-O";
  if (t === "o-o-o" || t === "0-0-0") return "O-O-O";

  return null;
};

const parseVoiceCommand = (
  text: string
):
  | { type: "move"; from: string; to: string }
  | { type: "move"; san: string }
  | { type: "undo" | "newgame" | "castle"; side?: "kingside" | "queenside" }
  | null => {
  const t = text.trim();

  // 1. Strict Algebraic Notation (e.g. "Nf3", "e4", "Bxe5")
  const san = normalizeAlgebraic(t);
  if (san) return { type: "move", san };

  // 2. Strict From-To Square Notation (e.g. "e2 e4", "e2 to e4")
  const simpleMove = t.match(
    /\b([a-hA-H]\s*[1-8])\s*(?:to|two|too|\s)\s*([a-hA-H]\s*[1-8])\b/i
  );
  if (simpleMove) {
    const from = normalizeSquare(simpleMove[1]);
    const to = normalizeSquare(simpleMove[2]);
    if (from && to) return { type: "move", from, to };
  }

  // 3. UCI-style (e.g. "e2e4")
  const clean = t.toLowerCase().replace(/\s+/g, "");
  const uciMatch = clean.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
  if (uciMatch) {
    return { type: "move", from: uciMatch[1], to: uciMatch[2] };
  }

  // 4. Essential Game Commands (Keep these minimal for UX)
  if (/new\s*game|reset/i.test(t)) return { type: "newgame" };
  if (/undo|back/i.test(t)) return { type: "undo" };
  if (/castle\s*(?:king|queen|long)?/i.test(t)) {
    if (/queen|long/i.test(t)) return { type: "castle", side: "queenside" };
    return { type: "castle", side: "kingside" };
  }

  return null;
};

export const speak = (text: string) => {
  const utterance = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(utterance);
};

const VoiceVisualizer: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    const startVisualizer = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { noiseSuppression: true, echoCancellation: true },
        });
        streamRef.current = stream;

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;

        let animationId: number;
        const draw = () => {
          animationId = requestAnimationFrame(draw);
          analyser.getByteFrequencyData(dataArray);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const barWidth = (canvas.width / bufferLength) * 2;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            // Pulse color based on intensity
            const opacity = (dataArray[i] / 255) * 0.8 + 0.2;
            ctx.fillStyle = `rgba(79, 70, 229, ${opacity})`;

            // Draw rounded bars
            const r = 2;
            const y = canvas.height - barHeight;
            const w = barWidth - 2;
            const h = barHeight;
            if (h > 0) {
              ctx.beginPath();
              ctx.roundRect(x, y, w, h, [r, r, 0, 0]);
              ctx.fill();
            }
            x += barWidth;
          }
        };
        draw();
      } catch (err) {
        console.error("Visualizer error:", err);
      }
    };

    startVisualizer();

    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={30}
      style={{
        display: isActive ? "block" : "none",
        opacity: 0.8,
        imageRendering: "pixelated",
      }}
    />
  );
};

let hasSpokenWelcome = false;

const VoiceController: React.FC<VoiceControllerProps> = ({
  onMove,
  onNewGame,
  onUndo,
  status,
  setStatus,
  setLastCommand,
}) => {
  const recognitionRef = useRef<any>(null);
  const isListeningActive = useRef(false);
  const [isIsolationEnabled, setIsIsolationEnabled] = useState(true);

  useEffect(() => {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("unsupported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus("listening");
    };

    recognition.onend = () => {
      if (isListeningActive.current) {
        try {
          recognition.start();
        } catch (e) { }
      } else {
        setStatus("ready");
      }
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setLastCommand(transcript);

      const command = parseVoiceCommand(transcript);
      if (!command) {
        speak("Invalid format.");
        return;
      }

      if (command.type === "move") {
        if ("san" in command) {
          onMove(command.san);
          speak(`Move ${command.san} played.`);
        } else {
          onMove({ from: command.from, to: command.to });
          speak(`Move ${command.from} to ${command.to} played.`);
        }
      } else if (command.type === "castle") {
        const san = command.side === "kingside" ? "O-O" : "O-O-O";
        onMove(san);
        speak(`Castled ${command.side === "kingside" ? "kingside" : "queenside"}.`);
      } else if (command.type === "newgame") {
        onNewGame();
        speak("New game started.");
      } else if (command.type === "undo") {
        onUndo();
        speak("Move undone.");
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        setStatus("ready");
        return;
      }
      setStatus("error");
      speak("An error occurred.");
    };

    recognitionRef.current = recognition;
    setStatus("ready");
    if (!hasSpokenWelcome) {
      hasSpokenWelcome = true;
      speak("Welcome to vocal chess. Start by making your move.");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const handleToggle = () => {
    if (status === "unsupported") return;

    if (status === "listening") {
      isListeningActive.current = false;
      recognitionRef.current?.stop();
    } else {
      try {
        isListeningActive.current = true;
        recognitionRef.current?.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  let label = "Tap to speak";
  if (status === "listening") label = "Listening...";
  if (status === "processing") label = "Processing...";
  if (status === "error") label = "Error – retry";
  if (status === "unsupported") label = "Not supported";

  return (
    <div className="voice-controller-container">
      <div className="voice-controller">
        <button
          className={[
            "mic-button",
            status === "listening" ? "mic-button-active" : "",
            status === "unsupported" ? "mic-button-disabled" : "",
          ].join(" ")}
          onClick={handleToggle}
          disabled={status === "unsupported"}
        >
          <span className="mic-icon">
            {status === "listening" ? "🛑" : "🎙"}
          </span>
        </button>
        <div className="voice-status">
          <div className="status-top">
            <span className="status-dot" data-status={status} />
            <span className="status-label">{label}</span>
          </div>
          <VoiceVisualizer isActive={status === "listening" && isIsolationEnabled} />
        </div>
      </div>

      <div className="isolation-control">
        <div className="control-info">
          <span className="control-label">Voice Isolation</span>
          <span className="control-desc">Reduce background noise</span>
        </div>
        <button
          className={["toggle-switch", isIsolationEnabled ? "active" : ""].join(" ")}
          onClick={() => setIsIsolationEnabled(!isIsolationEnabled)}
        >
          <div className="switch-knob" />
        </button>
      </div>
    </div>
  );
};

export default VoiceController;
