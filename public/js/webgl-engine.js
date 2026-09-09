/**
 * BerryFilm - WebGL 2.0 / 1.0 Real-time Shader Processing Pipeline
 * Xử lý 3D LUT Color Grading, Soft Dreamy Bloom, Dynamic Luma Grain & Light Leaks
 */

class WebGLEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.mainTexture = null;
        this.lutTexture = null;
        this.quadBuffer = null;

        this.currentPresetId = 'berry_pink';
        this.lutDataMap = new Map();

        // Parameters
        this.params = {
            lutIntensity: 1.0,
            bloomIntensity: 0.18,
            grainIntensity: 0.07,
            vignetteIntensity: 0.18,
            lightLeakIntensity: 0.0,
            lightLeakType: 0, // 0: None, 1: Top Right, 2: Left Streak, 3: Bottom Warm
            exposure: 0.05,
            contrast: 1.04,
            warmth: 0.02,
            tint: 0.01,
            flipX: false
        };

        this.time = 0;
        this.uniformLocations = {};
        this.initWebGL();
    }

    initWebGL() {
        const gl = this.canvas.getContext('webgl2', { preserveDrawingBuffer: true, alpha: false, antialias: false }) ||
                   this.canvas.getContext('webgl', { preserveDrawingBuffer: true, alpha: false, antialias: false });

        if (!gl) {
            console.error('WebGL is not supported in this browser');
            alert('Trình duyệt của bạn không hỗ trợ WebGL. Vui lòng bật tăng tốc phần cứng.');
            return;
        }
        this.gl = gl;

        // Vertex Shader
        const vsSource = `
            attribute vec2 a_Position;
            attribute vec2 a_TexCoord;
            varying vec2 v_TexCoord;
            uniform bool u_FlipX;

            void main() {
                v_TexCoord = a_TexCoord;
                if (u_FlipX) {
                    v_TexCoord.x = 1.0 - v_TexCoord.x;
                }
                gl_Position = vec4(a_Position, 0.0, 1.0);
            }
        `;

        // Fragment Shader
        const fsSource = `
            precision mediump float;

            varying vec2 v_TexCoord;
            uniform sampler2D u_MainTexture;
            uniform sampler2D u_LutTexture;

            uniform float u_Time;
            uniform float u_LutIntensity;
            uniform float u_BloomIntensity;
            uniform float u_GrainIntensity;
            uniform float u_VignetteIntensity;
            uniform float u_LightLeakIntensity;
            uniform int u_LightLeakType;
            uniform float u_Exposure;
            uniform float u_Contrast;
            uniform float u_Warmth;
            uniform float u_Tint;
            uniform vec2 u_Resolution;

            // Hàm tra cứu 3D Color LUT (512x512 = 8x8 blocks of 64x64)
            vec4 sampleLUT(sampler2D lut, vec4 color) {
                color = clamp(color, 0.0, 1.0);
                float blueColor = color.b * 63.0;

                vec2 quad1;
                quad1.y = floor(floor(blueColor) / 8.0);
                quad1.x = floor(blueColor) - (quad1.y * 8.0);

                vec2 quad2;
                quad2.y = floor(ceil(blueColor) / 8.0);
                quad2.x = ceil(blueColor) - (quad2.y * 8.0);

                vec2 texPos1;
                texPos1.x = (quad1.x * 0.125) + (0.5 / 512.0) + ((0.125 - 1.0 / 512.0) * color.r);
                texPos1.y = (quad1.y * 0.125) + (0.5 / 512.0) + ((0.125 - 1.0 / 512.0) * color.g);

                vec2 texPos2;
                texPos2.x = (quad2.x * 0.125) + (0.5 / 512.0) + ((0.125 - 1.0 / 512.0) * color.r);
                texPos2.y = (quad2.y * 0.125) + (0.5 / 512.0) + ((0.125 - 1.0 / 512.0) * color.g);

                vec4 newColor1 = texture2D(lut, texPos1);
                vec4 newColor2 = texture2D(lut, texPos2);

                return mix(newColor1, newColor2, fract(blueColor));
            }

            // Pseudo-random noise cho Dynamic Film Grain
            float rand(vec2 co, float t) {
                return fract(sin(dot(co + vec2(t * 0.031, t * 0.071), vec2(12.9898, 78.233))) * 43758.5453);
            }

            // Soft Dreamy Bloom 9-tap sampling
            vec3 calculateDreamyBloom(sampler2D tex, vec2 uv, vec2 res) {
                vec2 texel = 2.5 / res;
                vec3 bloom = vec3(0.0);
                
                bloom += max(vec3(0.0), texture2D(tex, uv + vec2(-texel.x, -texel.y)).rgb - 0.45) * 0.09;
                bloom += max(vec3(0.0), texture2D(tex, uv + vec2(0.0, -texel.y)).rgb - 0.45) * 0.12;
                bloom += max(vec3(0.0), texture2D(tex, uv + vec2(texel.x, -texel.y)).rgb - 0.45) * 0.09;

                bloom += max(vec3(0.0), texture2D(tex, uv + vec2(-texel.x, 0.0)).rgb - 0.45) * 0.12;
                bloom += max(vec3(0.0), texture2D(tex, uv).rgb - 0.45) * 0.16;
                bloom += max(vec3(0.0), texture2D(tex, uv + vec2(texel.x, 0.0)).rgb - 0.45) * 0.12;

                bloom += max(vec3(0.0), texture2D(tex, uv + vec2(-texel.x, texel.y)).rgb - 0.45) * 0.09;
                bloom += max(vec3(0.0), texture2D(tex, uv + vec2(0.0, texel.y)).rgb - 0.45) * 0.12;
                bloom += max(vec3(0.0), texture2D(tex, uv + vec2(texel.x, texel.y)).rgb - 0.45) * 0.09;

                return bloom;
            }

            // Procedural Vintage Light Leak
            vec3 getLightLeak(vec2 uv, int type) {
                if (type == 0) return vec3(0.0);
                vec3 leak = vec3(0.0);

                if (type == 1) { // Góc phải trên (Warm Red & Peach)
                    float dist = distance(uv, vec2(1.0, 0.0));
                    float mask = smoothstep(0.85, 0.1, dist);
                    leak = vec3(1.0, 0.45, 0.25) * mask * 0.8;
                } else if (type == 2) { // Vệt sáng sọc trái (Magenta to Amber)
                    float streak = smoothstep(0.4, 0.0, abs(uv.x - 0.15 + sin(uv.y * 3.0) * 0.05));
                    leak = mix(vec3(1.0, 0.2, 0.5), vec3(1.0, 0.7, 0.1), uv.y) * streak * 0.75;
                } else if (type == 3) { // Vệt sáng chân trời ấm (Golden Bottom)
                    float mask = smoothstep(0.6, 0.0, 1.0 - uv.y);
                    leak = vec3(1.0, 0.6, 0.2) * mask * 0.7;
                }
                return leak;
            }

            void main() {
                vec4 baseColor = texture2D(u_MainTexture, v_TexCoord);
                vec3 col = baseColor.rgb;

                // 1. Phơi sáng & Cân bằng trắng cơ bản
                col *= (1.0 + u_Exposure);
                col.r += u_Warmth;
                col.b -= u_Warmth;
                col.g += u_Tint;
                col = clamp(col, 0.0, 1.0);

                // 2. Tra cứu Color LUT
                vec4 lutColor = sampleLUT(u_LutTexture, vec4(col, 1.0));
                col = mix(col, lutColor.rgb, u_LutIntensity);

                // 3. Dreamy Light Bloom (Glow mềm mại)
                if (u_BloomIntensity > 0.0) {
                    vec3 bloom = calculateDreamyBloom(u_MainTexture, v_TexCoord, u_Resolution);
                    // Bloom màu hồng kem nhẹ
                    col += bloom * u_BloomIntensity * vec3(1.08, 1.02, 1.05);
                }

                // 4. Độ tương phản
                col = (col - 0.5) * u_Contrast + 0.5;
                col = clamp(col, 0.0, 1.0);

                // 5. Light Leaks
                if (u_LightLeakIntensity > 0.0 && u_LightLeakType > 0) {
                    vec3 leak = getLightLeak(v_TexCoord, u_LightLeakType);
                    col = col + leak * u_LightLeakIntensity;
                }

                // 6. Dynamic Film Grain (Luma-weighted)
                if (u_GrainIntensity > 0.0) {
                    float luma = dot(col, vec3(0.299, 0.587, 0.114));
                    float grainMask = 1.0 - abs(luma - 0.5) * 1.8; // Tập trung nhiều ở midtones
                    grainMask = max(0.25, grainMask);
                    float n = (rand(v_TexCoord * u_Resolution * 0.5, u_Time) - 0.5) * 2.0;
                    col += n * u_GrainIntensity * grainMask;
                }

                // 7. Retro Vignette
                if (u_VignetteIntensity > 0.0) {
                    vec2 vigCoord = v_TexCoord - vec2(0.5);
                    float dist = length(vigCoord);
                    float vig = smoothstep(0.75, 0.45, dist * (1.0 + u_VignetteIntensity * 0.8));
                    col *= vig;
                }

                gl_FragColor = vec4(clamp(col, 0.0, 1.0), baseColor.a);
            }
        `;

        this.program = this._createProgram(vsSource, fsSource);
        this._setupBuffersAndUniforms();
        this._initTextures();
        this.setLutPreset(this.currentPresetId);
    }

    _createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    _createProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vs = this._createShader(gl.VERTEX_SHADER, vsSource);
        const fs = this._createShader(gl.FRAGMENT_SHADER, fsSource);
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    _setupBuffersAndUniforms() {
        const gl = this.gl;
        gl.useProgram(this.program);

        // Quad positions and texCoords (X, Y, U, V)
        const quadData = new Float32Array([
            -1.0, -1.0, 0.0, 1.0,
             1.0, -1.0, 1.0, 1.0,
            -1.0,  1.0, 0.0, 0.0,
            -1.0,  1.0, 0.0, 0.0,
             1.0, -1.0, 1.0, 1.0,
             1.0,  1.0, 1.0, 0.0,
        ]);

        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);

        const aPosLoc = gl.getAttribLocation(this.program, 'a_Position');
        const aTexLoc = gl.getAttribLocation(this.program, 'a_TexCoord');

        gl.enableVertexAttribArray(aPosLoc);
        gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 16, 0);

        gl.enableVertexAttribArray(aTexLoc);
        gl.vertexAttribPointer(aTexLoc, 2, gl.FLOAT, false, 16, 8);

        // Uniform locations cache
        const uniformNames = [
            'u_MainTexture', 'u_LutTexture', 'u_Time', 'u_LutIntensity',
            'u_BloomIntensity', 'u_GrainIntensity', 'u_VignetteIntensity',
            'u_LightLeakIntensity', 'u_LightLeakType', 'u_Exposure',
            'u_Contrast', 'u_Warmth', 'u_Tint', 'u_Resolution', 'u_FlipX'
        ];
        uniformNames.forEach(name => {
            this.uniformLocations[name] = gl.getUniformLocation(this.program, name);
        });

        gl.uniform1i(this.uniformLocations['u_MainTexture'], 0);
        gl.uniform1i(this.uniformLocations['u_LutTexture'], 1);
    }

    _initTextures() {
        const gl = this.gl;

        // Main Video / Photo Texture (Unit 0)
        this.mainTexture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.mainTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // 3D LUT Texture (Unit 1)
        this.lutTexture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }

    /**
     * Chuyển đổi bộ lọc màu LUT theo Preset
     */
    setLutPreset(presetId) {
        if (!window.lutGenerator) return;
        this.currentPresetId = presetId;
        const preset = window.lutGenerator.presets[presetId] || window.lutGenerator.presets.berry_pink;

        // Tự động load default parameters từ preset nếu người dùng chưa can thiệp sâu
        this.params.grainIntensity = preset.grain;
        this.params.bloomIntensity = preset.bloom;
        this.params.vignetteIntensity = preset.vignette;
        this.params.exposure = preset.exposure;
        this.params.warmth = preset.warmth;

        const gl = this.gl;
        const lutData = window.lutGenerator.getLutData(presetId);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutData);
    }

    /**
     * Cập nhật các thông số hiệu ứng (Bloom, Grain, Leak, Exposure...)
     */
    updateParams(newParams) {
        Object.assign(this.params, newParams);
    }

    /**
     * Render một frame thời gian thực từ Camera Video hoặc Ảnh Canvas
     */
    renderFrame(sourceElement, isVideo = true) {
        if (!this.gl || !sourceElement) return;
        const gl = this.gl;

        this.time += 0.016; // ~60fps step

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.useProgram(this.program);

        // Upload Video / Image frame vào Texture Unit 0
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.mainTexture);
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceElement);
        } catch (e) {
            // Source not ready yet
            return;
        }

        // Set Uniforms
        gl.uniform1f(this.uniformLocations['u_Time'], this.time);
        gl.uniform1f(this.uniformLocations['u_LutIntensity'], this.params.lutIntensity);
        gl.uniform1f(this.uniformLocations['u_BloomIntensity'], this.params.bloomIntensity);
        gl.uniform1f(this.uniformLocations['u_GrainIntensity'], this.params.grainIntensity);
        gl.uniform1f(this.uniformLocations['u_VignetteIntensity'], this.params.vignetteIntensity);
        gl.uniform1f(this.uniformLocations['u_LightLeakIntensity'], this.params.lightLeakIntensity);
        gl.uniform1i(this.uniformLocations['u_LightLeakType'], this.params.lightLeakType);
        gl.uniform1f(this.uniformLocations['u_Exposure'], this.params.exposure);
        gl.uniform1f(this.uniformLocations['u_Contrast'], this.params.contrast);
        gl.uniform1f(this.uniformLocations['u_Warmth'], this.params.warmth);
        gl.uniform1f(this.uniformLocations['u_Tint'], this.params.tint);
        gl.uniform2f(this.uniformLocations['u_Resolution'], this.canvas.width, this.canvas.height);
        gl.uniform1i(this.uniformLocations['u_FlipX'], this.params.flipX ? 1 : 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /**
     * Chụp / Xuất ảnh ở độ phân giải gốc cao nhất (Offscreen Processing)
     */
    processFullResolution(sourceImage, targetWidth, targetHeight) {
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = targetWidth;
        offscreenCanvas.height = targetHeight;

        const offscreenEngine = new WebGLEngine(offscreenCanvas);
        offscreenEngine.updateParams(this.params);
        offscreenEngine.setLutPreset(this.currentPresetId);
        offscreenEngine.renderFrame(sourceImage, false);

        return offscreenCanvas;
    }
}

window.WebGLEngine = WebGLEngine;
