/**
 * BerryFilm - 3D Color LUT Engine & Korean Film Preset Generator
 * Tạo texture 512x512 (tương đương 64x64x64 3D LUT) với độ chính xác cao cho WebGL
 */

class LutGenerator {
    constructor() {
        this.LUT_SIZE = 64; // 64x64x64 3D LUT
        this.TEX_SIZE = 512; // 8x8 blocks of 64x64 = 512x512
        this.cache = new Map();

        this.presets = {
            berry_pink: {
                name: 'Berry Pink',
                krName: '베리 핑크',
                desc: 'Tone da trắng hồng tự nhiên, highlight kem mộng mơ, bóng tím pastel nhẹ',
                colorTag: '#ffb6c1',
                grain: 0.07,
                bloom: 0.18,
                vignette: 0.15,
                exposure: 0.06,
                warmth: 0.04
            },
            y2k_digicam: {
                name: 'Digi-Cam 2000',
                krName: '디카 2000',
                desc: 'Màu máy ảnh KTS Y2K cảm biến CCD, tương phản sắc nét, bóng ngả xanh cyan',
                colorTag: '#6ee7b7',
                grain: 0.05,
                bloom: 0.22,
                vignette: 0.22,
                exposure: 0.08,
                warmth: -0.05
            },
            seoul_pastel: {
                name: 'Seoul Mood',
                krName: '서울 무드',
                desc: 'Phong cách quán cafe Seoul trong trẻo, tương phản mềm mại, màu sắc êm dịu',
                colorTag: '#c4b5fd',
                grain: 0.06,
                bloom: 0.16,
                vignette: 0.12,
                exposure: 0.05,
                warmth: 0.02
            },
            kodak_gold: {
                name: 'Classic 35mm',
                krName: '필름 골드',
                desc: 'Chất film nhựa 35mm hoài cổ, ánh vàng hoàng hôn ấm áp, màu film đậm đà',
                colorTag: '#fcd34d',
                grain: 0.12,
                bloom: 0.14,
                vignette: 0.30,
                exposure: 0.02,
                warmth: 0.15
            },
            life4cuts_bw: {
                name: 'Life4Cuts Mono',
                krName: '인생네컷 흑백',
                desc: 'Đen trắng Photobooth studio Hàn Quốc, tone da sáng bừng, bóng nhung mềm',
                colorTag: '#9ca3af',
                grain: 0.09,
                bloom: 0.20,
                vignette: 0.25,
                exposure: 0.05,
                warmth: 0.00
            },
            summer_breeze: {
                name: 'Summer Breeze',
                krName: '청량 여름',
                desc: 'Tone xanh ngọc bích biển đảo Jeju, nắng trong veo rực rỡ và tươi mát',
                colorTag: '#38bdf8',
                grain: 0.06,
                bloom: 0.15,
                vignette: 0.18,
                exposure: 0.07,
                warmth: -0.04
            },
            neutral: {
                name: 'Original Clean',
                krName: '원본',
                desc: 'Màu sắc gốc không qua bộ lọc màu',
                colorTag: '#e2e8f0',
                grain: 0.00,
                bloom: 0.00,
                vignette: 0.00,
                exposure: 0.00,
                warmth: 0.00
            }
        };
    }

    /**
     * Tạo dữ liệu Uint8Array 512x512 RGBA cho một preset
     */
    getLutData(presetId) {
        if (this.cache.has(presetId)) {
            return this.cache.get(presetId);
        }

        const size = this.LUT_SIZE; // 64
        const texSize = this.TEX_SIZE; // 512
        const buffer = new Uint8Array(texSize * texSize * 4);

        for (let y = 0; y < texSize; y++) {
            for (let x = 0; x < texSize; x++) {
                // Tính tọa độ RGB trong không gian 64x64x64
                const blockX = Math.floor(x / size);
                const blockY = Math.floor(y / size);
                const blockIndex = blockY * 8 + blockX; // 0..63

                const r = (x % size) / (size - 1);
                const g = (y % size) / (size - 1);
                const b = blockIndex / (size - 1);

                // Biến đổi màu sắc theo preset
                const transformed = this._applyPresetMath(r, g, b, presetId);

                const pixelIndex = (y * texSize + x) * 4;
                buffer[pixelIndex] = Math.round(Math.min(1, Math.max(0, transformed.r)) * 255);
                buffer[pixelIndex + 1] = Math.round(Math.min(1, Math.max(0, transformed.g)) * 255);
                buffer[pixelIndex + 2] = Math.round(Math.min(1, Math.max(0, transformed.b)) * 255);
                buffer[pixelIndex + 3] = 255;
            }
        }

        this.cache.set(presetId, buffer);
        return buffer;
    }

