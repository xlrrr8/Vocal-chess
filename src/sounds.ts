// Sound effects using Web Audio API — no external files needed

let _audioCtx: AudioContext | null = null;
function getAudioCtx() {
    if (!_audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            _audioCtx = new AudioContextClass();
        }
    }
    return _audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.15) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
}

export function playMoveSound() {
    // A satisfying "click-snap" for a normal move
    playTone(800, 0.06, "square", 0.12);
    setTimeout(() => playTone(1200, 0.04, "sine", 0.08), 30);
}

export function playCaptureSound() {
    // A heavier "thud" for captures
    playTone(300, 0.12, "sawtooth", 0.15);
    setTimeout(() => playTone(150, 0.1, "square", 0.1), 40);
}

export function playCheckSound() {
    // An alarming double-beep for check
    playTone(900, 0.08, "square", 0.18);
    setTimeout(() => playTone(1100, 0.08, "square", 0.18), 120);
}

export function playGameOverSound() {
    // A dramatic descending tone
    playTone(800, 0.15, "sine", 0.2);
    setTimeout(() => playTone(600, 0.15, "sine", 0.18), 150);
    setTimeout(() => playTone(400, 0.2, "sine", 0.15), 300);
}

export function playIllegalMoveSound() {
    // A quick buzz for invalid moves
    playTone(200, 0.15, "sawtooth", 0.1);
}
