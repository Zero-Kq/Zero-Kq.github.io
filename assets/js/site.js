(() => {
  const html = document.documentElement;
  const THEME_KEY = 'zero-theme';

  // 1. Theme Toggle (Irregular Ink Bleed via View Transitions API)
  const themeBtn = document.getElementById('headerThemeBtn');
  if (themeBtn) {
    let isTransitioning = false;
    let seedCounter = Math.floor(Math.random() * 80) + 1;

    const applyTheme = (next) => {
      html.dataset.theme = next;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('zero:themechange', { detail: { theme: next } }));
    };

    // Build an organic, multi-lobed ink-blot SVG mask with paper-fiber turbulence
    const buildInkMaskDataUri = (seed) => {
      const size = 512;
      const cx = size / 2;
      const cy = size / 2;
      const baseR = 138;
      const pts = 72;

      // Deterministic pseudo-random phases from seed
      const rand = (n) => {
        const s = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
        return s - Math.floor(s);
      };
      const p1 = rand(1) * Math.PI * 2;
      const p2 = rand(2) * Math.PI * 2;
      const p3 = rand(3) * Math.PI * 2;
      const p4 = rand(4) * Math.PI * 2;
      const p5 = rand(5) * Math.PI * 2;

      const coords = [];
      for (let i = 0; i < pts; i++) {
        const a = (i / pts) * Math.PI * 2;
        const lobe =
          1 +
          0.22 * Math.sin(3 * a + p1) +
          0.16 * Math.sin(5 * a + p2) +
          0.11 * Math.sin(7 * a + p3) +
          0.08 * Math.sin(11 * a + p4) +
          0.05 * Math.sin(17 * a + p5);
        const r = baseR * lobe;
        coords.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }

      // Smooth closed quadratic curve path
      let d = '';
      for (let i = 0; i < pts; i++) {
        const curr = coords[i];
        const nextPt = coords[(i + 1) % pts];
        const mx = (curr[0] + nextPt[0]) / 2;
        const my = (curr[1] + nextPt[1]) / 2;
        if (i === 0) {
          const prev = coords[pts - 1];
          const sx = (prev[0] + curr[0]) / 2;
          const sy = (prev[1] + curr[1]) / 2;
          d += `M${sx.toFixed(1)},${sy.toFixed(1)}`;
        }
        d += `Q${curr[0].toFixed(1)},${curr[1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
      }
      d += 'Z';

      // Subtle satellite ink droplets near the organic boundary
      let droplets = '';
      for (let i = 0; i < 9; i++) {
        const a = rand(10 + i) * Math.PI * 2;
        const dist = baseR * (1.16 + rand(30 + i) * 0.28);
        const dr = 5 + rand(50 + i) * 11;
        const dx = cx + Math.cos(a) * dist;
        const dy = cy + Math.sin(a) * dist;
        droplets += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${dr.toFixed(1)}" fill="#fff"/>`;
      }

      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
        `<defs><filter id="ink" x="-30%" y="-30%" width="160%" height="160%">` +
        `<feTurbulence type="turbulence" baseFrequency="0.016" numOctaves="4" seed="${seed}" result="coarse"/>` +
        `<feDisplacementMap in="SourceGraphic" in2="coarse" scale="52" xChannelSelector="R" yChannelSelector="G" result="d1"/>` +
        `<feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="3" seed="${seed + 19}" result="fine"/>` +
        `<feDisplacementMap in="d1" in2="fine" scale="18" xChannelSelector="R" yChannelSelector="G" result="d2"/>` +
        `<feGaussianBlur in="d2" stdDeviation="1.4" result="b"/>` +
        `<feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"/>` +
        `</filter></defs>` +
        `<g filter="url(#ink)"><path d="${d}" fill="#fff"/>${droplets}</g>` +
        `</svg>`;
      return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    };

    themeBtn.addEventListener('click', (event) => {
      if (isTransitioning) return;

      const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      themeBtn.classList.remove('is-rippling');
      void themeBtn.offsetWidth;
      themeBtn.classList.add('is-rippling');
      window.setTimeout(() => themeBtn.classList.remove('is-rippling'), 600);

      if (!document.startViewTransition || reduceMotion) {
        applyTheme(next);
        return;
      }

      const rect = themeBtn.getBoundingClientRect();
      const x = event && event.clientX > 0 ? event.clientX : rect.left + rect.width / 2;
      const y = event && event.clientY > 0 ? event.clientY : rect.top + rect.height / 2;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxRadius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));
      // Minimum guaranteed inner opaque radius of the irregular ink blot is ~0.135 of mask width
      const endSize = Math.ceil(maxRadius / 0.135);

      seedCounter = (seedCounter % 97) + 1;
      html.style.setProperty('--vt-ink-mask', buildInkMaskDataUri(seedCounter));
      html.style.setProperty('--vt-origin-x', `${x}px`);
      html.style.setProperty('--vt-origin-y', `${y}px`);
      html.classList.add('theme-transitioning');
      isTransitioning = true;

      let transition;
      try {
        transition = document.startViewTransition(() => {
          applyTheme(next);
        });
      } catch (_) {
        html.classList.remove('theme-transitioning');
        isTransitioning = false;
        applyTheme(next);
        return;
      }

      transition.ready.then(() => {
        const anim = document.documentElement.animate(
          [
            {
              maskSize: '0px 0px',
              maskPosition: `${x}px ${y}px`,
              WebkitMaskSize: '0px 0px',
              WebkitMaskPosition: `${x}px ${y}px`
            },
            {
              maskSize: `${endSize}px ${endSize}px`,
              maskPosition: `${x - endSize / 2}px ${y - endSize / 2}px`,
              WebkitMaskSize: `${endSize}px ${endSize}px`,
              WebkitMaskPosition: `${x - endSize / 2}px ${y - endSize / 2}px`
            }
          ],
          {
            duration: 1400,
            easing: 'cubic-bezier(0.32, 0.05, 0.18, 1)',
            pseudoElement: '::view-transition-new(root)',
            fill: 'forwards'
          }
        );
        return anim.finished.catch(() => {});
      }).catch(() => {});

      transition.finished.finally(() => {
        html.classList.remove('theme-transitioning');
        html.style.removeProperty('--vt-ink-mask');
        html.style.removeProperty('--vt-origin-x');
        html.style.removeProperty('--vt-origin-y');
        isTransitioning = false;
      });
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
