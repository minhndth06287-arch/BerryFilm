/**
 * BerryFilm - Camera Stream Controller & Fallback Media Simulator
 * Quản lý MediaDevices, chuyển camera trước/sau, lấy nét và giả lập webcam
 */

class CameraController {
    constructor(videoElement, onFrameCallback) {
        this.video = videoElement;
        this.onFrameCallback = onFrameCallback;
        this.stream = null;
        this.currentFacingMode = 'user'; // 'user' hoặc 'environment'
        this.aspectRatio = '4:3'; // '4:3', '1:1', '9:16', '3:2'
        this.isSimulated = false;
        this.simulatedCanvas = null;
        this.simulatedCtx = null;
        this.simulatedImg = null;
        this.animFrameId = null;
        this.isRunning = false;
        this.flashEnabled = false;

        this._initSimulatedMedia();
    }

    _initSimulatedMedia() {
        this.simulatedCanvas = document.createElement('canvas');
        this.simulatedCanvas.width = 1280;
        this.simulatedCanvas.height = 960;
        this.simulatedCtx = this.simulatedCanvas.getContext('2d');
        this._drawSampleScene(0);
    }

    _drawSampleScene(time) {
        const ctx = this.simulatedCtx;
        const w = this.simulatedCanvas.width;
        const h = this.simulatedCanvas.height;

        // Gradient nền studio ấm phong cách Hàn Quốc
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#ffeef2');
        grad.addColorStop(0.5, '#fde2e4');
        grad.addColorStop(1, '#dfe7fd');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Vẽ ánh sáng mềm mộng mơ di chuyển nhẹ
        const lightX = w * 0.5 + Math.sin(time * 0.001) * 100;
        const lightY = h * 0.4 + Math.cos(time * 0.0012) * 60;
        const radial = ctx.createRadialGradient(lightX, lightY, 50, lightX, lightY, 400);
        radial.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        radial.addColorStop(1, 'rgba(255, 220, 230, 0)');
        ctx.fillStyle = radial;
        ctx.fillRect(0, 0, w, h);

        // Vẽ mẫu chân dung phong cách Retro Y2K
        ctx.save();
        ctx.translate(w * 0.5, h * 0.52);

        // Body/Áo pastel
        ctx.fillStyle = '#bde0fe';
        ctx.beginPath();
        ctx.ellipse(0, 260, 220, 160, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cổ
        ctx.fillStyle = '#ffdfba';
        ctx.fillRect(-35, 90, 70, 80);

        // Tóc phía sau
        ctx.fillStyle = '#2b2d42';
        ctx.beginPath();
        ctx.ellipse(0, 40, 140, 170, 0, 0, Math.PI * 2);
        ctx.fill();

        // Khuôn mặt
        ctx.fillStyle = '#ffe5d9';
        ctx.beginPath();
        ctx.ellipse(0, 40, 95, 120, 0, 0, Math.PI * 2);
        ctx.fill();

        // Má hồng Berry Pink
        ctx.fillStyle = 'rgba(255, 154, 162, 0.45)';
        ctx.beginPath();
        ctx.ellipse(-45, 60, 25, 16, 0, 0, Math.PI * 2);
        ctx.ellipse(45, 60, 25, 16, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mắt nhắm dễ thương / Digicam mood
        ctx.strokeStyle = '#3d405b';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(-35, 30, 16, 0.1 * Math.PI, 0.9 * Math.PI, false);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(35, 30, 16, 0.1 * Math.PI, 0.9 * Math.PI, false);
        ctx.stroke();

        // Nụ cười
        ctx.beginPath();
        ctx.arc(0, 80, 22, 0.1 * Math.PI, 0.9 * Math.PI, false);
        ctx.stroke();

        // Môi hồng berry
        ctx.fillStyle = 'rgba(235, 87, 87, 0.6)';
        ctx.beginPath();
        ctx.ellipse(0, 95, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mái tóc trước & kẹp tóc Y2K
        ctx.fillStyle = '#2b2d42';
        ctx.beginPath();
        ctx.ellipse(0, -50, 105, 55, 0, 0, Math.PI * 2);
        ctx.fill();

        // Kẹp tóc dâu tây 🍓
        ctx.font = '36px sans-serif';
        ctx.fillText('🍓', 40, -40);

        ctx.restore();

        // Badge góc mẫu thử
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.roundRect(30, 30, 240, 44, 12);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px monospace';
        ctx.fillText('● SAMPLE MODE (DEMO)', 48, 58);
    }

    async startCamera() {
        this.stop();

        const constraints = {
            audio: false,
            video: {
                facingMode: this.currentFacingMode,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        };

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia not supported');
            }
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            await this.video.play();
            this.isSimulated = false;
        } catch (err) {
            console.warn('Camera access error, fallback to Simulation Mode:', err.message);
            this.isSimulated = true;
        }

        this.isRunning = true;
        this._startRenderLoop();
        return !this.isSimulated;
    }

    toggleCameraFacing() {
        this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
        return this.startCamera();
    }

    _startRenderLoop() {
        const loop = (timestamp) => {
            if (!this.isRunning) return;

            if (this.isSimulated) {
                this._drawSampleScene(timestamp);
                if (this.onFrameCallback) {
                    this.onFrameCallback(this.simulatedCanvas, false);
                }
            } else if (this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
                if (this.onFrameCallback) {
                    this.onFrameCallback(this.video, true);
                }
            }

            this.animFrameId = requestAnimationFrame(loop);
        };
        this.animFrameId = requestAnimationFrame(loop);
    }

    stop() {
        this.isRunning = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    /**
     * Tải ảnh tùy chỉnh từ người dùng thay cho video feed
     */
    loadCustomImage(imageSrc) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.simulatedCanvas.width = img.naturalWidth || 1280;
                this.simulatedCanvas.height = img.naturalHeight || 960;
                this.simulatedCtx.drawImage(img, 0, 0);
                this.isSimulated = true;
                if (!this.isRunning) {
                    this.isRunning = true;
                    this._startRenderLoop();
                }
                resolve(img);
            };
            img.src = imageSrc;
        });
    }

    getCurrentFrameSource() {
        if (this.isSimulated) {
            return this.simulatedCanvas;
        }
        return this.video;
    }
}

window.CameraController = CameraController;
