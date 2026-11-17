/**
 * assets/js/main.js - Academic Website Runtime
 * Light Mode Default, Google Translate (PT <-> EN), Robust Academic Tools
 */

(function () {
  'use strict';

  // ========================================================
  // 1. THEME ENGINE (LIGHT MODE IS DEFAULT)
  // ========================================================
  const themeToggleBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('site_theme');

  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const isDark = document.body.classList.contains('dark');
      localStorage.setItem('site_theme', isDark ? 'dark' : 'light');
      const giscusFrame = document.querySelector('iframe.giscus-frame');
      if (giscusFrame && giscusFrame.contentWindow) {
        giscusFrame.contentWindow.postMessage(
          { giscus: { setConfig: { theme: isDark ? 'dark_dimmed' : 'light' } } },
          'https://giscus.app'
        );
      }
    });
  }

  // Mount Giscus comments lazily matched to active site theme
  const giscusMount = document.getElementById('giscus-container');
  if (giscusMount) {
    const s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    s.crossOrigin = 'anonymous';
    s.async = true;
    ['repo', 'repo-id', 'category', 'category-id', 'mapping', 'strict', 'reactions-enabled', 'emit-metadata', 'input-position', 'lang'].forEach((attr) => {
      const val = giscusMount.getAttribute('data-' + attr);
      if (val !== null) s.setAttribute('data-' + attr, val);
    });
    s.setAttribute('data-theme', document.body.classList.contains('dark') ? 'dark_dimmed' : 'light');
    s.setAttribute('data-loading', 'lazy');
    giscusMount.appendChild(s);
  }

  // ========================================================
  // 2. GOOGLE TRANSLATE ENGINE (PT <-> EN ONLY)
  // ========================================================
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function setGoogTransCookie(value) {
    const host = window.location.hostname;
    if (!value) {
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      if (host) {
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=.${host}; path=/;`;
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=${host}; path=/;`;
      }
      return;
    }
    document.cookie = `googtrans=${value}; path=/`;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      document.cookie = `googtrans=${value}; domain=.${host}; path=/`;
    }
  }

  function isEnglishActive() {
    return (
      getCookie('googtrans') === '/pt/en' ||
      document.documentElement.classList.contains('translated-ltr') ||
      localStorage.getItem('site_lang') === 'en'
    );
  }

  function updateLangButtons(lang) {
    document.querySelectorAll('.lang-switch-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  function triggerGoogleTranslate(targetLang) {
    let attempts = 0;
    const maxAttempts = 20;

    function trySelect() {
      const combo = document.querySelector('.goog-te-combo');
      if (combo) {
        combo.value = targetLang;
        combo.dispatchEvent(new Event('change'));
        return true;
      }
      return false;
    }

    if (trySelect()) return;

    const timer = setInterval(() => {
      attempts++;
      if (trySelect()) {
        clearInterval(timer);
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
        if (targetLang === 'en' && window.location.protocol.startsWith('http') && window.location.hostname !== 'localhost') {
          window.location.href = `https://translate.google.com/translate?sl=pt&tl=en&u=${encodeURIComponent(window.location.href)}`;
        }
      }
    }, 120);
  }

  window.googleTranslateElementInit = function () {
    if (window.google && window.google.translate && window.google.translate.TranslateElement) {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'pt',
          includedLanguages: 'en',
          autoDisplay: false
        },
        'google_translate_element'
      );

      if (localStorage.getItem('site_lang') === 'en' && getCookie('googtrans') !== '/pt/en') {
        setGoogTransCookie('/pt/en');
        triggerGoogleTranslate('en');
      }
    }
  };

  updateLangButtons(isEnglishActive() ? 'en' : 'pt');

  document.querySelectorAll('.lang-switch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      if (lang === 'en') {
        localStorage.setItem('site_lang', 'en');
        setGoogTransCookie('/pt/en');
        updateLangButtons('en');
        triggerGoogleTranslate('en');
      } else {
        localStorage.setItem('site_lang', 'pt');
        setGoogTransCookie('');
        updateLangButtons('pt');
        if (document.documentElement.classList.contains('translated-ltr') || getCookie('googtrans')) {
          window.location.reload();
        }
      }
    });
  });

  // ========================================================
  // 3. MOBILE HAMBURGER MENU
  // ========================================================
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navMenu = document.getElementById('nav-menu');

  if (hamburgerBtn && navMenu) {
    hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navMenu.classList.contains('open');
      navMenu.classList.toggle('open', !isOpen);
      hamburgerBtn.setAttribute('aria-expanded', (!isOpen).toString());
    });

    navMenu.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('open') && !navMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
        navMenu.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ========================================================
  // 4. CITATION MODAL ENGINE
  // ========================================================
  const citeModal = document.getElementById('cite-modal');
  const citeModalClose = document.getElementById('cite-modal-close');
  const citeTabs = document.querySelectorAll('.cite-tab-btn');
  const citeFormattedText = document.getElementById('cite-formatted-text');
  const citeCopyBtn = document.getElementById('cite-copy-btn');
  const copyBtnLabel = document.getElementById('copy-btn-label');
  const citeDownloadBtn = document.getElementById('cite-download-btn');

  let activeCitationData = null;
  let activeFormat = 'bibtex';

  function openCitationModal(citations) {
    activeCitationData = citations;
    activeFormat = 'bibtex';
    updateCitationDisplay();
    if (citeModal) {
      citeModal.classList.add('open');
      citeModal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeCitationModal() {
    if (citeModal) {
      citeModal.classList.remove('open');
      citeModal.setAttribute('aria-hidden', 'true');
    }
  }

  function updateCitationDisplay() {
    if (!activeCitationData || !citeFormattedText) return;

    citeTabs.forEach((tab) => {
      const fmt = tab.getAttribute('data-cite-format');
      tab.classList.toggle('active', fmt === activeFormat);
    });

    const text = activeCitationData[activeFormat] || activeCitationData.bibtex || '';
    citeFormattedText.textContent = text;

    if (copyBtnLabel) {
      copyBtnLabel.textContent = isEnglishActive() ? 'Copy' : 'Copiar';
    }
  }

  citeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activeFormat = tab.getAttribute('data-cite-format');
      updateCitationDisplay();
    });
  });

  if (citeModalClose) {
    citeModalClose.addEventListener('click', closeCitationModal);
  }

  if (citeCopyBtn && copyBtnLabel) {
    citeCopyBtn.addEventListener('click', async () => {
      const text = citeFormattedText ? citeFormattedText.textContent : '';
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const en = isEnglishActive();
        copyBtnLabel.textContent = en ? 'Copied!' : 'Copiado!';
        setTimeout(() => {
          copyBtnLabel.textContent = en ? 'Copy' : 'Copiar';
        }, 2000);
      } catch (err) {
        console.error('Falha ao copiar:', err);
      }
    });
  }

  if (citeDownloadBtn) {
    citeDownloadBtn.addEventListener('click', () => {
      if (!activeCitationData || !activeCitationData.bibtex) return;
      const blob = new Blob([activeCitationData.bibtex], { type: 'text/plain;charset=utf-8' });
      const filename = `${activeCitationData.citeKey || 'citation'}.bib`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  document.querySelectorAll('.cite-trigger-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const raw = btn.getAttribute('data-cite-info');
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        openCitationModal(data);
      } catch (e) {
        console.error('Dados de citação inválidos:', e);
      }
    });
  });

  // ========================================================
  // 5. ABSTRACT EXPANDER / COLLAPSER (DEFAULT COLLAPSED)
  // ========================================================
  document.querySelectorAll('.abstract-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.publication-entry');
      if (!parent) return;
      const block = parent.querySelector('.pub-abstract-text-block');
      if (!block) return;

      const isHidden = block.hasAttribute('hidden');
      const en = isEnglishActive();

      if (isHidden) {
        block.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
        btn.textContent = en ? '- Abstract' : '- Resumo';
      } else {
        block.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = en ? '+ Abstract' : '+ Resumo';
      }
    });
  });

  // ========================================================
  // 6. GLOBAL LIVE SEARCH MODAL (Ctrl+K or trigger)
  // ========================================================
  const searchModal = document.getElementById('search-modal');
  const searchModalClose = document.getElementById('search-modal-close');
  const searchTriggerBtn = document.getElementById('search-trigger');
  const globalSearchInput = document.getElementById('global-search-input');
  const searchResultsContainer = document.getElementById('search-results-container');

  let searchIndexCache = null;

  async function loadSearchIndex() {
    if (searchIndexCache) return searchIndexCache;
    try {
      const isPost = window.location.pathname.includes('/posts/');
      const indexPath = isPost ? '../search-index.json' : 'search-index.json';
      const res = await fetch(indexPath);
      if (res.ok) {
        searchIndexCache = await res.json();
      }
    } catch (e) {
      console.warn('Erro ao carregar índice de busca:', e);
    }
    return searchIndexCache || [];
  }

  function openSearchModal() {
    if (searchModal) {
      searchModal.classList.add('open');
      searchModal.setAttribute('aria-hidden', 'false');
      if (globalSearchInput) {
        setTimeout(() => globalSearchInput.focus(), 80);
      }
    }
  }

  function closeSearchModal() {
    if (searchModal) {
      searchModal.classList.remove('open');
      searchModal.setAttribute('aria-hidden', 'true');
      if (globalSearchInput) globalSearchInput.value = '';
      if (searchResultsContainer) {
        searchResultsContainer.innerHTML = '<p class="search-hint">Pressione ESC para fechar ou digite para pesquisar.</p>';
      }
    }
  }

  if (searchTriggerBtn) searchTriggerBtn.addEventListener('click', openSearchModal);
  if (searchModalClose) searchModalClose.addEventListener('click', closeSearchModal);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
      e.preventDefault();
      openSearchModal();
    }
    if (e.key === 'Escape') {
      closeSearchModal();
      closeCitationModal();
      if (navMenu && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded', 'false');
      }
    }
  });

  window.addEventListener('click', (e) => {
    if (e.target === citeModal) closeCitationModal();
    if (e.target === searchModal) closeSearchModal();
  });

  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', async () => {
      const query = globalSearchInput.value.trim().toLowerCase();
      const index = await loadSearchIndex();

      if (!query) {
        searchResultsContainer.innerHTML = '<p class="search-hint">Pressione ESC para fechar ou digite para pesquisar.</p>';
        return;
      }

      const isPost = window.location.pathname.includes('/posts/');
      const prefix = isPost ? '../' : '';

      const matched = index.filter((item) => {
        const titleMatch = (item.title || '').toLowerCase().includes(query);
        const snippetMatch = (item.snippet || '').toLowerCase().includes(query);
        const catMatch = (item.category || '').toLowerCase().includes(query);
        const tagMatch = (item.tags || []).some((t) => t.toLowerCase().includes(query));
        return titleMatch || snippetMatch || catMatch || tagMatch;
      });

      if (matched.length === 0) {
        searchResultsContainer.innerHTML = '<p class="search-hint">Nenhum resultado encontrado.</p>';
        return;
      }

      searchResultsContainer.innerHTML = matched.slice(0, 10).map((item) => {
        const itemUrl = item.url.startsWith('http') ? item.url : (prefix + item.url);
        return `
          <a class="search-result-item" href="${itemUrl}">
            <strong class="search-result-title">${item.title}</strong>
            <span class="search-result-snippet">${item.category || item.type} &bull; ${(item.snippet || '').substring(0, 110)}...</span>
          </a>
        `;
      }).join('');
    });
  }

  // ========================================================
  // 7. BLOG FILTERS
  // ========================================================
  const blogSearchInput = document.getElementById('blog-search-field');
  const filterPills = document.querySelectorAll('.filter-tag-pill');
  const postItems = document.querySelectorAll('#blog-stream .post-stream-item');

  let activeCat = 'all';

  function filterPosts() {
    if (!postItems.length) return;
    const query = blogSearchInput ? blogSearchInput.value.trim().toLowerCase() : '';

    postItems.forEach((item) => {
      const itemCat = (item.getAttribute('data-category') || '').toLowerCase();
      const text = item.textContent.toLowerCase();

      const matchesCat = activeCat === 'all' || itemCat === activeCat.toLowerCase();
      const matchesQuery = !query || text.includes(query);

      item.style.display = matchesCat && matchesQuery ? '' : 'none';
    });
  }

  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      filterPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      activeCat = pill.getAttribute('data-category') || 'all';
      filterPosts();
    });
  });

  if (blogSearchInput) {
    blogSearchInput.addEventListener('input', filterPosts);
  }

  // ========================================================
  // 8. KATEX MATH FORMULA AUTO-RENDERER
  // ========================================================
  function renderAllMath() {
    if (typeof renderMathInElement === 'function') {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAllMath);
  } else {
    renderAllMath();
  }
  window.addEventListener('load', renderAllMath);

  // ========================================================
  // 9. POST LATERAL TOC SCROLLSPY
  // ========================================================
  const tocAside = document.getElementById('post-toc-aside');
  const postHeadings = Array.from(document.querySelectorAll('.single-post-body h2[id], .single-post-body h3[id]'));
  const mobileToc = document.querySelector('.post-toc-mobile');

  if (mobileToc) {
    mobileToc.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => { mobileToc.open = false; });
    });
  }

  if (tocAside && postHeadings.length) {
    const tocLinks = Array.from(tocAside.querySelectorAll('.post-toc-link'));
    const setActiveToc = (id) => {
      tocLinks.forEach((lnk) => {
        const match = lnk.getAttribute('data-toc-target') === id;
        lnk.classList.toggle('active', match);
        if (match) {
          const nav = tocAside.querySelector('.post-toc-nav');
          if (nav) {
            const top = lnk.offsetTop - nav.clientHeight * 0.4;
            if (top < nav.scrollTop || top > nav.scrollTop + nav.clientHeight * 0.5) {
              nav.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            }
          }
        }
      });
    };

    const updateActiveHeading = () => {
      const offset = 112;
      let currentId = postHeadings[0].id;
      for (let i = 0; i < postHeadings.length; i++) {
        if (postHeadings[i].getBoundingClientRect().top <= offset) {
          currentId = postHeadings[i].id;
        } else {
          break;
        }
      }
      if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 24) {
        currentId = postHeadings[postHeadings.length - 1].id;
      }
      setActiveToc(currentId);
    };

    let tocRaf = null;
    window.addEventListener('scroll', () => {
      if (tocRaf !== null) return;
      tocRaf = requestAnimationFrame(() => {
        tocRaf = null;
        updateActiveHeading();
      });
    }, { passive: true });
    updateActiveHeading();
  }

})();
