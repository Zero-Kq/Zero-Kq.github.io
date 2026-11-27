(() => {
  const html = document.documentElement;
  const THEME_KEY = 'zero-theme';

  // 1. Theme Toggle (WebGL2 Ember Burn Shader — pre-baked tileable noise + native foreignObject capture)
  const themeBtn = document.getElementById('headerThemeBtn');
  if (themeBtn) {
    const EMBER_PARAMS = {
      duration: 2.45,     // seconds
      emberGlow: 1.45,    // tendril (Ember glow)
      charScale: 1.45,    // noiseScale (Char scale)
      burnWidth: 1.8,     // softness (Burn width, px)
      flickerSpeed: 2.30  // drift (Flicker speed)
    };
    const SNAP_SRC = 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.js';

    let isTransitioning = false;
    let snapLibPromise = null;
    let fontCssPromise = null;
    let glCtx = null;

    const applyTheme = (next) => {
      html.dataset.theme = next;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('zero:themechange', { detail: { theme: next } }));
    };

    // Build & cache @font-face CSS containing ONLY the woff2 slices actually loaded on this page
    const loadEmbeddedFontCss = () => {
      if (fontCssPromise) return fontCssPromise;
      fontCssPromise = (async () => {
        try {
          if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
          }
          const loadedKeys = new Set();
          if (document.fonts) {
            document.fonts.forEach((ff) => {
              if (ff.status === 'loaded') {
                const fam = (ff.family || '').replace(/^['"]|['"]$/g, '').toLowerCase();
                const wt = String(ff.weight || '400');
                const ur = (ff.unicodeRange || '').replace(/\s+/g, '').toUpperCase();
                loadedKeys.add(`${fam}|${wt}|${ur}`);
                loadedKeys.add(`${fam}|${wt}|*`);
              }
            });
          }
          if (loadedKeys.size === 0) return '';

          const matchedRules = [];
          for (const sheet of Array.from(document.styleSheets)) {
            let rules;
            try {
              rules = sheet.cssRules;
            } catch (_) {
              continue;
            }
            if (!rules) continue;
            for (const rule of Array.from(rules)) {
              if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
              const style = rule.style;
              const fam = (style.getPropertyValue('font-family') || '').replace(/^['"]|['"]$/g, '').toLowerCase();
              const wt = (style.getPropertyValue('font-weight') || '400').trim();
              const ur = (style.getPropertyValue('unicode-range') || '').replace(/\s+/g, '').toUpperCase();
              const key = ur ? `${fam}|${wt}|${ur}` : `${fam}|${wt}|*`;
              if (!loadedKeys.has(key)) continue;
              const src = style.getPropertyValue('src') || '';
              const m = src.match(/url\(["']?([^"')]+)["']?\)/);
              if (!m) continue;
              matchedRules.push({ cssText: rule.cssText, url: m[1] });
            }
          }
          if (matchedRules.length === 0) return '';

          const toDataUri = async (url) => {
            const res = await fetch(url, { cache: 'force-cache', mode: 'cors' });
            if (!res.ok) return null;
            const buf = await res.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let bin = '';
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
              bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
            }
            return `data:font/woff2;base64,${btoa(bin)}`;
          };

          const inlined = await Promise.all(
            matchedRules.map(async (item) => {
              try {
                const dataUri = await toDataUri(item.url);
                if (!dataUri) return '';
                return item.cssText.replace(item.url, dataUri);
              } catch (_) {
                return '';
              }
            })
          );
          return inlined.filter(Boolean).join('\n');
        } catch (_) {
          return '';
        }
      })();
      return fontCssPromise;
    };

    const loadSnapLib = () => {
      if (window.modernScreenshot && typeof window.modernScreenshot.domToCanvas === 'function') {
        return Promise.resolve(window.modernScreenshot);
      }
      if (snapLibPromise) return snapLibPromise;
      snapLibPromise = new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = SNAP_SRC;
        s.async = true;
        s.onload = () => resolve(
          window.modernScreenshot && typeof window.modernScreenshot.domToCanvas === 'function'
            ? window.modernScreenshot
            : null
        );
        s.onerror = () => resolve(null);
        document.head.appendChild(s);
      });
      return snapLibPromise;
    };

    const preloadCaptureAssets = () => {
      loadSnapLib();
      loadEmbeddedFontCss();
    };

    // Preload modern-screenshot + loaded font slices silently on hover/focus
    themeBtn.addEventListener('pointerenter', preloadCaptureAssets, { once: true, passive: true });
    themeBtn.addEventListener('focus', preloadCaptureAssets, { once: true, passive: true });

    // Pre-bake a seamless tileable 256x256 RGBA noise texture (R: low-freq, G: mid-freq, B: high-freq, A: hash)
    const createNoiseTexture = (gl) => {
      const size = 256;
      const data = new Uint8Array(size * size * 4);
      const perm = new Uint8Array(size * 2);
      let s = 133791;
      const nextRand = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
      for (let i = 0; i < size; i++) perm[i] = i;
      for (let i = size - 1; i > 0; i--) {
        const j = Math.floor(nextRand() * (i + 1));
        const tmp = perm[i];
        perm[i] = perm[j];
        perm[j] = tmp;
      }
      for (let i = 0; i < size; i++) perm[i + size] = perm[i];

      const tileNoise = (x, y, period) => {
        const xi = Math.floor(x) % period;
        const yi = Math.floor(y) % period;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        const u = xf * xf * (3 - 2 * xf);
        const v = yf * yf * (3 - 2 * yf);
        const x1 = (xi + 1) % period;
        const y1 = (yi + 1) % period;
        const h = (ix, iy) => perm[(perm[ix & 255] + (iy & 255)) & 255] / 255;
        const a = h(xi, yi);
        const b = h(x1, yi);
        const c = h(xi, y1);
        const d = h(x1, y1);
        return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
      };

      const tileFbm = (u, v, baseFreq, octaves) => {
        let sum = 0;
        let amp = 0.5;
        let norm = 0;
        let freq = baseFreq;
        for (let o = 0; o < octaves; o++) {
          sum += amp * tileNoise(u * freq, v * freq, freq);
          norm += amp;
          freq *= 2;
          amp *= 0.5;
        }
        return sum / norm;
      };

      for (let y = 0; y < size; y++) {
        const v = y / size;
        for (let x = 0; x < size; x++) {
          const u = x / size;
          const idx = (y * size + x) * 4;
          data[idx] = Math.round(tileFbm(u, v, 4, 4) * 255);      // R: coarse organic lobes
          data[idx + 1] = Math.round(tileFbm(u + 0.37, v + 0.61, 8, 3) * 255); // G: warp channel
          data[idx + 2] = Math.round(tileFbm(u + 0.19, v + 0.83, 16, 3) * 255); // B: fine paper fibers
          data[idx + 3] = Math.round(nextRand() * 255);           // A: white noise for sparks/flicker
        }
      }

      const noiseTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, noiseTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      return noiseTex;
    };

    const initEmberGL = () => {
      if (glCtx !== null) return glCtx;
      const canvas = document.createElement('canvas');
      canvas.id = 'emberBurnCanvas';
      canvas.className = 'ink-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.setAttribute('data-html2canvas-ignore', 'true');
      document.body.appendChild(canvas);

      const gl = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
        depth: false,
        stencil: false
      });
      if (!gl) {
        canvas.remove();
        glCtx = false;
        return false;
      }

      const vertSrc = `#version 300 es
        const vec2 POS[3] = vec2[3](
          vec2(-1.0, -1.0),
          vec2( 3.0, -1.0),
          vec2(-1.0,  3.0)
        );
        out vec2 vUv;
        void main() {
          vec2 p = POS[gl_VertexID];
          vUv = p * 0.5 + 0.5;
          gl_Position = vec4(p, 0.0, 1.0);
        }
      `;

      const fragSrc = `#version 300 es
        precision highp float;

        in vec2 vUv;
        out vec4 fragColor;

        uniform sampler2D uOldTex;
        uniform sampler2D uNoiseTex;
        uniform vec2 uResolution;
        uniform vec2 uOrigin;
        uniform float uProgress;
        uniform float uTime;
        uniform vec2 uSeedOffset;
        uniform float uEmberGlow;
        uniform float uCharScale;
        uniform float uBurnWidth;
        uniform float uFlickerSpeed;
        uniform float uMaxDist;

        void main() {
          vec2 px = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);
          vec2 texUv = vec2(vUv.x, 1.0 - vUv.y);

          float minDim = max(min(uResolution.x, uResolution.y), 1.0);
          vec2 nUv = (px / minDim) * (0.95 * uCharScale) + uSeedOffset;

          // Fast texture-based domain warp + multi-scale paper-burn FBM
          vec4 n0 = texture(uNoiseTex, nUv);
          vec2 warp = (n0.rg - 0.5) * 0.34;
          vec4 n1 = texture(uNoiseTex, nUv + warp);
          vec4 n2 = texture(uNoiseTex, nUv * 2.4 + vec2(uTime * 0.025 * uFlickerSpeed, -uTime * 0.02 * uFlickerSpeed));

          float coarse = n1.r;
          float fine   = n2.b;

          float noiseOffset = (coarse - 0.5) * (minDim * 0.34) + (fine - 0.5) * (minDim * 0.095);

          float dist = length(px - uOrigin);
          float startMargin = minDim * 0.06;
          float endMargin = minDim * 0.24 + 48.0;
          float front = mix(-startMargin, uMaxDist + endMargin, uProgress);

          float signedDist = (dist + noiseOffset) - front;

          float bw = max(uBurnWidth, 0.4);
          float coreW = bw * 2.5;
          float glowW = bw * 11.5;
          float charW = bw * 18.5;

          float flickSample = texture(uNoiseTex, nUv * 3.2 + vec2(uTime * 0.28 * uFlickerSpeed, -uTime * 0.22 * uFlickerSpeed)).b;
          float flicker = mix(0.75, 1.34, flickSample);
          float edgeFade = smoothstep(0.0, 0.04, uProgress) * (1.0 - smoothstep(0.94, 1.0, uProgress));

          vec4 oldCol = texture(uOldTex, texUv);

          float pageAlpha = smoothstep(-coreW * 0.55, coreW * 0.45, signedDist);

          float charBand = smoothstep(charW, 0.0, signedDist) * step(-coreW, signedDist);
          float charMask = clamp(charBand * (0.55 + 0.65 * fine), 0.0, 1.0);
          vec3 charColor = mix(vec3(0.06, 0.04, 0.025), vec3(0.22, 0.085, 0.025), fine);
          vec3 surfaceCol = mix(oldCol.rgb, charColor, charMask * 0.92 * edgeFade);

          float rimCore = exp(-pow(signedDist / max(coreW, 1.0), 2.0));
          float rimHalo = exp(-pow((signedDist + coreW * 0.4) / max(glowW, 1.0), 2.0));

          vec3 colHot  = vec3(1.00, 0.94, 0.72);
          vec3 colMid  = vec3(1.00, 0.46, 0.10);
          vec3 colCool = vec3(0.72, 0.12, 0.03);

          vec3 emberCol = colHot * rimCore * 1.45 + colMid * rimHalo * 0.95 + colCool * (rimHalo * rimHalo) * 0.6;
          emberCol *= uEmberGlow * flicker * edgeFade;

          float sparkZone = smoothstep(-glowW * 2.6, -coreW * 0.3, signedDist) * smoothstep(coreW * 0.5, -coreW * 0.2, signedDist);
          float sparkVal = texture(uNoiseTex, (px / 220.0) + vec2(0.0, uTime * 0.42 * uFlickerSpeed) + uSeedOffset).a;
          float spark = step(0.985, sparkVal) * sparkZone * uEmberGlow * edgeFade;
          emberCol += vec3(1.0, 0.72, 0.28) * spark * 2.2;

          float emberAlpha = clamp((rimCore * 0.98 + rimHalo * 0.68 + spark) * uEmberGlow * edgeFade, 0.0, 1.0);
          float outAlpha = clamp(max(pageAlpha, emberAlpha), 0.0, 1.0);

          vec3 finalRgb = surfaceCol * pageAlpha + emberCol;
          if (outAlpha > 0.001) {
            finalRgb = finalRgb / outAlpha;
          }

          fragColor = vec4(clamp(finalRgb, 0.0, 1.0), outAlpha);
        }
      `;

      const compile = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
          console.error('Ember shader error:', gl.getShaderInfoLog(sh));
          return null;
        }
        return sh;
      };
      const vs = compile(gl.VERTEX_SHADER, vertSrc);
      const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
      if (!vs || !fs) {
        canvas.remove();
        glCtx = false;
        return false;
      }

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Ember program error:', gl.getProgramInfoLog(program));
        canvas.remove();
        glCtx = false;
        return false;
      }

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const noiseTex = createNoiseTexture(gl);

      glCtx = {
        canvas,
        gl,
        program,
        tex,
        noiseTex,
        uniforms: {
          uOldTex: gl.getUniformLocation(program, 'uOldTex'),
          uNoiseTex: gl.getUniformLocation(program, 'uNoiseTex'),
          uResolution: gl.getUniformLocation(program, 'uResolution'),
          uOrigin: gl.getUniformLocation(program, 'uOrigin'),
          uProgress: gl.getUniformLocation(program, 'uProgress'),
          uTime: gl.getUniformLocation(program, 'uTime'),
          uSeedOffset: gl.getUniformLocation(program, 'uSeedOffset'),
          uEmberGlow: gl.getUniformLocation(program, 'uEmberGlow'),
          uCharScale: gl.getUniformLocation(program, 'uCharScale'),
          uBurnWidth: gl.getUniformLocation(program, 'uBurnWidth'),
          uFlickerSpeed: gl.getUniformLocation(program, 'uFlickerSpeed'),
          uMaxDist: gl.getUniformLocation(program, 'uMaxDist')
        }
      };
      return glCtx;
    };

    // Gentle near-linear organic curve (avoids cubic stall-rush-stall feel)
    const easeSmooth = (t) => {
      const sine = 0.5 - 0.5 * Math.cos(Math.PI * t);
      return 0.45 * t + 0.55 * sine;
    };

    const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

    themeBtn.addEventListener('click', async (event) => {
      if (isTransitioning) return;

      const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      themeBtn.classList.remove('is-rippling');
      void themeBtn.offsetWidth;
      themeBtn.classList.add('is-rippling');
      window.setTimeout(() => themeBtn.classList.remove('is-rippling'), 600);

      if (reduceMotion) {
        applyTheme(next);
        return;
      }

      const engine = initEmberGL();
      if (!engine) {
        applyTheme(next);
        return;
      }

      const rect = themeBtn.getBoundingClientRect();
      const originX = event && event.clientX > 0 ? event.clientX : rect.left + rect.width / 2;
      const originY = event && event.clientY > 0 ? event.clientY : rect.top + rect.height / 2;

      isTransitioning = true;
      try {
        const [snapLib, fontCss] = await Promise.all([loadSnapLib(), loadEmbeddedFontCss()]);
        if (!snapLib) {
          applyTheme(next);
          return;
        }

        const bg = getComputedStyle(html).getPropertyValue('--bg').trim() || '#121110';
        const vw = html.clientWidth;
        const vh = html.clientHeight;
        const sx = window.scrollX;
        const sy = window.scrollY;
        const snapScale = Math.min(window.devicePixelRatio || 1, 1.5);

        const snapCanvas = await snapLib.domToCanvas(document.body, {
          width: vw,
          height: vh,
          scale: snapScale,
          backgroundColor: bg,
          features: {
            copyScrollbar: false,
            restoreScrollPosition: false
          },
          font: fontCss ? { cssText: fontCss } : { preferredFormat: 'woff2' },
          filter: (node) => {
            if (node instanceof Element) {
              if (node.id === 'emberBurnCanvas' || node.hasAttribute('data-html2canvas-ignore')) {
                return false;
              }
            }
            return true;
          },
          style: {
            margin: '0',
            width: `${vw}px`,
            height: `${vh}px`,
            minHeight: `${vh}px`,
            overflow: 'hidden',
            position: 'relative'
          },
          onCloneNode: (cloned) => {
            if (!(cloned instanceof HTMLElement)) return;
            // Clear frozen sub-pixel widths (including logical inline-size/block-size) on text-only labels & brand
            cloned.querySelectorAll('span, small, strong, time, .brand, .brand-text').forEach((el) => {
              if (el.matches('.brand, .brand-text') || (el.children.length === 0 && el.textContent && el.textContent.trim().length > 0)) {
                el.style.removeProperty('width');
                el.style.removeProperty('height');
                el.style.removeProperty('inline-size');
                el.style.removeProperty('block-size');
              }
            });
            if (sy > 0 || sx > 0) {
              const header = cloned.querySelector(':scope > .site-header');
              if (header) {
                header.style.position = 'relative';
                header.style.top = '0';
                header.style.zIndex = '40';
              }
              const mainEl = cloned.querySelector(':scope > main');
              if (mainEl) {
                mainEl.style.transform = `translate(${-sx}px, ${-sy}px)`;
              }
              const footerEl = cloned.querySelector(':scope > footer');
              if (footerEl) {
                footerEl.style.transform = `translate(${-sx}px, ${-sy}px)`;
              }
            }
          }
        });

        const { canvas, gl, program, tex, noiseTex, uniforms } = engine;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.floor(vw * dpr);
        canvas.height = Math.floor(vh * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapCanvas);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, noiseTex);

        const ox = originX * dpr;
        const oy = originY * dpr;
        const maxDist = Math.hypot(
          Math.max(ox, canvas.width - ox),
          Math.max(oy, canvas.height - oy)
        );
        const seedX = Math.random();
        const seedY = Math.random();

        const renderFrame = (progress, timeSec) => {
          gl.useProgram(program);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);

          gl.uniform1i(uniforms.uOldTex, 0);
          gl.uniform1i(uniforms.uNoiseTex, 1);
          gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
          gl.uniform2f(uniforms.uOrigin, ox, oy);
          gl.uniform1f(uniforms.uProgress, progress);
          gl.uniform1f(uniforms.uTime, timeSec);
          gl.uniform2f(uniforms.uSeedOffset, seedX, seedY);
          gl.uniform1f(uniforms.uEmberGlow, EMBER_PARAMS.emberGlow);
          gl.uniform1f(uniforms.uCharScale, EMBER_PARAMS.charScale);
          gl.uniform1f(uniforms.uBurnWidth, EMBER_PARAMS.burnWidth * dpr);
          gl.uniform1f(uniforms.uFlickerSpeed, EMBER_PARAMS.flickerSpeed);
          gl.uniform1f(uniforms.uMaxDist, maxDist);

          gl.drawArrays(gl.TRIANGLES, 0, 3);
        };

        // 1. Paint opaque frame 0 first so the canvas completely covers the old page
        renderFrame(0, 0);
        canvas.style.display = 'block';
        await nextFrame();

        // 2. Flip real DOM underneath & let browser finish full repaint before starting timer
        applyTheme(next);
        await nextFrame();
        await nextFrame();

        // 3. Start animation clock cleanly on a fresh vsync frame
        const totalMs = EMBER_PARAMS.duration * 1000;
        let startTime = null;

        await new Promise((resolve) => {
          const tick = (now) => {
            if (startTime === null) startTime = now;
            const elapsed = now - startTime;
            const rawT = Math.min(elapsed / totalMs, 1.0);
            const progress = easeSmooth(rawT);

            renderFrame(progress, elapsed * 0.001);

            if (rawT < 1.0) {
              requestAnimationFrame(tick);
            } else {
              resolve();
            }
          };
          requestAnimationFrame(tick);
        });
      } catch (err) {
        console.warn('Ember burn fallback:', err);
        if (html.dataset.theme !== next) applyTheme(next);
      } finally {
        if (engine && engine.canvas) engine.canvas.style.display = 'none';
        isTransitioning = false;
      }
    });
  }

  // 2. Mobile Navigation Toggle
  const navToggle = document.getElementById('headerNavBtn');
  const primaryNav = document.getElementById('primaryNav');
  if (navToggle && primaryNav) {
    const closeNav = () => {
      primaryNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    };
    navToggle.addEventListener('click', () => {
      const open = primaryNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    primaryNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeNav);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeNav();
    });
  }

  // 3. Header Search & '/' Shortcut
  const filterInput = document.getElementById('postFilterInput');
  const headerSearchBtn = document.getElementById('headerSearchBtn');

  function focusOrJumpSearch() {
    if (filterInput) {
      filterInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => filterInput.focus({ preventScroll: true }), 80);
      return;
    }
    const targetUrl = headerSearchBtn?.dataset.searchUrl;
    if (targetUrl) {
      window.location.href = targetUrl;
    }
  }

  if (headerSearchBtn) {
    headerSearchBtn.addEventListener('click', focusOrJumpSearch);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) {
      return;
    }
    e.preventDefault();
    focusOrJumpSearch();
  });

  if (filterInput && window.location.hash === '#filter') {
    setTimeout(() => filterInput.focus({ preventScroll: true }), 60);
  }

  // 4. Blog List Real-Time Search & Category Filter
  const blogGrid = document.getElementById('blogPostGrid');
  if (blogGrid && filterInput) {
    const cards = Array.from(blogGrid.querySelectorAll('[data-post-card]'));
    const chips = Array.from(document.querySelectorAll('#categoryChips .filter-chip'));
    const resultText = document.getElementById('filterResultText');
    const emptyState = document.getElementById('blogEmptyState');
    const resetBtn = document.getElementById('resetFilterBtn');
    const totalCount = cards.length;

    const params = new URLSearchParams(window.location.search);
    let activeCategories = params.get('category')
      ? params.get('category').split(',').map(s => s.trim()).filter(Boolean)
      : [];
    let activeTag = params.get('tag') ? params.get('tag').trim() : '';
    let searchQuery = params.get('q') || '';
    if (searchQuery) {
      filterInput.value = searchQuery;
    }

    function syncUrl() {
      const nextParams = new URLSearchParams();
      if (activeCategories.length > 0) {
        nextParams.set('category', activeCategories.join(','));
      }
      if (activeTag) {
        nextParams.set('tag', activeTag);
      }
      if (searchQuery.trim()) {
        nextParams.set('q', searchQuery.trim());
      }
      const query = nextParams.toString();
      const nextUrl = window.location.pathname + (query ? `?${query}` : '') + (window.location.hash || '');
      try {
        history.replaceState(null, '', nextUrl);
      } catch (_) {}
    }

    function updateChips() {
      const activeLower = new Set(activeCategories.map(c => c.toLowerCase()));
      chips.forEach(chip => {
        const cat = chip.dataset.cat;
        if (cat === 'all') {
          chip.classList.toggle('is-active', activeCategories.length === 0 && !activeTag);
        } else {
          chip.classList.toggle('is-active', activeLower.has(cat.toLowerCase()));
        }
      });
    }

    function applyFilter() {
      const q = searchQuery.trim().toLowerCase();
      const activeLower = activeCategories.map(c => c.toLowerCase());
      const tagLower = activeTag.toLowerCase();
      let visible = 0;

      cards.forEach(card => {
        const cardCats = (card.dataset.categories || '').split('|').map(s => s.trim().toLowerCase()).filter(Boolean);
        const cardTags = (card.dataset.tags || '').split('|').map(s => s.trim().toLowerCase()).filter(Boolean);
        const searchable = card.dataset.search || '';

        const matchCat = activeLower.length === 0 || cardCats.some(c => activeLower.includes(c));
        const matchTag = !tagLower || cardTags.includes(tagLower);
        const matchQ = !q || searchable.includes(q);
        const show = matchCat && matchTag && matchQ;

        card.hidden = !show;
        if (show) visible++;
      });

      if (resultText) {
        let label = `显示 ${visible} / ${totalCount} 篇文章`;
        if (activeCategories.length > 0) {
          label += ` · 分类：${activeCategories.join(' / ')}`;
        }
        if (activeTag) {
          label += ` · 标签：${activeTag}`;
        }
        resultText.textContent = label;
      }

      if (emptyState) {
        emptyState.classList.toggle('is-visible', visible === 0);
      }
    }

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const cat = chip.dataset.cat;
        activeTag = '';
        activeCategories = cat === 'all' ? [] : [cat];
        updateChips();
        applyFilter();
        syncUrl();
      });
    });

    filterInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      applyFilter();
      syncUrl();
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        activeCategories = [];
        activeTag = '';
        searchQuery = '';
        filterInput.value = '';
        updateChips();
        applyFilter();
        syncUrl();
      });
    }

    updateChips();
    applyFilter();
  }

  // 5. Article Detail Enhancements
  const articleContent = document.querySelector('.article-content');
  if (articleContent) {
    // 5a. Reading progress bar
    const progressBar = document.getElementById('readingProgress');
    if (progressBar) {
      let ticking = false;
      const updateProgress = () => {
        ticking = false;
        const rect = articleContent.getBoundingClientRect();
        const total = articleContent.offsetHeight - window.innerHeight * 0.65;
        const scrolled = -rect.top + window.innerHeight * 0.15;
        const pct = total <= 0 ? 100 : Math.min(100, Math.max(0, (scrolled / total) * 100));
        progressBar.style.width = `${pct.toFixed(1)}%`;
      };
      window.addEventListener('scroll', () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(updateProgress);
        }
      }, { passive: true });
      updateProgress();
    }

    // 5b. Wrap markdown tables (excluding code line-number tables) for horizontal scroll
    articleContent.querySelectorAll('table').forEach(table => {
      if (table.classList.contains('lntable') || table.closest('.highlight, .table-wrap')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrap';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    // 5c. Code Block Header + Copy Button + Safe Line Selection Copy
    const copyBlocks = [];

    async function copyText(text) {
      if (window.isSecureContext && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(text);
          return;
        } catch (_) {}
      }
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.readOnly = true;
      textarea.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.appendChild(textarea);
      try {
        textarea.focus({ preventScroll: true });
        textarea.select();
        if (!document.execCommand('copy')) throw new Error('copy failed');
      } finally {
        textarea.remove();
      }
    }

    function attachCodeHeader(container, codeEl, lang) {
      if (container.querySelector(':scope > .code-head')) return;
      const head = document.createElement('div');
      head.className = 'code-head';

      const langLabel = document.createElement('span');
      langLabel.textContent = (lang || 'TEXT').toUpperCase();

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.textContent = 'COPY';
      btn.setAttribute('aria-label', '复制代码');

      let timer;
      btn.addEventListener('click', async () => {
        clearTimeout(timer);
        try {
          let text = codeEl.textContent || '';
          if (text.endsWith('\n')) text = text.slice(0, -1);
          await copyText(text);
          btn.textContent = 'COPIED ✓';
        } catch (_) {
          btn.textContent = 'FAILED';
        }
        timer = setTimeout(() => { btn.textContent = 'COPY'; }, 1600);
      });

      head.append(langLabel, btn);
      container.prepend(head);
      copyBlocks.push({ container, code: codeEl });
    }

    articleContent.querySelectorAll('.highlight').forEach(highlight => {
      const codeEl = highlight.querySelector('code[data-lang]') || highlight.querySelector('td.lntd:last-child pre > code') || highlight.querySelector('pre > code');
      if (!codeEl) return;
      highlight.querySelectorAll('.lntd:first-child').forEach(gutter => gutter.setAttribute('aria-hidden', 'true'));
      attachCodeHeader(highlight, codeEl, codeEl.getAttribute('data-lang'));
    });

    articleContent.querySelectorAll('pre > code').forEach(codeEl => {
      if (codeEl.closest('.highlight')) return;
      const pre = codeEl.parentElement;
      const wrapper = document.createElement('div');
      wrapper.className = 'code-plain-wrap';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
      attachCodeHeader(wrapper, codeEl, codeEl.getAttribute('data-lang') || 'CODE');
    });

    document.addEventListener('copy', (event) => {
      if (!event.clipboardData) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return;
      const range = selection.getRangeAt(0);
      const block = copyBlocks.find(({ container }) => container.contains(range.commonAncestorContainer));
      if (!block || !range.intersectsNode(block.code)) return;

      const codeRange = document.createRange();
      codeRange.selectNodeContents(block.code);
      const selected = range.cloneRange();
      if (selected.compareBoundaryPoints(Range.START_TO_START, codeRange) < 0) {
        selected.setStart(codeRange.startContainer, codeRange.startOffset);
      }
      if (selected.compareBoundaryPoints(Range.END_TO_END, codeRange) > 0) {
        selected.setEnd(codeRange.endContainer, codeRange.endOffset);
      }
      event.clipboardData.setData('text/plain', selected.cloneContents().textContent);
      event.preventDefault();
    });

    // 5d. TOC Smooth Scroll & ScrollSpy
    const tocLinks = Array.from(document.querySelectorAll('.toc-rail #TableOfContents a, .mobile-toc #TableOfContents a'));
    const railLinks = Array.from(document.querySelectorAll('.toc-rail #TableOfContents a'));

    tocLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href || !href.startsWith('#')) return;
        const id = decodeURIComponent(href.slice(1));
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        const y = target.getBoundingClientRect().top + window.scrollY - 88;
        window.scrollTo({ top: y, behavior: 'smooth' });
        const mobileDetails = link.closest('details.mobile-toc');
        if (mobileDetails) mobileDetails.open = false;
      });
    });

    if (railLinks.length > 0) {
      const headings = railLinks
        .map(link => {
          const href = link.getAttribute('href');
          const id = href && href.startsWith('#') ? decodeURIComponent(href.slice(1)) : '';
          return { link, el: id ? document.getElementById(id) : null };
        })
        .filter(item => item.el);

      if (headings.length > 0) {
        let spyTick = false;
        const updateTocSpy = () => {
          spyTick = false;
          let current = headings[0];
          const offset = window.scrollY + 120;
          for (const item of headings) {
            if (item.el.offsetTop <= offset) current = item;
            else break;
          }
          railLinks.forEach(a => a.classList.toggle('is-current', a === current.link));
        };
        window.addEventListener('scroll', () => {
          if (!spyTick) {
            spyTick = true;
            requestAnimationFrame(updateTocSpy);
          }
        }, { passive: true });
        updateTocSpy();
      }
    }
  }
})();
