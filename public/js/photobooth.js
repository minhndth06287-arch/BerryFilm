/**
 * BerryFilm - Life4Cuts (인생네컷) Photobooth & Frame Strip Composer Engine
 * Chụp 4 ảnh tự động, ghép dải photobooth pastel Hàn Quốc, sticker và xuất ảnh sắc nét
 */

class PhotoboothEngine {
    constructor(webglEngine, cameraController, audioEngine) {
        this.webgl = webglEngine;
        this.camera = cameraController;
        this.audio = audioEngine;

        this.shots = []; // Danh sách 4 ảnh canvas/dataURL
        this.isShooting = false;
        this.currentShotIndex = 0;

        this.frameThemes = {
            peach_berry: { name: 'Peach Berry', bg: '#ffd1dc', border: '#ffb3c1', text: '#592938', sub: '#8c485c' },
            mint_cloud: { name: 'Mint Cloud', bg: '#d8f3dc', border: '#b7e4c7', text: '#1b4332', sub: '#40916c' },
            lavender_mist: { name: 'Lavender Mist', bg: '#e2d9f3', border: '#cbb2fe', text: '#3c2a63', sub: '#684d9f' },
            butter_vanilla: { name: 'Butter Vanilla', bg: '#fefae0', border: '#faedcd', text: '#5c4d28', sub: '#9c824a' },
            matte_charcoal: { name: 'Matte Charcoal', bg: '#1e2022', border: '#2d3033', text: '#f0f0f0', sub: '#a0a5aa' },
            pure_white: { name: 'Pure White', bg: '#ffffff', border: '#eef0f2', text: '#1e293b', sub: '#64748b' }
        };

        this.currentTheme = 'peach_berry';
        this.layout = 'strip_4'; // 'strip_4' hoặc 'grid_2x2'
        this.customTitle = '인생네컷';
        this.customSubtitle = 'BERRYFILM STUDIO';
        this.enableDateStamp = true;
        this.selectedSticker = '🍓';
    }

