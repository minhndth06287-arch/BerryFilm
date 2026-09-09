/**
 * BerryFilm - Web Audio API Sound Synthesizer & Haptic Feedback Engine
 * Tạo âm thanh máy ảnh cơ, màn trập, lên phim và rung chân thực không cần file ngoài
 */

class CameraAudioEngine {
    constructor() {
        this.audioCtx = null;
        this.isMuted = false;
    }

    _initContext() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    triggerHaptic(pattern = [35, 30, 20]) {
        if (navigator.vibrate) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                // Ignore vibration errors on unsupported devices
            }
        }
    }

    /**
     * Âm thanh màn trập cơ học (Mechanical Shutter Click + Spring release)
     */
    playShutter() {
        if (this.isMuted) return;
        this._initContext();
        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        // 1. First Click: Blade Opening
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(1400, now);
        osc1.frequency.exponentialRampToValueAtTime(120, now + 0.04);
        gain1.gain.setValueAtTime(0.7, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.05);

        // 2. Metallic Snap Noise (Filtered White Noise)
        const bufferSize = ctx.sampleRate * 0.08;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2200, now);
        filter.Q.setValueAtTime(3.0, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.9, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);

        // 3. Second Click: Blade Closing & Spring Echo (sau 60ms)
        const closeTime = now + 0.06;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(800, closeTime);
        osc2.frequency.exponentialRampToValueAtTime(80, closeTime + 0.05);
        gain2.gain.setValueAtTime(0.5, closeTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, closeTime + 0.06);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(closeTime);
        osc2.stop(closeTime + 0.07);

        this.triggerHaptic([40, 25, 30]);
    }

    /**
     * Âm thanh cần gạt lên phim (Vintage Film Winding Ratchet)
     */
    playFilmWind() {
        if (this.isMuted) return;
        this._initContext();
        const ctx = this.audioCtx;
        const startTime = ctx.currentTime + 0.08;

        // 4 nấc bánh răng lên phim
        for (let i = 0; i < 5; i++) {
            const clickTime = startTime + i * 0.06;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600 + i * 80, clickTime);
            osc.frequency.exponentialRampToValueAtTime(200, clickTime + 0.025);
            gain.gain.setValueAtTime(0.25, clickTime);
            gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.025);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(clickTime);
            osc.stop(clickTime + 0.03);
        }
    }

    /**
     * Âm thanh đếm ngược Photobooth (Beep)
     */
    playBeep(isFinal = false) {
        if (this.isMuted) return;
        this._initContext();
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        const freq = isFinal ? 1760 : 880; // A6 for final, A5 for countdown
        const duration = isFinal ? 0.15 : 0.08;

        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);

        this.triggerHaptic(isFinal ? [60] : [25]);
    }

    /**
     * Âm thanh Flash nạp điện
     */
    playFlashCharge() {
        if (this.isMuted) return;
        this._initContext();
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(3200, now + 0.6);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.65);
    }
}

window.cameraAudio = new CameraAudioEngine();
