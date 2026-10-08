/**
 * assets/js/main.js - Academic Website Runtime
 * Light Mode Default, Zero Dashboard Bloat, Robust Academic Tools
 */

(function () {
  'use strict';

  // ========================================================
  // 1. THEME ENGINE (LIGHT MODE IS DEFAULT)
  // ========================================================
  const themeToggleBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('site_theme');

  // Light mode is default! Only enable dark if user explicitly chose it
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
    });
  }

  // ========================================================
  // 2. MULTILINGUAL ENGINE (PT & EN SPECIALIZED)
  // ========================================================
  let translationsCache = null;
  const currentLangCodeEl = document.getElementById('current-lang-code');
  const langBtn = document.getElementById('lang-btn');
  const langDropdown = document.getElementById('lang-dropdown');
  const savedLang = localStorage.getItem('site_lang') || 'pt';

  if (langBtn && langDropdown) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = langDropdown.classList.contains('open');
      langDropdown.classList.toggle('open', !isOpen);
      langBtn.setAttribute('aria-expanded', (!isOpen).toString());
    });

    document.addEventListener('click', () => {
      langDropdown.classList.remove('open');
      langBtn.setAttribute('aria-expanded', 'false');
    });
  }

  async function loadTranslations() {
    if (translationsCache) return translationsCache;
    try {
      const isPost = window.location.pathname.includes('/posts/');
      const translationsPath = isPost ? '../config/translations.json' : 'config/translations.json';
      const res = await fetch(translationsPath);
      if (res.ok) {
        translationsCache = await res.json();
      }
    } catch (err) {
      console.warn('Erro ao carregar traduções:', err);
    }
    return translationsCache;
  }

  async function applyLanguage(lang) {
    const dicts = await loadTranslations();
    if (!dicts || !dicts[lang]) return;

    const dict = dicts[lang];
    localStorage.setItem('site_lang', lang);
    if (currentLangCodeEl) {
      currentLangCodeEl.textContent = lang.toUpperCase();
    }

    // Update active button state
    document.querySelectorAll('.lang-switch-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });

    // Translate standard UI text
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    // Translate input placeholders
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      const key = el.getAttribute('data-i18n-ph');
      if (dict[key]) {
        el.setAttribute('placeholder', dict[key]);
      }
    });

    // Update html lang attribute
    document.documentElement.lang = lang;

    // Translate rich content (bio, titles, agenda descriptions) across all 5 languages
    document.querySelectorAll('[data-i18n-pt]').forEach((el) => {
      const specificText = el.getAttribute(`data-i18n-${lang}`);
      const enText = el.getAttribute('data-i18n-en');
      const ptText = el.getAttribute('data-i18n-pt');
      if (specificText) {
        el.textContent = specificText;
      } else if (enText && lang !== 'pt') {
        el.textContent = enText;
      } else if (ptText) {
        el.textContent = ptText;
      }
    });

    // Update abstract toggle buttons label using dictionary
    document.querySelectorAll('.abstract-toggle-btn').forEach((btn) => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      const abstractWord = dict.abstract || 'Resumo';
      btn.textContent = (isExpanded ? '- ' : '+ ') + abstractWord;
    });
  }

  document.querySelectorAll('.lang-opt, .lang-switch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      applyLanguage(lang);
      if (langDropdown) langDropdown.classList.remove('open');
    });
  });

  if (savedLang && savedLang !== 'pt') {
    applyLanguage(savedLang);
  }

  // ========================================================
  // 3. MOBILE HAMBURGER MENU
  // ========================================================
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navMenu = document.getElementById('nav-menu');

  if (hamburgerBtn && navMenu) {
    hamburgerBtn.addEventListener('click', () => {
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
      const currentLang = localStorage.getItem('site_lang') || 'pt';
      copyBtnLabel.textContent = currentLang === 'en' ? 'Copy' : 'Copiar';
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
        const currentLang = localStorage.getItem('site_lang') || 'pt';
        copyBtnLabel.textContent = currentLang === 'en' ? 'Copied!' : 'Copiado!';
        setTimeout(() => {
          copyBtnLabel.textContent = currentLang === 'en' ? 'Copy' : 'Copiar';
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
      const currentLang = localStorage.getItem('site_lang') || 'pt';

      if (isHidden) {
        block.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
        btn.textContent = currentLang === 'en' ? '- Abstract' : '- Resumo';
      } else {
        block.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = currentLang === 'en' ? '+ Abstract' : '+ Resumo';
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
  // 7. KATEX MATH FORMULA AUTO-RENDERER
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

})();
