import React, { useState, useRef, useCallback, useEffect } from "react";

export type VoiceStatus = "idle" | "listening" | "processing" | "error";

interface VoiceControllerProps {
  onMove: (move: string | { from: string; to: string }) => void;
  onNewGame: () => void;
  onUndo: () => void;
  onReadHistory?: () => void;
  status: VoiceStatus;
  setStatus: (s: VoiceStatus) => void;
  setLastCommand: (cmd: string) => void;
}

const VOICE_COMMANDS: Record<string, string> = {
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

const normalizeSquare = (input: string): string | null => {
  if (!input) return null;
  let cleaned = input.toLowerCase().trim();
  
  // Common misrecognitions by whisper
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
                   .replace(/\b(to|too|two)\b/g, "2")
                   .replace(/\b(tree|three)\b/g, "3")
                   .replace(/\b(for|four)\b/g, "4")
                   .replace(/\b(ate|eight)\b/g, "8");

  cleaned = cleaned.replace(/\s+/g, "");

  if (/^[a-h][1-8]$/.test(cleaned)) return cleaned;
  return null;
};

const parseVoiceCommand = (transcript: string): string | { from: string; to: string } | null => {
  let lowerTranscript = transcript.toLowerCase().trim();
  
  // Normalize piece terms for accuracy
  lowerTranscript = lowerTranscript
    .replace(/\b(night|nite|light|right|knights|knife)\b/g, "knight")
    .replace(/\b(bish|shop|vishop|fish up|bishops)\b/g, "bishop")
    .replace(/\b(rock|look|book|hook|root|rooks|brook|crook|room|rug)\b/g, "rook")
    .replace(/\b(wean|green|quin|twin|screen|queens|clean|cream|win|quinn)\b/g, "queen")
    .replace(/\b(ping|ring|thing|kin|kings|bring|sing|kink)\b/g, "king")
    .replace(/\b(pon|pan|spawn|porn|prom|palm|pawns|pond|bond|pound)\b/g, "pawn");

  // Check for global commands
  for (const [command, action] of Object.entries(VOICE_COMMANDS)) {
    if (lowerTranscript.includes(command)) return action;
  }
  
  let cleaned = lowerTranscript
    .replace(/\b(pawn|knight|bishop|rook|queen|king|to|move|go|from)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
    
  // Match "e2 to e4" or "e2 2 e4"
  const toPattern = /(\w\d)\s*(?:to|2)\s*(\w\d)/i;
  const match = cleaned.match(toPattern);
  if (match) {
    const from = normalizeSquare(match[1]);
    const to = normalizeSquare(match[2]);
    if (from && to) return { from, to };
  }
  
  // Match just 2 squares said together "e2 e4"
  const squares = cleaned.match(/(\w\d)/g);
  if (squares && squares.length >= 2) {
    const from = normalizeSquare(squares[0]);
    const to = normalizeSquare(squares[1]);
    if (from && to) return { from, to };
  }
  
  // Match algebraic standard SAN: "Nf3"
  if (/^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8][+#]?$/i.test(cleaned.replace(/\s/g, ""))) {
    return cleaned.replace(/\s/g, "");
  }
  
  // Return the original lowercase transcript for Game.tsx to parse naturally
  return lowerTranscript;
};

const VoiceController: React.FC<VoiceControllerProps> = ({
  onMove,
  onNewGame,
  onUndo,
  onReadHistory,
  status,
  setStatus,
  setLastCommand,
}) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY || "";
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // VAD Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const silenceCounterRef = useRef<number>(0);
  const totalFramesRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resetVADState = () => {
    isSpeakingRef.current = false;
    silenceCounterRef.current = 0;
    totalFramesRef.current = 0;
    audioChunksRef.current = [];
  };

  const stopAll = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      // Prevent it from sending by clearing the onstop
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setStatus("idle");
  }, [setStatus]);

  useEffect(() => {
    return () => stopAll(); // Cleanup on unmount
  }, [stopAll]);

  const startListening = useCallback(async () => {
    if (!apiKey) {
      alert("Please add VITE_GROQ_API_KEY to your .env file!");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.minDecibels = -70; // Adjust sensitivity
      source.connect(analyser);
      analyserRef.current = analyser;

      startRecordingChunk(stream);
      setStatus("listening");
      monitorAudio();
      
    } catch (err) {
      console.error("Error accessing mic:", err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [apiKey]);

  const startRecordingChunk = (stream: MediaStream) => {
    resetVADState();
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      if (!streamRef.current) return;

      // If we stopped but user wasn't really speaking, just restart immediately
      if (!isSpeakingRef.current) {
        startRecordingChunk(stream);
        monitorAudio();
        return;
      }

      setStatus("processing");
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("response_format", "json");
      formData.append("language", "en");
      formData.append("prompt", "Chess moves: e4, e2 to e4, knight to f3, pawn takes d5, queen d4, bishop c4, rook e1, castle kingside, castle queenside, O-O, O-O-O, check, checkmate, en passant, promote to queen, resign, draw, a1, b2, c3, d4, e5, f6, g7, h8, captures, undo, new game, history, last moves, what happened."); 

      try {
        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}` },
          body: formData,
        });

        if (!res.ok) throw new Error("Groq API Error");

        const data = await res.json();
        const transcript = data.text.trim();
        if (transcript) setLastCommand(transcript);

        const command = parseVoiceCommand(transcript);
        if (command) {
          if (typeof command === "string") {
            if (command === "newgame") onNewGame();
            else if (command === "undo") onUndo();
            else if (command === "history" && onReadHistory) onReadHistory();
            else onMove(command);
          } else {
            onMove(command);
          }
        }

        if (!streamRef.current) return;
        // Keep listening naturally after processing a move
        setStatus("listening");
        startRecordingChunk(streamRef.current);
        monitorAudio();
      } catch (error) {
        console.error(error);
        if (!streamRef.current) return;
        setStatus("error");
        setLastCommand("Error connecting to Groq!");
        setTimeout(() => {
            if (!streamRef.current) return;
            setStatus("listening");
            startRecordingChunk(streamRef.current);
            monitorAudio();
        }, 3000);
      }
    };

    mediaRecorder.start();
  };

  const monitorAudio = () => {
    if (!analyserRef.current) return;
    
    // Check volume roughly 60 times a second
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const avgVolume = sum / dataArray.length;
    const isSpike = avgVolume > 12;

    // Draw visualizer
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const numBars = 32;
        const barWidth = canvas.width / numBars;
        const step = Math.floor(dataArray.length / numBars);
        
        for (let i = 0; i < numBars; i++) {
          const val = dataArray[i * step] || 0;
          
          let height = 2;
          if (status === "listening") {
            const normalized = Math.pow(val / 255, 1.2); // Emphasize spikes
            height = Math.max(2, normalized * canvas.height * 0.9);
          }
          
          const x = i * barWidth + (barWidth * 0.15);
          const y = (canvas.height - height) / 2;
          const w = barWidth * 0.7;

          // Color logic: if idle it's gray. If listening, standard is indigo, spike adds a bright green pop
          if (status !== "listening") {
             ctx.fillStyle = "rgba(148, 163, 184, 0.2)";
             ctx.shadowBlur = 0;
          } else if (isSpike && val > 120) {
             ctx.fillStyle = "rgba(52, 211, 153, 1)"; // Bright emerald
             ctx.shadowColor = "rgba(16, 185, 129, 0.6)";
             ctx.shadowBlur = 8;
          } else {
             ctx.fillStyle = "rgba(99, 102, 241, 0.8)"; // Indigo
             ctx.shadowColor = "rgba(79, 70, 229, 0.4)";
             ctx.shadowBlur = 4;
          }

          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, y, w, height, w / 2);
          } else {
            ctx.rect(x, y, w, height);
          }
          ctx.fill();
        }
        ctx.shadowBlur = 0; // Reset shadow
      }
    }

    totalFramesRef.current++;

    if (isSpike) { // Speech detected threshold
      isSpeakingRef.current = true;
      silenceCounterRef.current = 0;
    } else {
      silenceCounterRef.current++;
    }

    // SCENARIO 1: User spoke, and is now silent for ~1 second (60 frames)
    if (isSpeakingRef.current && silenceCounterRef.current > 75) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop(); // This triggers API call and restart inside onstop
        return; // Pause monitoring until processing is done
      }
    }
    
    // SCENARIO 2: Total silence for 5 seconds (300 frames), silently restart to prevent huge RAM usage
    if (!isSpeakingRef.current && totalFramesRef.current > 300) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop(); // will instantly restart because isSpeaking is false
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(monitorAudio);
  };

  const toggleRecording = () => {
    if (status === "idle" || status === "error") {
      startListening();
    } else {
      stopAll();
    }
  };

  return (
    <div className="voice-controller-container">
      <div className="mic-container">
        <canvas ref={canvasRef} width="160" height="48" className="voice-visualizer"></canvas>
        <button
          className={`mic-button ${status === "listening" ? "mic-button-active" : ""}`}
          onClick={toggleRecording}
          title="Toggle Voice Target"
        >
          {status === "idle" && (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
          )}
          {status === "listening" && (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
          )}
          {status === "processing" && "⏳"}
          {status === "error" && "⚠️"}
        </button>
      </div>

      <div className="voice-status">
        {status === "idle" && "Click mic for Hands-Free"}
        {status === "listening" && "Listening... speak move"}
        {status === "processing" && "Processing..."}
        {status === "error" && "API Error"}
      </div>

      {!apiKey && (
        <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="api-warning">
          Get Free Groq API Key
        </a>
      )}
    </div>
  );
};

export const speak = (text: string) => {
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    // Remove "piece" identifiers to sound cleaner
    utterance.text = text.replace(/N/, "Knight ").replace(/B/, "Bishop ").replace(/R/, "Rook ").replace(/Q/, "Queen ").replace(/K/, "King ").replace(/x/, "takes ");
    utterance.rate = 1.0;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }
};

export default VoiceController;
