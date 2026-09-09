/**
 * BerryFilm - Main Application Logic & User Interface Coordinator
 * Kết nối Camera, WebGL Shader Engine, Photobooth, Audio và Gallery
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Khởi tạo DOM Elements
    const glCanvas = document.getElementById('cameraCanvas');
    const videoElement = document.getElementById('cameraVideo');
    const shutterBtn = document.getElementById('shutterBtn');
    const flashOverlay = document.getElementById('flashOverlay');
    const presetList = document.getElementById('presetList');
    const flipCamBtn = document.getElementById('flipCamBtn');
    const ratioBtn = document.getElementById('ratioBtn');
    const openAdjustBtn = document.getElementById('openAdjustBtn');
    const adjustPanel = document.getElementById('adjustPanel');
    const closeAdjustBtn = document.getElementById('closeAdjustBtn');
    const photoboothBtn = document.getElementById('photoboothBtn');
    const photoboothModal = document.getElementById('photoboothModal');
    const closePbModalBtn = document.getElementById('closePbModalBtn');
    const startPbBtn = document.getElementById('startPbBtn');
    const pbCountdownEl = document.getElementById('pbCountdown');
    const galleryBtn = document.getElementById('galleryBtn');
    const galleryModal = document.getElementById('galleryModal');
    const closeGalleryBtn = document.getElementById('closeGalleryBtn');
    const galleryGrid = document.getElementById('galleryGrid');
    const fileUploadInput = document.getElementById('fileUploadInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const dateStampToggle = document.getElementById('dateStampToggle');
    const dateStampDisplay = document.getElementById('dateStampDisplay');
    const fpsBadge = document.getElementById('fpsBadge');
    const videoModeBtn = document.getElementById('videoModeBtn');
    const recTimerBadge = document.getElementById('recTimerBadge');

    // Preview Snapshot Modal Elements
    const previewModal = document.getElementById('previewModal');
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    const previewImage = document.getElementById('previewImage');
    const previewVideoEl = document.getElementById('previewVideoEl');
    const downloadPhotoBtn = document.getElementById('downloadPhotoBtn');
    const downloadPhotoBtnLabel = document.getElementById('downloadPhotoBtnLabel');

    // 2. Khởi tạo Core Engines
    const webglEngine = new WebGLEngine(glCanvas);
    const audioEngine = window.cameraAudio;
    let cameraController = null;
    let photoboothEngine = null;

    let isDateStampEnabled = true;
    let currentAspectRatio = '4:3'; // '4:3', '1:1', '9:16'
    let galleryItems = []; // Danh sách ảnh & video đã chụp
    let currentCapturedDataUrl = null;

    // --- State cho tính năng Quay Video ---
    let isVideoMode = false;      // false = chế độ Chụp ảnh, true = chế độ Quay video
    let isRecording = false;
    let mediaRecorder = null;
    let recordedChunks = [];
    let micStream = null;
    let recordStartTime = 0;
    let recordTimerInterval = null;
    let currentPreviewType = 'photo'; // 'photo' | 'video'
    let currentCapturedVideoUrl = null;

    // Cập nhật Date Stamp hiển thị trên Viewfinder
    function updateDateStampText() {
        const now = new Date();
        const year = "'" + String(now.getFullYear()).slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const str = `${year} ${month} ${day}`;
        if (dateStampDisplay) {
            dateStampDisplay.textContent = str;
        }
        return str;
    }
    updateDateStampText();

    // FPS Meter
    let lastTime = performance.now();
    let frameCount = 0;
    function updateFPS() {
        frameCount++;
        const now = performance.now();
        if (now - lastTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (now - lastTime));
            if (fpsBadge) fpsBadge.textContent = `${fps} FPS`;
            frameCount = 0;
            lastTime = now;
        }
    }

    // Callback render cho từng frame từ CameraController
    function onCameraFrame(frameSource, isVideo) {
        webglEngine.renderFrame(frameSource, isVideo);
        updateFPS();
    }

    cameraController = new CameraController(videoElement, onCameraFrame);
    photoboothEngine = new PhotoboothEngine(webglEngine, cameraController, audioEngine);

    // 3. Khởi động Camera ban đầu
    function resizeCanvasForAspect(aspect) {
        const container = glCanvas.parentElement;
        const width = container.clientWidth;
        let height = width * (4 / 3);

        if (aspect === '1:1') {
            height = width;
        } else if (aspect === '9:16') {
            height = width * (16 / 9);
        } else if (aspect === '4:3') {
            height = width * (4 / 3);
        }

        glCanvas.width = Math.min(1080, width * window.devicePixelRatio);
        glCanvas.height = Math.min(1920, height * window.devicePixelRatio);
        glCanvas.style.aspectRatio = aspect.replace(':', '/');
    }

    window.addEventListener('resize', () => resizeCanvasForAspect(currentAspectRatio));
    resizeCanvasForAspect(currentAspectRatio);
    await cameraController.startCamera();

    // 4. Render danh sách Presets BerryFilm
    function renderPresets() {
        presetList.innerHTML = '';
        const presets = window.lutGenerator.presets;

        Object.keys(presets).forEach(key => {
            const p = presets[key];
            const pill = document.createElement('button');
            pill.className = `preset-pill ${key === webglEngine.currentPresetId ? 'active' : ''}`;
            pill.dataset.preset = key;
            pill.innerHTML = `
                <div class="preset-color-dot" style="background: ${p.colorTag}"></div>
                <div class="preset-info">
                    <span class="preset-name">${p.name}</span>
                    <span class="preset-kr">${p.krName}</span>
                </div>
            `;

            pill.addEventListener('click', () => {
                document.querySelectorAll('.preset-pill').forEach(el => el.classList.remove('active'));
                pill.classList.add('active');
                webglEngine.setLutPreset(key);
                syncSlidersFromParams();
                audioEngine.triggerHaptic([20]);
            });

            presetList.appendChild(pill);
        });
    }
    renderPresets();

    // Đồng bộ giá trị Sliders trong Adjust Panel với parameters hiện tại
    function syncSlidersFromParams() {
        const p = webglEngine.params;
        setSliderVal('grainSlider', 'grainVal', p.grainIntensity, 100, '%');
        setSliderVal('bloomSlider', 'bloomVal', p.bloomIntensity, 100, '%');
        setSliderVal('vignetteSlider', 'vignetteVal', p.vignetteIntensity, 100, '%');
        setSliderVal('exposureSlider', 'exposureVal', p.exposure, 100, '');
        setSliderVal('warmthSlider', 'warmthVal', p.warmth, 100, '');
        setSliderVal('leakSlider', 'leakVal', p.lightLeakIntensity, 100, '%');

        const leakSelect = document.getElementById('leakTypeSelect');
        if (leakSelect) leakSelect.value = p.lightLeakType;
    }

    function setSliderVal(sliderId, textId, val, mult = 1, unit = '') {
        const slider = document.getElementById(sliderId);
        const text = document.getElementById(textId);
        if (slider) slider.value = val;
        if (text) text.textContent = Math.round(val * mult) + unit;
    }

    // 5. Lắng nghe sự kiện điều chỉnh Sliders
    function setupAdjustmentSliders() {
        bindSlider('grainSlider', 'grainVal', 100, '%', v => webglEngine.updateParams({ grainIntensity: parseFloat(v) }));
        bindSlider('bloomSlider', 'bloomVal', 100, '%', v => webglEngine.updateParams({ bloomIntensity: parseFloat(v) }));
        bindSlider('vignetteSlider', 'vignetteVal', 100, '%', v => webglEngine.updateParams({ vignetteIntensity: parseFloat(v) }));
        bindSlider('exposureSlider', 'exposureVal', 100, '', v => webglEngine.updateParams({ exposure: parseFloat(v) }));
        bindSlider('warmthSlider', 'warmthVal', 100, '', v => webglEngine.updateParams({ warmth: parseFloat(v) }));
        bindSlider('leakSlider', 'leakVal', 100, '%', v => webglEngine.updateParams({ lightLeakIntensity: parseFloat(v) }));

        const leakSelect = document.getElementById('leakTypeSelect');
        if (leakSelect) {
            leakSelect.addEventListener('change', (e) => {
                webglEngine.updateParams({ lightLeakType: parseInt(e.target.value) });
            });
        }
    }

    function bindSlider(sliderId, textId, mult, unit, callback) {
        const slider = document.getElementById(sliderId);
        const text = document.getElementById(textId);
        if (!slider) return;
        slider.addEventListener('input', (e) => {
            const val = e.target.value;
            if (text) text.textContent = Math.round(val * mult) + unit;
            callback(val);
        });
    }
    setupAdjustmentSliders();

    // 6. Xử lý Chụp ảnh đơn (Single Shot) hoặc Quay Video, tùy chế độ hiện tại
    shutterBtn.addEventListener('click', () => {
        if (isVideoMode) {
            toggleVideoRecording();
        } else {
            takeSinglePhoto();
        }
    });

    // 6b. Chuyển đổi chế độ Ảnh <-> Video
    videoModeBtn.addEventListener('click', () => {
        if (isRecording) return; // Không cho đổi chế độ giữa lúc đang quay
        isVideoMode = !isVideoMode;
        videoModeBtn.classList.toggle('active', isVideoMode);
        shutterBtn.classList.toggle('video-armed', isVideoMode);
        shutterBtn.title = isVideoMode ? 'Bấm để bắt đầu quay video' : 'Chụp ảnh';
        audioEngine.triggerHaptic([20]);
    });

    // Danh sách các nút cần khóa lại trong lúc đang quay video, tránh bấm nhầm làm hỏng bản ghi
    function getLockableControls() {
        return [galleryBtn, photoboothBtn, openAdjustBtn, ratioBtn, flipCamBtn, uploadBtn, dateStampToggle, videoModeBtn];
    }

    function setRecordingControlsLocked(locked) {
        getLockableControls().forEach(btn => {
            if (!btn) return;
            btn.classList.toggle('controls-locked', locked);
        });
    }

    function formatRecTime(totalSeconds) {
        const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const s = String(totalSeconds % 60).padStart(2, '0');
        return `${m}:${s}`;
    }

    async function toggleVideoRecording() {
        if (!isRecording) {
            await startVideoRecording();
        } else {
            stopVideoRecording();
        }
    }

    async function startVideoRecording() {
        // Cố gắng lấy âm thanh Micro; nếu bị từ chối vẫn quay video không tiếng
        micStream = null;
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            console.warn('Không lấy được microphone, sẽ quay video không có tiếng:', err.message);
        }

        // Lấy luồng hình ảnh trực tiếp từ Canvas WebGL (đã áp dụng đầy đủ filter/preset)
        const canvasStream = glCanvas.captureStream(30);
        const tracks = [...canvasStream.getVideoTracks()];
        if (micStream) tracks.push(...micStream.getAudioTracks());
        const mixedStream = new MediaStream(tracks);

        // Chọn định dạng video được trình duyệt/WebView hỗ trợ
        const mimeCandidates = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
        ];
        const supportedMime = mimeCandidates.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';

        try {
            mediaRecorder = supportedMime
                ? new MediaRecorder(mixedStream, { mimeType: supportedMime, videoBitsPerSecond: 5000000 })
                : new MediaRecorder(mixedStream);
        } catch (err) {
            console.error('Thiết bị không hỗ trợ quay video (MediaRecorder):', err.message);
            alert('Rất tiếc, thiết bị này không hỗ trợ tính năng quay video.');
            if (micStream) micStream.getTracks().forEach(t => t.stop());
            return;
        }

        recordedChunks = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) recordedChunks.push(e.data);
        };
        mediaRecorder.onstop = finalizeVideoRecording;

        mediaRecorder.start(250); // Thu thập dữ liệu mỗi 250ms để tránh mất dữ liệu nếu app bị gián đoạn
        isRecording = true;
        recordStartTime = Date.now();

        // Cập nhật giao diện: nút Shutter đổi màu đỏ nhấp nháy, khóa các nút khác
        shutterBtn.classList.add('recording');
        recTimerBadge.classList.add('active');
        recTimerBadge.textContent = '● 00:00';
        setRecordingControlsLocked(true);
        audioEngine.triggerHaptic([30]);

        recordTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
            recTimerBadge.textContent = `● ${formatRecTime(elapsed)}`;
        }, 500);
    }

    function stopVideoRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        if (micStream) {
            micStream.getTracks().forEach(t => t.stop());
            micStream = null;
        }

        isRecording = false;
        clearInterval(recordTimerInterval);
        recordTimerInterval = null;

        shutterBtn.classList.remove('recording');
        recTimerBadge.classList.remove('active');
        setRecordingControlsLocked(false);
    }

    function finalizeVideoRecording() {
        const mimeType = (mediaRecorder && mediaRecorder.mimeType) || 'video/webm';
        const blob = new Blob(recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const durationSec = Math.max(1, Math.round((Date.now() - recordStartTime) / 1000));

        // Lưu vào Gallery
        galleryItems.unshift({
            id: Date.now(),
            type: 'video',
            url: url,
            blob: blob,
            preset: webglEngine.currentPresetId,
            duration: durationSec,
            date: new Date().toLocaleTimeString()
        });

        // Hiển thị preview video vừa quay
        openVideoPreview(url);

        // Âm thanh xác nhận đã lưu
        audioEngine.playFilmWind();
    }

    function openVideoPreview(url) {
        currentPreviewType = 'video';
        currentCapturedVideoUrl = url;
        previewImage.style.display = 'none';
        previewVideoEl.style.display = 'block';
        previewVideoEl.src = url;
        previewVideoEl.currentTime = 0;
        if (downloadPhotoBtnLabel) downloadPhotoBtnLabel.textContent = '💾 Tải video về máy';
        previewModal.classList.add('open');
    }

    function openPhotoPreview(dataUrl) {
        currentPreviewType = 'photo';
        currentCapturedDataUrl = dataUrl;
        previewVideoEl.pause();
        previewVideoEl.removeAttribute('src');
        previewVideoEl.style.display = 'none';
        previewImage.style.display = 'block';
        previewImage.src = dataUrl;
        if (downloadPhotoBtnLabel) downloadPhotoBtnLabel.textContent = '💾 Lưu ảnh độ phân giải cao';
        previewModal.classList.add('open');
    }

    function triggerFlash() {
        flashOverlay.classList.remove('active');
        void flashOverlay.offsetWidth; // Force reflow
        flashOverlay.classList.add('active');
        setTimeout(() => flashOverlay.classList.remove('active'), 350);
    }

    function takeSinglePhoto() {
        // Âm thanh + Haptic + Flash
        audioEngine.playShutter();
        triggerFlash();

        // Tạo ảnh với Date Stamp
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = glCanvas.width;
        outputCanvas.height = glCanvas.height;
        const ctx = outputCanvas.getContext('2d');

        // Vẽ WebGL render
        ctx.drawImage(glCanvas, 0, 0);

        // Vẽ Date Stamp màu cam neon góc phải dưới
        if (isDateStampEnabled) {
            const dateText = updateDateStampText();
            const fontSize = Math.max(22, Math.round(outputCanvas.width * 0.038));
            ctx.save();
            ctx.font = `bold ${fontSize}px "Courier New", monospace`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';

            // Glow cam retro
            ctx.shadowColor = 'rgba(255, 120, 40, 0.85)';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#ff7b25';

            const paddingX = Math.round(outputCanvas.width * 0.05);
            const paddingY = Math.round(outputCanvas.height * 0.04);
            ctx.fillText(dateText, outputCanvas.width - paddingX, outputCanvas.height - paddingY);
            ctx.restore();
        }

        const dataUrl = outputCanvas.toDataURL('image/jpeg', 0.95);

        // Lưu vào Gallery
        galleryItems.unshift({
            id: Date.now(),
            type: 'photo',
            dataUrl: dataUrl,
            preset: webglEngine.currentPresetId,
            date: new Date().toLocaleTimeString()
        });

        // Hiển thị preview modal
        openPhotoPreview(dataUrl);

        // Âm thanh lên phim
        setTimeout(() => audioEngine.playFilmWind(), 400);
    }

    // 7. Chuyển đổi Tỉ lệ khung hình (4:3 -> 1:1 -> 9:16)
    ratioBtn.addEventListener('click', () => {
        if (currentAspectRatio === '4:3') currentAspectRatio = '1:1';
        else if (currentAspectRatio === '1:1') currentAspectRatio = '9:16';
        else currentAspectRatio = '4:3';

        ratioBtn.querySelector('.btn-label').textContent = currentAspectRatio;
        resizeCanvasForAspect(currentAspectRatio);
        audioEngine.triggerHaptic([20]);
    });

    // 8. Chuyển đổi Camera Trước/Sau
    flipCamBtn.addEventListener('click', async () => {
        audioEngine.triggerHaptic([25]);
        flipCamBtn.classList.add('rotating');
        webglEngine.params.flipX = !webglEngine.params.flipX;
        await cameraController.toggleCameraFacing();
        setTimeout(() => flipCamBtn.classList.remove('rotating'), 500);
    });

    // 9. Bật/Tắt Date Stamp
    dateStampToggle.addEventListener('click', () => {
        isDateStampEnabled = !isDateStampEnabled;
        dateStampToggle.classList.toggle('active', isDateStampEnabled);
        if (dateStampDisplay) {
            dateStampDisplay.style.opacity = isDateStampEnabled ? '1' : '0';
        }
        audioEngine.triggerHaptic([15]);
    });

    // 10. Tải ảnh từ thư viện (Photo Editor / Darkroom)
    uploadBtn.addEventListener('click', () => fileUploadInput.click());
    fileUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                await cameraController.loadCustomImage(evt.target.result);
                audioEngine.playFilmWind();
            };
            reader.readAsDataURL(file);
        }
    });

    // 11. Modal Adjust Panel Controls
    openAdjustBtn.addEventListener('click', () => {
        syncSlidersFromParams();
        adjustPanel.classList.add('open');
    });
    closeAdjustBtn.addEventListener('click', () => adjustPanel.classList.remove('open'));

    // 12. Photobooth (Life4Cuts 인생네컷) Logic
    const pbStripPreview = document.getElementById('pbStripPreview');
    const pbThemeSelect = document.getElementById('pbThemeSelect');
    const pbLayoutSelect = document.getElementById('pbLayoutSelect');
    const pbTitleInput = document.getElementById('pbTitleInput');
    const pbStickerSelect = document.getElementById('pbStickerSelect');
    const downloadPbBtn = document.getElementById('downloadPbBtn');

    photoboothBtn.addEventListener('click', () => {
        photoboothModal.classList.add('open');
        renderPhotoboothStrip();
    });
    closePbModalBtn.addEventListener('click', () => photoboothModal.classList.remove('open'));

    startPbBtn.addEventListener('click', async () => {
        startPbBtn.disabled = true;
        pbCountdownEl.classList.add('active');

        await photoboothEngine.start4ShotSequence(
            (shotNum, count) => {
                if (count > 0) {
                    pbCountdownEl.textContent = `${count}`;
                } else {
                    pbCountdownEl.textContent = `📸 #${shotNum}`;
                    triggerFlash();
                }
            },
            (shotNum, shotCanvas) => {
                renderPhotoboothStrip();
            },
            (allShots) => {
                pbCountdownEl.classList.remove('active');
                startPbBtn.disabled = false;
                renderPhotoboothStrip();
            }
        );
    });

    function renderPhotoboothStrip() {
        const frameCanvas = photoboothEngine.composeFrame(900);
        pbStripPreview.src = frameCanvas.toDataURL('image/jpeg', 0.95);
    }

    pbThemeSelect.addEventListener('change', (e) => {
        photoboothEngine.currentTheme = e.target.value;
        renderPhotoboothStrip();
    });

    pbLayoutSelect.addEventListener('change', (e) => {
        photoboothEngine.layout = e.target.value;
        renderPhotoboothStrip();
    });

    pbTitleInput.addEventListener('input', (e) => {
        photoboothEngine.customTitle = e.target.value || '인생네컷';
        renderPhotoboothStrip();
    });

    pbStickerSelect.addEventListener('change', (e) => {
        photoboothEngine.selectedSticker = e.target.value;
        renderPhotoboothStrip();
    });

    downloadPbBtn.addEventListener('click', () => {
        const highResCanvas = photoboothEngine.composeFrame(1200);
        const link = document.createElement('a');
        link.download = `BerryFilm_Life4Cuts_${Date.now()}.jpg`;
        link.href = highResCanvas.toDataURL('image/jpeg', 0.98);
        link.click();
    });

    // 13. Preview Modal Controls (dùng chung cho cả Ảnh và Video)
    closePreviewBtn.addEventListener('click', () => {
        previewModal.classList.remove('open');
        previewVideoEl.pause();
    });

    downloadPhotoBtn.addEventListener('click', () => {
        if (currentPreviewType === 'video' && currentCapturedVideoUrl) {
            const link = document.createElement('a');
            link.download = `BerryFilm_Video_${Date.now()}.webm`;
            link.href = currentCapturedVideoUrl;
            link.click();
        } else if (currentCapturedDataUrl) {
            const link = document.createElement('a');
            link.download = `BerryFilm_${webglEngine.currentPresetId}_${Date.now()}.jpg`;
            link.href = currentCapturedDataUrl;
            link.click();
        }
    });

    // 14. Gallery Drawer Controls
    galleryBtn.addEventListener('click', () => {
        renderGallery();
        galleryModal.classList.add('open');
    });
    closeGalleryBtn.addEventListener('click', () => galleryModal.classList.remove('open'));

    function renderGallery() {
        galleryGrid.innerHTML = '';
        if (galleryItems.length === 0) {
            galleryGrid.innerHTML = `
                <div class="empty-gallery">
                    <p>Chưa có ảnh nào được chụp.</p>
                    <span>Hãy bấm nút chụp để lưu giữ khoảnh khắc phong cách BerryFilm!</span>
                </div>
            `;
            return;
        }

        galleryItems.forEach(item => {
            const card = document.createElement('div');
            const isVideo = item.type === 'video';
            card.className = `gallery-card${isVideo ? ' is-video' : ''}`;

            const mediaTag = isVideo
                ? `<video src="${item.url}" muted playsinline preload="metadata"></video>`
                : `<img src="${item.dataUrl}" alt="BerryFilm Snapshot" />`;

            const infoLabel = isVideo
                ? `🎥 ${formatRecTime(item.duration)}`
                : item.preset.toUpperCase();

            card.innerHTML = `
                ${mediaTag}
                <div class="gallery-card-info">
                    <span>${infoLabel}</span>
                    <button class="download-mini-btn" title="Tải xuống">💾</button>
                </div>
            `;

            card.querySelector('img, video').addEventListener('click', () => {
                if (isVideo) {
                    openVideoPreview(item.url);
                } else {
                    openPhotoPreview(item.dataUrl);
                }
            });

            card.querySelector('.download-mini-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const link = document.createElement('a');
                if (isVideo) {
                    link.download = `BerryFilm_Video_${item.id}.webm`;
                    link.href = item.url;
                } else {
                    link.download = `BerryFilm_${item.preset}_${item.id}.jpg`;
                    link.href = item.dataUrl;
                }
                link.click();
            });

            galleryGrid.appendChild(card);
        });
    }
});
