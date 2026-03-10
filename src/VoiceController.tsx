import React, { useState, useRef, useCallback, useEffect } from "react";

export type VoiceStatus = "idle" | "listening" | "processing" | "error";

interface VoiceControllerProps {
  onMove: (move: string | { from: string; to: string }) => void;
  onNewGame: () => void;
  onUndo: () => void;
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
};

const normalizeSquare = (input: string): string | null => {
  if (!input) return null;
  let cleaned = input.toLowerCase().trim();
  
  // Common misrecognitions by whisper
  const exactReplacements: Record<string, string> = {
    "before": "b4", "see4": "c4", "deep4": "d4", "ea": "e8", "hey1": "a1", "day4": "d4",
    "before1": "b1", "before2": "b2", "before3": "b3", "before4": "b4",
    "see1": "c1", "see2": "c2", "see3": "c3", "c for": "c4"
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
  const lowerTranscript = transcript.toLowerCase().trim();
  
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
      formData.append("prompt", "Chess moves: e4, e2 to e4, knight to f3, pawn takes d5, queen d4, bishop c4, rook e1, castle kingside, castle queenside, undo, new game."); 

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
    
    // Draw visualizer
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // draw a simple line when idle, else waveform
        const barWidth = (canvas.width / 32); 
        const step = Math.floor(dataArray.length / 32);
        
        for (let i = 0; i < 32; i++) {
          const val = dataArray[i * step] || 0;
          const height = Math.max(2, (val / 255) * canvas.height);
          ctx.fillStyle = status === "listening" ? "rgba(79, 70, 229, 0.8)" : "rgba(148, 163, 184, 0.2)";
          ctx.fillRect(i * barWidth + 1, (canvas.height - height) / 2, barWidth - 2, height);
        }
      }
    }

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const avgVolume = sum / dataArray.length;

    totalFramesRef.current++;

    if (avgVolume > 12) { // Speech detected threshold
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
        <canvas ref={canvasRef} width="120" height="40" className="voice-visualizer"></canvas>
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