    /**
     * Hàm toán học color grading mô phỏng chính xác chất màu film Hàn Quốc
     */
    _applyPresetMath(r, g, b, presetId) {
        let cr = r;
        let cg = g;
        let cb = b;

        // Tính luma gốc
        const luma = 0.299 * cr + 0.587 * cg + 0.114 * cb;

        switch (presetId) {
            case 'berry_pink': {
                // 1. Lifted blacks với tone mauve/hồng phấn nhẹ ở vùng tối
                const shadowLift = 0.07;
                cr = cr * (1.0 - shadowLift) + shadowLift * 1.15;
                cg = cg * (1.0 - shadowLift) + shadowLift * 0.95;
                cb = cb * (1.0 - shadowLift) + shadowLift * 1.10;

                // 2. Korean Creamy Skin tone (Nâng sáng midtone, đẩy sắc hồng đào, giảm vàng ố)
                const midMask = Math.sin(luma * Math.PI); // Đạt đỉnh ở luma 0.5
                cr += midMask * 0.085;
                cg += midMask * 0.025;
                cb += midMask * 0.055;

                // 3. Highlight roll-off mềm mại (Creamy highlights)
                if (luma > 0.6) {
                    const highMask = (luma - 0.6) / 0.4;
                    cr += highMask * 0.04;
                    cg += highMask * 0.02;
                    cb -= highMask * 0.02; // Hơi ấm nhẹ ở highlight
                }

                // 4. Soft S-Curve
                cr = this._smoothCurve(cr, 0.95);
                cg = this._smoothCurve(cg, 0.95);
                cb = this._smoothCurve(cb, 0.95);
                break;
            }

            case 'y2k_digicam': {
                // Y2K Digicam CCD sensor: tương phản mạnh, vùng tối ngả cyan/green nhẹ, highlight pop
                // Lift shadows slightly
                cr = cr * 0.94 + 0.03;
                cg = cg * 0.95 + 0.045;
                cb = cb * 0.96 + 0.06;

                // Punchy contrast
                cr = Math.pow(cr, 1.12) * 1.08;
                cg = Math.pow(cg, 1.08) * 1.05;
                cb = Math.pow(cb, 1.04) * 1.04;

                // Flash highlight brightness
                if (luma > 0.7) {
                    const h = (luma - 0.7) / 0.3;
                    cr += h * 0.06;
                    cg += h * 0.06;
                    cb += h * 0.07;
                }
                break;
            }

            case 'seoul_pastel': {
                // Seoul Cafe Mood: Pastel, độ bão hòa dịu, shadow xám khói, highlight mộng mơ
                const lift = 0.09;
                cr = cr * (1.0 - lift) + lift * 1.05;
                cg = cg * (1.0 - lift) + lift * 1.02;
                cb = cb * (1.0 - lift) + lift * 1.12;

                // Desaturate slightly and tint
                const avg = (cr + cg + cb) / 3.0;
                cr = avg * 0.25 + cr * 0.75 + 0.02;
                cg = avg * 0.20 + cg * 0.80 + 0.01;
                cb = avg * 0.15 + cb * 0.85 + 0.04;
                break;
            }

            case 'kodak_gold': {
                // Kodak 35mm Analog: Ấm áp, đỏ cam rực rỡ, lá cây xanh ấm, bóng sâu
                // Warm shadows
                cr = Math.pow(cr, 0.92) * 1.08 + 0.03;
                cg = Math.pow(cg, 0.96) * 1.02 + 0.02;
                cb = Math.pow(cb, 1.15) * 0.92;

                // Golden highlight
                if (luma > 0.5) {
                    const h = (luma - 0.5) / 0.5;
                    cr += h * 0.08;
                    cg += h * 0.05;
                    cb -= h * 0.04;
                }
                break;
            }

            case 'life4cuts_bw': {
                // Life4Cuts Monochrome: Trắng đen studio, da phát sáng, tương phản mịn
                let bw = 0.32 * cr + 0.55 * cg + 0.13 * cb;
                // Soft glow curve
                bw = bw * 0.92 + 0.05;
                bw = Math.pow(bw, 0.95);
                if (bw > 0.4) {
                    bw += Math.sin((bw - 0.4) * Math.PI) * 0.08;
                }
                cr = bw;
                cg = bw;
                cb = bw;
                break;
            }

            case 'summer_breeze': {
                // Summer Breeze: Xanh ngọc biển, hồng dâu, trời trong xanh
                cr = Math.pow(cr, 1.04) * 1.02;
                cg = Math.pow(cg, 0.95) * 1.05 + 0.02;
                cb = Math.pow(cb, 0.90) * 1.10 + 0.04;

                // Boost cyan and magenta
                if (cg > cr && cb > cr) { // Cyan/Blue areas
                    cb += 0.08;
                    cg += 0.04;
                }
                if (cr > cg && cb > cg) { // Purple/Pink areas
                    cr += 0.06;
                }
                break;
            }

            default:
                break;
        }

        return { r: cr, g: cg, b: cb };
    }

    _smoothCurve(val, strength = 1.0) {
        // Hermite curve for smooth contrast
        const curved = val * val * (3.0 - 2.0 * val);
        return val * (1.0 - strength) + curved * strength;
    }

    /**
     * Tạo Canvas Preview nhỏ 128x128 để hiển thị thumbnail cho từng Preset
     */
    generateThumbnail(presetId, baseImage = null) {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');

        if (baseImage) {
            ctx.drawImage(baseImage, 0, 0, 120, 120);
        } else {
            // Gradient mẫu chân dung/phong cảnh giả lập
            const grad = ctx.createLinearGradient(0, 0, 120, 120);
            grad.addColorStop(0, '#f9c5d1');
            grad.addColorStop(0.5, '#f6d365');
            grad.addColorStop(1, '#96e6a1');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 120, 120);
        }

        const imgData = ctx.getImageData(0, 0, 120, 120);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;
            const t = this._applyPresetMath(r, g, b, presetId);
            data[i] = Math.round(Math.min(1, Math.max(0, t.r)) * 255);
            data[i + 1] = Math.round(Math.min(1, Math.max(0, t.g)) * 255);
            data[i + 2] = Math.round(Math.min(1, Math.max(0, t.b)) * 255);
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL();
    }
}

window.lutGenerator = new LutGenerator();