    /**
     * Bắt đầu chuỗi chụp 4 ảnh Life4Cuts với đếm ngược 3-2-1
     */
    async start4ShotSequence(onCountdown, onShotTaken, onComplete) {
        if (this.isShooting) return;
        this.isShooting = true;
        this.shots = [];

        for (let i = 0; i < 4; i++) {
            this.currentShotIndex = i;

            // Đếm ngược 3 giây cho mỗi shot
            for (let c = 3; c >= 1; c--) {
                if (onCountdown) onCountdown(i + 1, c);
                this.audio.playBeep(false);
                await this._sleep(1000);
            }

            // Beep cuối + Flash + Chụp
            if (onCountdown) onCountdown(i + 1, 0);
            this.audio.playBeep(true);
            this.audio.playShutter();

            // Chụp frame từ WebGL canvas hiện tại
            const shotCanvas = document.createElement('canvas');
            shotCanvas.width = this.webgl.canvas.width;
            shotCanvas.height = this.webgl.canvas.height;
            const ctx = shotCanvas.getContext('2d');
            ctx.drawImage(this.webgl.canvas, 0, 0);

            this.shots.push(shotCanvas);
            if (onShotTaken) onShotTaken(i + 1, shotCanvas);

            // Nghỉ 1.2s trước shot kế tiếp (kèm âm thanh lên phim)
            if (i < 3) {
                this.audio.playFilmWind();
                await this._sleep(1200);
            }
        }

        this.isShooting = false;
        if (onComplete) onComplete(this.shots);
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Ghép 4 ảnh thành Dải Photobooth / Khung ảnh hoàn chỉnh
     */
    composeFrame(targetWidth = 1200) {
        const theme = this.frameThemes[this.currentTheme] || this.frameThemes.peach_berry;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (this.layout === 'strip_4') {
            // Dải dọc 4 ảnh kiểu Life4Cuts (Tỉ lệ ~ 1:3.2, chuẩn 1200 x 3800)
            const margin = 50;
            const photoGap = 35;
            const photoWidth = targetWidth - margin * 2;
            const photoHeight = Math.round(photoWidth * 0.72); // Tỉ lệ 4:3 ngang
            const footerHeight = 360;

            const totalHeight = margin * 2 + photoHeight * 4 + photoGap * 3 + footerHeight;
            canvas.width = targetWidth;
            canvas.height = totalHeight;

            // Nền Pastel
            ctx.fillStyle = theme.bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Vẽ 4 ảnh
            for (let i = 0; i < 4; i++) {
                const y = margin + i * (photoHeight + photoGap);
                
                // Viền trắng/pastel nhẹ quanh ảnh
                ctx.fillStyle = theme.border;
                ctx.fillRect(margin - 4, y - 4, photoWidth + 8, photoHeight + 8);

                if (this.shots[i]) {
                    ctx.drawImage(this.shots[i], margin, y, photoWidth, photoHeight);
                } else {
                    // Placeholder nếu chưa chụp đủ
                    ctx.fillStyle = '#f3f4f6';
                    ctx.fillRect(margin, y, photoWidth, photoHeight);
                    ctx.fillStyle = '#9ca3af';
                    ctx.font = 'bold 32px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(`Shot #${i + 1}`, canvas.width / 2, y + photoHeight / 2);
                }
            }

            // Vẽ Footer & Chữ Hàn Quốc / Sticker
            this._drawFooter(ctx, canvas.width, totalHeight, margin, footerHeight, theme);

        } else {
            // Khung vuông 2x2 Grid (1200 x 1480)
            const margin = 45;
            const photoGap = 30;
            const photoWidth = Math.round((targetWidth - margin * 2 - photoGap) / 2);
            const photoHeight = Math.round(photoWidth * 0.78);
            const footerHeight = 260;

            const totalHeight = margin * 2 + photoHeight * 2 + photoGap + footerHeight;
            canvas.width = targetWidth;
            canvas.height = totalHeight;

            // Nền Pastel
            ctx.fillStyle = theme.bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Vẽ 4 ảnh dạng 2x2
            for (let i = 0; i < 4; i++) {
                const col = i % 2;
                const row = Math.floor(i / 2);
                const x = margin + col * (photoWidth + photoGap);
                const y = margin + row * (photoHeight + photoGap);

                ctx.fillStyle = theme.border;
                ctx.fillRect(x - 4, y - 4, photoWidth + 8, photoHeight + 8);

                if (this.shots[i]) {
                    ctx.drawImage(this.shots[i], x, y, photoWidth, photoHeight);
                } else {
                    ctx.fillStyle = '#f3f4f6';
                    ctx.fillRect(x, y, photoWidth, photoHeight);
                    ctx.fillStyle = '#9ca3af';
                    ctx.font = 'bold 28px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(`Shot #${i + 1}`, x + photoWidth / 2, y + photoHeight / 2);
                }
            }

            this._drawFooter(ctx, canvas.width, totalHeight, margin, footerHeight, theme);
        }

        return canvas;
    }

    _drawFooter(ctx, width, height, margin, footerHeight, theme) {
        const footerCenterY = height - (footerHeight / 2);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Sticker trang trí
        if (this.selectedSticker) {
            ctx.font = '48px serif';
            ctx.fillText(this.selectedSticker, width / 2, footerCenterY - 60);
        }

        // Tiêu đề chính (Hangul: 인생네컷 / Life4Cuts)
        ctx.fillStyle = theme.text;
        ctx.font = 'bold 44px "Outfit", "Noto Sans KR", sans-serif';
        ctx.letterSpacing = '4px';
        ctx.fillText(this.customTitle, width / 2, footerCenterY - 8);

        // Phụ đề (BERRYFILM STUDIO)
        ctx.fillStyle = theme.sub;
        ctx.font = '600 20px "Outfit", sans-serif';
        ctx.letterSpacing = '6px';
        ctx.fillText(this.customSubtitle, width / 2, footerCenterY + 36);

        // Date Stamp retro
        if (this.enableDateStamp) {
            const now = new Date();
            const yearStr = "'" + String(now.getFullYear()).slice(-2);
            const monthStr = String(now.getMonth() + 1).padStart(2, '0');
            const dayStr = String(now.getDate()).padStart(2, '0');
            const dateStr = `${yearStr} ${monthStr} ${dayStr}`;

            ctx.fillStyle = '#ff6b35';
            ctx.font = 'bold 24px "Courier New", monospace';
            ctx.fillText(dateStr, width / 2, footerCenterY + 74);
        }
    }
}

window.PhotoboothEngine = PhotoboothEngine;
