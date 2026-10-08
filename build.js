/**
 * build.js - Static Site Generator for Academic Personal Website
 * Content-driven, Light Mode Default, Zero Dashboard Bloat, Zero Placeholders.
 * Compatible with GitHub Pages. Zero external npm dependencies.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('./lib/js-yaml.js');

const ROOT_DIR = __dirname;
const CONFIG_DIR = path.join(ROOT_DIR, 'config');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const POSTS_DIR = fs.existsSync(path.join(ROOT_DIR, '_posts')) ? path.join(ROOT_DIR, '_posts') : path.join(ROOT_DIR, 'content', 'blog');
const POSTS_OUT_DIR = path.join(ROOT_DIR, 'posts');

if (!fs.existsSync(POSTS_OUT_DIR)) {
  fs.mkdirSync(POSTS_OUT_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Helper: Load YAML with fallback to JSON
function loadYamlOrJson(possiblePaths, defaultVal = {}) {
  for (const rel of possiblePaths) {
    const full = path.join(ROOT_DIR, rel);
    if (fs.existsSync(full)) {
      try {
        const raw = fs.readFileSync(full, 'utf-8');
        if (rel.endsWith('.yml') || rel.endsWith('.yaml')) {
          const parsed = yaml.load(raw);
          if (parsed !== undefined && parsed !== null) return parsed;
        } else if (rel.endsWith('.json')) {
          return JSON.parse(raw);
        }
      } catch (e) {
        console.warn(`[AVISO] Erro ao ler ${rel}:`, e.message);
      }
    }
  }
  return defaultVal;
}

// Helper: Load Translations from _i18n/*.yml or fallback to config/translations.json
function loadTranslations() {
  const tr = {};
  const i18nDir = path.join(ROOT_DIR, '_i18n');
  if (fs.existsSync(i18nDir)) {
    const files = fs.readdirSync(i18nDir).filter(f => (f.endsWith('.yml') || f.endsWith('.yaml') || f.endsWith('.json')) && !f.startsWith('_'));
    for (const file of files) {
      const lang = file.replace(/\.(yml|yaml|json)$/, '');
      const raw = fs.readFileSync(path.join(i18nDir, file), 'utf-8');
      try {
        if (file.endsWith('.json')) {
          tr[lang] = JSON.parse(raw);
        } else {
          tr[lang] = yaml.load(raw) || {};
        }
      } catch (e) {
        console.warn(`[AVISO] Erro ao carregar tradução ${file}:`, e.message);
      }
    }
  }
  if (Object.keys(tr).length === 0) {
    const jsonPath = path.join(CONFIG_DIR, 'translations.json');
    if (fs.existsSync(jsonPath)) {
      return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }
  }
  return tr;
}

// 1. Load Configurations and Data (Single Sources of Truth!)
const siteConfig = loadYamlOrJson(['data/profile.yml', '_data/profile.yml', 'config/site.json', '_config.yml'], {});
const rawPubs = loadYamlOrJson(['data/publications.yml', '_data/publications.yml', 'data/publications.json'], []);
const rawCourses = loadYamlOrJson(['data/teaching.yml', '_data/teaching.yml', 'data/courses.json'], { courses: [], assistantships: [] });
const rawProjects = loadYamlOrJson(['data/projects.yml', '_data/projects.yml', 'data/projects.json'], []);
const cvData = loadYamlOrJson(['data/cv.yml', '_data/cv.yml', 'data/cv.json'], { education: [], experience: [], skills: [], languages: [] });
const translations = loadTranslations();

// Normalize siteConfig: ensure social.email always mirrors email
if (siteConfig.email) {
  siteConfig.social = siteConfig.social || {};
  siteConfig.social.email = 'mailto:' + siteConfig.email;
}

// Normalize Data Structures so users have full freedom of syntax
const publications = (Array.isArray(rawPubs) ? rawPubs : []).map(p => {
  let authors = p.authors;
  if (typeof authors === 'string') {
    authors = authors.split(/,| e | and /i).map(s => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(authors) || authors.length === 0) {
    authors = [siteConfig.name || 'Bruno Castro Alves'];
  }
  
  let cat = (p.category || p.type || 'working_paper').toLowerCase();
  if (cat.includes('journal') || cat.includes('periódico') || cat.includes('periodico') || cat.includes('artigo')) cat = 'journal_article';
  else if (cat.includes('conference') || cat.includes('congresso') || cat.includes('anais')) cat = 'conference_paper';
  else if (cat.includes('monograph') || cat.includes('tcc') || cat.includes('dissertação') || cat.includes('tese')) cat = 'monograph';
  else if (cat.includes('progress') || cat.includes('elaboração')) cat = 'work_in_progress';
  else cat = 'working_paper';

  return {
    ...p,
    authors,
    category: cat,
    year: Number(p.year) || new Date().getFullYear(),
    selected: p.selected !== false
  };
});

const coursesData = Array.isArray(rawCourses) ? { courses: rawCourses, assistantships: [] } : {
  courses: rawCourses.courses || [],
  assistantships: rawCourses.assistantships || []
};

const projects = Array.isArray(rawProjects) ? rawProjects : [];

// Helper: Parse YAML front matter using rock-solid js-yaml
function parseFrontMatter(fileContent) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: fileContent };
  }
  try {
    const data = yaml.load(match[1]) || {};
    return { data, content: match[2] };
  } catch (err) {
    console.warn('[AVISO] Falha ao analisar front matter YAML, usando fallback:', err.message);
    return { data: {}, content: match[2] };
  }
}

// Helper: Convert Markdown to HTML
function markdownToHtml(md) {
  if (!md) return '';
  let html = md;

  // Math blocks
  const mathBlocks = [];
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (m, eq) => {
    mathBlocks.push(`<div class="math-display">$$${eq}$$</div>`);
    return `<!--MATH_${mathBlocks.length - 1}-->`;
  });
  html = html.replace(/\$([^\$\n]+?)\$/g, (m, eq) => {
    mathBlocks.push(`<span class="math-inline">$${eq}$</span>`);
    return `<!--MATH_${mathBlocks.length - 1}-->`;
  });

  // Code blocks
  html = html.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (m, lang, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre class="code-block"><code>${escaped}</code></pre>`;
  });

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>'); // Avoid accidental second h1

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote><p>$1</p></blockquote>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Lists
  html = html.replace(/^\s*-\s+(.*)$/gim, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  // Paragraphs
  const blocks = html.split(/\r?\n\r?\n/);
  html = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<pre') ||
        trimmed.startsWith('<blockquote') || trimmed.startsWith('<div') || trimmed.startsWith('<!--MATH_')) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\r?\n/g, '<br>')}</p>`;
  }).join('\n\n');

  // Restore Math
  mathBlocks.forEach((mHtml, idx) => {
    html = html.replace(new RegExp(`<!--MATH_${idx}-->`, 'g'), mHtml);
  });

  return html;
}

// 2. Load Blog Posts from Markdown & Sync data/posts.json
// IMPORTANT: Ignore templates, README, and hidden/draft files
const blogPostFiles = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md') && !f.startsWith('_') && !f.startsWith('.') && f !== 'README.md');
const compiledPosts = [];

blogPostFiles.forEach(file => {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
  const { data, content } = parseFrontMatter(raw);
  const slug = file.replace(/\.md$/, '');
  const words = content.trim().split(/\s+/).length;
  const readingTime = data.reading_time || Math.max(1, Math.round(words / 200));

  let postDate = '';
  if (data.date instanceof Date) {
    const y = data.date.getUTCFullYear();
    const m = String(data.date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(data.date.getUTCDate()).padStart(2, '0');
    postDate = `${y}-${m}-${d}`;
  } else if (typeof data.date === 'string') {
    postDate = data.date.trim().slice(0, 10);
  } else if (data.date) {
    postDate = String(data.date).slice(0, 10);
  } else {
    const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
    postDate = dateMatch ? dateMatch[1] : todayISO;
  }

  compiledPosts.push({
    id: slug,
    title: data.title || slug,
    date: postDate,
    category: data.category || 'Macroeconomia',
    tags: Array.isArray(data.tags) ? data.tags : (typeof data.tags === 'string' ? [data.tags] : []),
    summary: data.summary || data.description || '',
    reading_time: readingTime,
    featured: data.featured === true,
    slug: slug,
    url: `posts/${slug}.html`,
    rawContent: content,
    htmlContent: markdownToHtml(content)
  });
});

compiledPosts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

// Save synchronized JSON files for maximum ecosystem compatibility
fs.writeFileSync(path.join(DATA_DIR, 'posts.json'), JSON.stringify(compiledPosts.map(p => ({
  id: p.id,
  title: p.title,
  date: p.date,
  category: p.category,
  tags: p.tags,
  summary: p.summary,
  reading_time: p.reading_time,
  featured: p.featured,
  slug: p.slug,
  url: p.url
})), null, 2));

fs.writeFileSync(path.join(CONFIG_DIR, 'site.json'), JSON.stringify(siteConfig, null, 2));
fs.writeFileSync(path.join(CONFIG_DIR, 'translations.json'), JSON.stringify(translations, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'publications.json'), JSON.stringify(publications, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'projects.json'), JSON.stringify(projects, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'courses.json'), JSON.stringify(coursesData, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'cv.json'), JSON.stringify(cvData, null, 2));

// Auto-generate _config.yml from siteConfig (data/profile.yml is the single source of truth!)
const generatedConfigYml = `# ========================================================
# ARQUIVO GERADO AUTOMATICAMENTE A PARTIR DE data/profile.yml
# NAO EDITE ESTE ARQUIVO DIRETAMENTE!
# Edite data/profile.yml e execute 'node build.js'
# ========================================================
title: "${siteConfig.name || 'Bruno Castro Alves'}"
email: "${siteConfig.email || ''}"
description: "${siteConfig.bio_short || ''}"
baseurl: "${siteConfig.baseurl || ''}"
url: "${siteConfig.site_url || ''}"
theme: jekyll-theme-cayman
`;
fs.writeFileSync(path.join(ROOT_DIR, '_config.yml'), generatedConfigYml);

// ========================================================
// VALIDATION STEP: Fail on placeholders, bad dates or broken paths
// ========================================================
const todayISO = new Date().toISOString().slice(0, 10);
function runDataValidation() {
  const forbidden = [
    'seu' + '-usuario',
    'seu' + '-email',
    '10.1016/j.jmacro' + '.2026.01.002',
    '0000-0000' + '-0000-0000'
  ];

  // Check publications
  publications.forEach(p => {
    const raw = JSON.stringify(p);
    for (const token of forbidden) {
      if (raw.includes(token)) {
        throw new Error(`[VALIDAÇÃO] Token proibido "${token}" encontrado na publicação id="${p.id}"`);
      }
    }
    if (p.pdf && (p.pdf.startsWith('static/papers/') || p.pdf.startsWith('assets/papers/'))) {
      const localPdf = path.join(ROOT_DIR, p.pdf);
      if (!fs.existsSync(localPdf)) {
        console.warn(`[AVISO] Arquivo PDF local não encontrado: ${p.pdf} (a URL pode ser online ou inserida posteriormente).`);
      }
    }
  });

  // Check posts
  compiledPosts.forEach(p => {
    if (p.date && p.date > todayISO) {
      throw new Error(`[VALIDAÇÃO] Data futura não permitida no post "${p.title}": ${p.date} > ${todayISO}`);
    }
    const raw = JSON.stringify(p);
    for (const token of forbidden) {
      if (raw.includes(token)) {
        throw new Error(`[VALIDAÇÃO] Token proibido "${token}" encontrado no post slug="${p.slug}"`);
      }
    }
  });

  // Check projects
  projects.forEach(pr => {
    const raw = JSON.stringify(pr);
    for (const token of forbidden) {
      if (raw.includes(token)) {
        throw new Error(`[VALIDAÇÃO] Token proibido "${token}" encontrado no projeto id="${pr.id}"`);
      }
    }
  });

  console.log('✓ [VALIDAÇÃO] Todos os dados, datas e publicações validados com sucesso!');
}
runDataValidation();

// Generate Citations for Publications (Supporting Monographs, Conferences, Articles, Working Papers)
function computeCitations(pub) {
  const authorsArr = Array.isArray(pub.authors) && pub.authors.length > 0 ? pub.authors : [siteConfig.name];
  const title = pub.title || '';
  const year = pub.year || new Date().getFullYear();
  const citeKey = pub.id || (authorsArr[0].split(' ').pop().toLowerCase() + year);
  const cat = pub.category || 'working_paper';

  // 1. BibTeX
  let bibtex = '';
  if (cat === 'monograph' || cat === 'thesis') {
    bibtex = `@mastersthesis{${citeKey},
  author  = {${authorsArr.join(' and ')}},
  title   = {${title}},
  school  = {${pub.publisher || 'Universidade Federal do Delta do Parnaíba (UFDPar)'}},
  year    = {${year}},
  type    = {Trabalho de Conclusão de Curso (Graduação em Ciências Econômicas)}
}`;
  } else if (cat === 'conference_paper') {
    bibtex = `@inproceedings{${citeKey},
  author    = {${authorsArr.join(' and ')}},
  title     = {${title}},
  booktitle = {${pub.journal || pub.venue}},
  year      = {${year}}${pub.publisher ? `,\n  publisher = {${pub.publisher}}` : ''}${pub.doi ? `,\n  doi       = {${pub.doi}}` : ''}
}`;
  } else if (cat === 'journal_article') {
    bibtex = `@article{${citeKey},
  author  = {${authorsArr.join(' and ')}},
  title   = {${title}},
  journal = {${pub.journal || pub.venue}},
  year    = {${year}}${pub.volume ? `,\n  volume  = {${pub.volume}}` : ''}${pub.pages ? `,\n  pages   = {${pub.pages}}` : ''}${pub.doi ? `,\n  doi     = {${pub.doi}}` : ''}
}`;
  } else {
    // working_paper or work_in_progress
    bibtex = `@techreport{${citeKey},
  author      = {${authorsArr.join(' and ')}},
  title       = {${title}},
  institution = {${pub.publisher || 'Universidade Federal do Delta do Parnaíba (UFDPar)'}},
  year        = {${year}},
  type        = {Working Paper}
}`;
  }

  // Helper for author names
  function formatAuthorAbnt(name) {
    const parts = name.trim().split(/\s+/);
    const last = parts.pop().toUpperCase();
    return `${last}, ${parts.join(' ')}`;
  }
  function formatAuthorApa(name) {
    const parts = name.trim().split(/\s+/);
    const last = parts.pop();
    const inits = parts.map(p => p[0] + '.').join(' ');
    return `${last}, ${inits}`;
  }

  // 2. ABNT
  const abntAuthors = authorsArr.map(formatAuthorAbnt).join('; ');
  const venueText = pub.journal || pub.venue || 'Working Paper';
  const abnt = `${abntAuthors}. ${title}. ${venueText}, ${year}.${pub.doi ? ` DOI: https://doi.org/${pub.doi}.` : ''}`;

  // 3. APA 7
  let apaAuthors = '';
  if (authorsArr.length === 1) {
    apaAuthors = formatAuthorApa(authorsArr[0]);
  } else if (authorsArr.length === 2) {
    apaAuthors = `${formatAuthorApa(authorsArr[0])}, & ${formatAuthorApa(authorsArr[1])}`;
  } else {
    apaAuthors = authorsArr.slice(0, -1).map(formatAuthorApa).join(', ') + `, & ${formatAuthorApa(authorsArr[authorsArr.length - 1])}`;
  }
  const apa = `${apaAuthors} (${year}). ${title}. ${venueText}.${pub.doi ? ` https://doi.org/${pub.doi}` : ''}`;

  // 4. Chicago
  const chicago = `${authorsArr.join(', ')}. ${year}. "${title}." ${venueText}.${pub.doi ? ` https://doi.org/${pub.doi}.` : ''}`;

  // 5. MLA 9
  const mla = `${formatAuthorAbnt(authorsArr[0])}${authorsArr.length > 1 ? ', et al.' : ''}. "${title}." ${venueText}, ${year}.`;

  // 6. IEEE
  const ieee = `${authorsArr.map(a => {
    const p = a.trim().split(/\s+/);
    const last = p.pop();
    return p.map(x => x[0] + '.').join(' ') + ' ' + last;
  }).join(', ')}, "${title}," ${venueText}, ${year}.`;

  return { citeKey, bibtex, abnt, apa, chicago, mla, ieee };
}

publications.forEach(pub => {
  pub.citations = computeCitations(pub);
});

// 4. Global Search Index
const searchIndex = [
  ...compiledPosts.map(p => ({
    type: 'blog',
    title: p.title,
    category: p.category || 'Blog',
    tags: p.tags || [],
    date: p.date,
    url: p.url,
    snippet: p.summary
  })),
  ...publications.map(p => ({
    type: 'publication',
    title: p.title,
    category: p.journal || p.venue || 'Publicação',
    tags: p.keywords || [],
    date: p.year?.toString() || '',
    url: `publications.html#${p.id}`,
    snippet: p.abstract
  })),
  ...projects.map(p => ({
    type: 'project',
    title: p.title,
    category: p.category || 'Projeto',
    tags: p.technologies || [],
    date: '',
    url: `projects.html#${p.id}`,
    snippet: p.description
  })),
  ...(coursesData.courses || []).map(c => ({
    type: 'teaching',
    title: c.name,
    category: 'Ensino',
    tags: [c.code, c.period],
    date: c.period,
    url: `teaching.html#${c.id}`,
    snippet: c.description
  }))
];

fs.writeFileSync(path.join(ROOT_DIR, 'search-index.json'), JSON.stringify(searchIndex, null, 2));

// 5. HTML TEMPLATE ENGINE
function renderHeader(activePage = 'home', depth = 0) {
  const prefix = depth > 0 ? '../' : '';

  return `
    <header class="site-header" role="banner">
      <div class="site-header-inner">
        <div class="brand">
          <a class="brand-link" href="${prefix}index.html">
            <span class="brand-name">${siteConfig.name}</span>
          </a>
        </div>

        <nav class="nav-menu" id="nav-menu" role="navigation" aria-label="Navegação principal">
          <ul class="nav-list">
            <li><a class="nav-link ${activePage === 'home' ? 'active' : ''}" href="${prefix}index.html" data-i18n="nav_home">Início</a></li>
            <li><a class="nav-link ${activePage === 'research' ? 'active' : ''}" href="${prefix}research.html" data-i18n="nav_research">Pesquisa</a></li>
            <li><a class="nav-link ${activePage === 'teaching' ? 'active' : ''}" href="${prefix}teaching.html" data-i18n="nav_teaching">Ensino</a></li>
            <li><a class="nav-link ${activePage === 'projects' ? 'active' : ''}" href="${prefix}projects.html" data-i18n="nav_projects">Projetos</a></li>
            <li><a class="nav-link ${activePage === 'blog' ? 'active' : ''}" href="${prefix}blog.html" data-i18n="nav_blog">Blog</a></li>
            <li><a class="nav-link ${activePage === 'cv' ? 'active' : ''}" href="${prefix}cv.html" data-i18n="nav_cv">CV</a></li>
          </ul>
        </nav>

        <div class="header-controls">
          <!-- Multilingual Switcher (5 Languages: PT / EN / ES / DE / ZH) -->
          <div class="lang-switch-wrap" role="group" aria-label="Idioma / Language">
            <button class="lang-switch-btn active" type="button" data-lang="pt" aria-label="Português">PT</button>
            <span class="lang-sep">/</span>
            <button class="lang-switch-btn" type="button" data-lang="en" aria-label="English">EN</button>
            <span class="lang-sep">/</span>
            <button class="lang-switch-btn" type="button" data-lang="es" aria-label="Español">ES</button>
            <span class="lang-sep">/</span>
            <button class="lang-switch-btn" type="button" data-lang="de" aria-label="Deutsch">DE</button>
            <span class="lang-sep">/</span>
            <button class="lang-switch-btn" type="button" data-lang="zh" aria-label="中文">ZH</button>
          </div>

          <!-- Light/Dark Mode Switcher -->
          <button class="control-btn theme-toggle" id="theme-toggle" type="button" aria-label="Alternar tema" title="Alternar tema">
            <svg class="icon icon-sun" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <svg class="icon icon-moon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          </button>

          <!-- Search Trigger -->
          <button class="control-btn search-trigger" id="search-trigger" type="button" aria-label="Buscar" title="Buscar (Ctrl+K)">
            <svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>

          <!-- Hamburger -->
          <button class="control-btn hamburger" id="hamburger-btn" type="button" aria-label="Menu">
            <span class="bar"></span>
            <span class="bar"></span>
            <span class="bar"></span>
          </button>
        </div>
      </div>
    </header>
  `;
}

function renderFooter() {
  return `
    <footer class="site-footer" role="contentinfo">
      <div class="site-footer-inner">
        <div class="footer-institutional">
          <span class="footer-name">${siteConfig.name}</span>
          <span data-i18n-pt="${siteConfig.title} &bull; ${siteConfig.institution}" data-i18n-en="${siteConfig.title_en} &bull; ${siteConfig.institution_en}" data-i18n-es="${siteConfig.title_es || siteConfig.title} &bull; ${siteConfig.institution_es || siteConfig.institution}" data-i18n-de="${siteConfig.title_de || siteConfig.title} &bull; ${siteConfig.institution_de || siteConfig.institution}" data-i18n-zh="${siteConfig.title_zh || siteConfig.title} &bull; ${siteConfig.institution_zh || siteConfig.institution}">${siteConfig.title} &bull; ${siteConfig.institution}</span>
          <span data-i18n-pt="${siteConfig.location}" data-i18n-en="${siteConfig.location_en}" data-i18n-es="${siteConfig.location_es || siteConfig.location}" data-i18n-de="${siteConfig.location_de || siteConfig.location}" data-i18n-zh="${siteConfig.location_zh || siteConfig.location}">${siteConfig.location}</span>
        </div>
        <div class="footer-links-bar">
          ${siteConfig.social && siteConfig.social.lattes ? `<a href="${siteConfig.social.lattes}" target="_blank" rel="noreferrer">Lattes</a>` : ''}
          ${siteConfig.social && siteConfig.social.google_scholar ? `<a href="${siteConfig.social.google_scholar}" target="_blank" rel="noreferrer">Google Scholar</a>` : ''}
          ${siteConfig.social && siteConfig.social.orcid ? `<a href="${siteConfig.social.orcid}" target="_blank" rel="noreferrer">ORCID</a>` : ''}
          ${siteConfig.social && siteConfig.social.github ? `<a href="${siteConfig.social.github}" target="_blank" rel="noreferrer">GitHub</a>` : ''}
          ${siteConfig.social && siteConfig.social.linkedin ? `<a href="${siteConfig.social.linkedin}" target="_blank" rel="noreferrer">LinkedIn</a>` : ''}
          ${siteConfig.social && siteConfig.social.instagram ? `<a href="${siteConfig.social.instagram}" target="_blank" rel="noreferrer">Instagram</a>` : ''}
          ${siteConfig.social && siteConfig.social.email ? `<a href="${siteConfig.social.email}">E-mail</a>` : ''}
        </div>
      </div>
      <div class="site-footer-inner" style="margin-top: 18px; font-size: 0.82rem;">
        <span data-i18n="footer_static_note">Página acadêmica pessoal de Bruno Castro Alves.</span>
        <span>&copy; ${new Date().getFullYear()} ${siteConfig.name}.</span>
      </div>
    </footer>
  `;
}

function renderModals() {
  return `
    <!-- Citation Modal -->
    <div class="cite-modal-backdrop" id="cite-modal" aria-hidden="true">
      <div class="cite-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="cite-modal-title">
        <div class="cite-modal-header">
          <h3 class="cite-modal-title" id="cite-modal-title" data-i18n="cite">Citar publicação</h3>
          <button class="cite-close-btn" id="cite-modal-close" type="button">&times;</button>
        </div>
        <div class="cite-modal-tabs">
          <button class="cite-tab-btn active" data-cite-format="bibtex">BibTeX</button>
          <button class="cite-tab-btn" data-cite-format="abnt">ABNT</button>
          <button class="cite-tab-btn" data-cite-format="apa">APA 7</button>
          <button class="cite-tab-btn" data-cite-format="chicago">Chicago</button>
          <button class="cite-tab-btn" data-cite-format="mla">MLA 9</button>
          <button class="cite-tab-btn" data-cite-format="ieee">IEEE</button>
        </div>
        <div class="cite-modal-content">
          <div class="cite-box">
            <pre class="cite-code" id="cite-formatted-text"></pre>
          </div>
          <div class="cite-modal-actions">
            <button class="cite-action-btn copy-btn" id="cite-copy-btn" type="button">
              <span id="copy-btn-label" data-i18n="copy">Copiar</span>
            </button>
            <button class="cite-action-btn download-btn" id="cite-download-btn" type="button" data-i18n="download_bib">Baixar .bib</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Search Modal -->
    <div class="search-modal-backdrop" id="search-modal" aria-hidden="true">
      <div class="search-modal-dialog" role="dialog" aria-modal="true">
        <div class="search-modal-header">
          <input type="search" class="search-input" id="global-search-input" placeholder="Buscar textos, publicações, projetos, disciplinas..." data-i18n-ph="search_placeholder" autocomplete="off">
          <button class="search-close-btn" id="search-modal-close" type="button">&times;</button>
        </div>
        <div class="search-modal-body" id="search-results-container">
          <p class="search-hint" data-i18n="search_tip">Pressione ESC para fechar ou digite para pesquisar.</p>
        </div>
      </div>
    </div>
  `;
}

function renderHtmlDocument({ title, description, activePage, pagePath, depth = 0, content }) {
  const prefix = depth > 0 ? '../' : '';
  const pageTitle = title ? `${title} | ${siteConfig.name}` : `${siteConfig.name} — ${siteConfig.title}`;
  const pageDesc = description || siteConfig.bio_short;

  const rawBase = (siteConfig.site_url || '').replace(/\/$/, '') + (siteConfig.baseurl || '');
  let canonicalUrl = rawBase;
  if (pagePath && pagePath !== 'index.html') {
    canonicalUrl = `${rawBase}/${pagePath.replace(/^\//, '')}`;
  } else if (!pagePath && activePage !== 'home') {
    canonicalUrl = `${rawBase}/${activePage}.html`;
  } else {
    canonicalUrl = `${rawBase}/`;
  }

  const avatarUrl = siteConfig.avatar ? (siteConfig.avatar.startsWith('http') ? siteConfig.avatar : `${rawBase}/${siteConfig.avatar.replace(/^\//, '')}`) : '';

  return `<!doctype html>
<html lang="${siteConfig.default_lang || 'pt'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDesc}">
  <meta name="author" content="${siteConfig.name}">
  <link rel="canonical" href="${canonicalUrl}">

  <!-- Open Graph -->
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${pageDesc}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${avatarUrl}">
  <meta name="twitter:card" content="summary">

  <!-- JSON-LD Structured Data for Academic Person -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "${siteConfig.name}",
    "jobTitle": "${siteConfig.title}",
    "worksFor": {
      "@type": "CollegeOrUniversity",
      "name": "${siteConfig.institution}"
    },
    "url": "${siteConfig.site_url}",
    "sameAs": ${JSON.stringify(Object.values(siteConfig.social || {}).filter(u => u && !u.startsWith('mailto:')), null, 6)}
  }
  </script>

  <link rel="icon" href="${prefix}assets/images/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${prefix}assets/css/site.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" crossorigin="anonymous">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js" crossorigin="anonymous"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
</head>
<body>
  <div class="site-wrapper">
    ${renderHeader(activePage, depth)}
    <main class="site-main" id="main-content">
      ${content}
    </main>
    ${renderFooter()}
  </div>

  ${renderModals()}
  <script src="${prefix}assets/js/main.js" defer></script>
</body>
</html>`;
}

// Publication Entry Renderer (Discreet monochromatic pills, collapsed abstract, PT rendered by default)
function renderPubEntry(pub) {
  const jsonCite = JSON.stringify(pub.citations).replace(/"/g, '&quot;');
  const venueDisplay = pub.journal || pub.venue || 'Working Paper';

  return `
    <article class="publication-entry" id="${pub.id}">
      <h3 class="pub-entry-title">
        ${pub.url ? `<a href="${pub.url}" target="_blank" rel="noreferrer">${pub.title}</a>` : pub.title}
      </h3>
      <p class="pub-entry-meta">
        <span class="pub-entry-authors">${pub.authors.join(', ')}</span> &bull;
        <em class="pub-entry-journal">${venueDisplay}</em> &bull;
        <span class="pub-entry-year">${pub.year}</span>
      </p>
      <div class="pub-actions-row">
        ${pub.pdf ? `<a class="pub-pill-link" href="${pub.pdf}" target="_blank" rel="noreferrer" data-i18n="pdf">PDF</a>` : ''}
        ${pub.doi ? `<a class="pub-pill-link" href="https://doi.org/${pub.doi}" target="_blank" rel="noreferrer" data-i18n="doi">DOI</a>` : ''}
        ${pub.url && !pub.pdf ? `<a class="pub-pill-link" href="${pub.url}" target="_blank" rel="noreferrer" data-i18n="read_online">Ler online</a>` : ''}
        ${pub.code ? `<a class="pub-pill-link" href="${pub.code}" target="_blank" rel="noreferrer" data-i18n="code">Código</a>` : ''}
        ${pub.data ? `<a class="pub-pill-link" href="${pub.data}" target="_blank" rel="noreferrer" data-i18n="data">Dados</a>` : ''}
        ${pub.replication ? `<a class="pub-pill-link" href="${pub.replication}" target="_blank" rel="noreferrer" data-i18n="replication">Replicação</a>` : ''}
        <button class="pub-pill-btn cite-trigger-btn" type="button" data-cite-info="${jsonCite}" data-i18n="cite">Citar</button>
        ${pub.abstract ? `<button class="pub-pill-btn abstract-toggle-btn" type="button" aria-expanded="false" data-i18n="abstract">+ Resumo</button>` : ''}
      </div>
      ${pub.abstract ? `
        <div class="pub-abstract-text-block" hidden>
          <p>${pub.abstract}</p>
        </div>
      ` : ''}
    </article>
  `;
}

// 6. BUILD PAGES

// --- 6.1 HOMEPAGE (index.html) ---
function buildHome() {
  const selectedPubs = publications.filter(p => p.selected).slice(0, 4);
  const recentPosts = compiledPosts.slice(0, 3);
  const sampleProjects = projects.slice(0, 2);

  const content = `
    <!-- Single Hero Profile (No duplicates!) -->
    <section class="profile-hero">
      <div class="profile-avatar-wrap">
        <img class="profile-avatar" src="${siteConfig.avatar}" alt="${siteConfig.name}" width="120" height="120">
      </div>
      <div class="profile-intro">
        <h1 class="profile-name">${siteConfig.name}</h1>
        <p class="profile-title" data-i18n-pt="${siteConfig.title} &bull; ${siteConfig.institution}" data-i18n-en="${siteConfig.title_en} &bull; ${siteConfig.institution_en}" data-i18n-es="${siteConfig.title_es || siteConfig.title} &bull; ${siteConfig.institution_es || siteConfig.institution}" data-i18n-de="${siteConfig.title_de || siteConfig.title} &bull; ${siteConfig.institution_de || siteConfig.institution}" data-i18n-zh="${siteConfig.title_zh || siteConfig.title} &bull; ${siteConfig.institution_zh || siteConfig.institution}">${siteConfig.title} &bull; ${siteConfig.institution}</p>
        <p class="profile-areas" data-i18n-pt="Macroeconomia &bull; Economia Monetária &bull; Economia Regional &bull; Ciência de Dados" data-i18n-en="Macroeconomics &bull; Monetary Economics &bull; Regional Economics &bull; Data Science" data-i18n-es="Macroeconomía &bull; Economía Monetaria &bull; Economía Regional &bull; Ciencia de Datos" data-i18n-de="Makroökonomie &bull; Geldpolitik &bull; Regionalökonomie &bull; Data Science" data-i18n-zh="宏观经济学 &bull; 货币经济学 &bull; 区域经济学 &bull; 数据科学">Macroeconomia &bull; Economia Monetária &bull; Economia Regional &bull; Ciência de Dados</p>
        <p class="profile-location">
          <svg class="inline-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span data-i18n-pt="${siteConfig.location}" data-i18n-en="${siteConfig.location_en}" data-i18n-es="${siteConfig.location_es || siteConfig.location}" data-i18n-de="${siteConfig.location_de || siteConfig.location}" data-i18n-zh="${siteConfig.location_zh || siteConfig.location}">${siteConfig.location}</span>
        </p>
        <p class="profile-bio" data-i18n-pt="${(siteConfig.bio || '').trim()}" data-i18n-en="${(siteConfig.bio_en || '').trim()}" data-i18n-es="${(siteConfig.bio_es || siteConfig.bio || '').trim()}" data-i18n-de="${(siteConfig.bio_de || siteConfig.bio || '').trim()}" data-i18n-zh="${(siteConfig.bio_zh || siteConfig.bio || '').trim()}">${(siteConfig.bio || '').trim()}</p>

        <div class="profile-links-bar">
          ${siteConfig.social && siteConfig.social.lattes ? `<a class="prof-link" href="${siteConfig.social.lattes}" target="_blank" rel="noreferrer">Lattes</a> <span>&bull;</span>` : ''}
          ${siteConfig.social && siteConfig.social.google_scholar ? `<a class="prof-link" href="${siteConfig.social.google_scholar}" target="_blank" rel="noreferrer">Google Scholar</a> <span>&bull;</span>` : ''}
          ${siteConfig.social && siteConfig.social.orcid ? `<a class="prof-link" href="${siteConfig.social.orcid}" target="_blank" rel="noreferrer">ORCID</a> <span>&bull;</span>` : ''}
          ${siteConfig.social && siteConfig.social.github ? `<a class="prof-link" href="${siteConfig.social.github}" target="_blank" rel="noreferrer">GitHub</a> <span>&bull;</span>` : ''}
          ${siteConfig.social && siteConfig.social.linkedin ? `<a class="prof-link" href="${siteConfig.social.linkedin}" target="_blank" rel="noreferrer">LinkedIn</a> <span>&bull;</span>` : ''}
          ${siteConfig.social && siteConfig.social.instagram ? `<a class="prof-link" href="${siteConfig.social.instagram}" target="_blank" rel="noreferrer">Instagram</a> <span>&bull;</span>` : ''}
          ${siteConfig.social && siteConfig.social.email ? `<a class="prof-link" href="${siteConfig.social.email}">E-mail</a>` : ''}
          <a class="cv-download-pill" href="${siteConfig.cv_pdf}" target="_blank" rel="noreferrer" data-i18n="cv_download_btn">&darr; Baixar CV (PDF)</a>
        </div>
      </div>
    </section>

    <!-- Selected Publications (Strictly research papers) -->
    <section class="academic-section">
      <div class="section-header-row">
        <h2 class="section-title" data-i18n="selected_publications">Publicações selecionadas</h2>
        <a class="section-more-link" href="publications.html" data-i18n="view_all_pubs">Todas as publicações &rarr;</a>
      </div>
      <div class="publications-stream">
        ${selectedPubs.map(p => renderPubEntry(p)).join('\n')}
      </div>
    </section>

    <!-- Research Agenda (Compact and placed AFTER publications) -->
    <section class="academic-section">
      <div class="section-header-row">
        <h2 class="section-title" data-i18n="research_agenda">Agenda de Pesquisa</h2>
        <a class="section-more-link" href="research.html" data-i18n="nav_research">Ver mais &rarr;</a>
      </div>
      <div class="research-agenda-compact">
        ${siteConfig.research_areas.map(area => `
          <div class="agenda-compact-item">
            <div class="agenda-compact-header">
              <span class="agenda-compact-num">${area.number}.</span>
              <h3 class="agenda-compact-title" data-i18n-pt="${area.name}" data-i18n-en="${area.name_en}" data-i18n-es="${area.name_es || area.name}" data-i18n-de="${area.name_de || area.name}" data-i18n-zh="${area.name_zh || area.name}">${area.name}</h3>
            </div>
            <p class="agenda-compact-desc" data-i18n-pt="${area.description}" data-i18n-en="${area.description_en}" data-i18n-es="${area.description_es || area.description}" data-i18n-de="${area.description_de || area.description}" data-i18n-zh="${area.description_zh || area.description}">${area.description}</p>
          </div>
        `).join('\n')}
      </div>
    </section>

    <!-- Recent Posts -->
    <section class="academic-section">
      <div class="section-header-row">
        <h2 class="section-title" data-i18n="recent_posts">Últimos textos</h2>
        <a class="section-more-link" href="blog.html" data-i18n="view_all_posts">Ver todos os textos &rarr;</a>
      </div>
      <div class="posts-stream">
        ${recentPosts.map(post => `
          <article class="post-stream-item">
            <div class="post-stream-meta">
              <span>${post.date}</span> &bull;
              <span>${post.reading_time} min de leitura</span> &bull;
              <span>${post.category}</span>
            </div>
            <h3 class="post-stream-title">
              <a href="${post.url}">${post.title}</a>
            </h3>
            <p class="post-stream-summary">${post.summary}</p>
            <a class="post-read-link" href="${post.url}" data-i18n="read_more">Ler texto &rarr;</a>
          </article>
        `).join('\n')}
      </div>
    </section>

    <!-- Featured Applied Projects -->
    <section class="academic-section">
      <div class="section-header-row">
        <h2 class="section-title" data-i18n="nav_projects">Projetos em destaque</h2>
        <a class="section-more-link" href="projects.html" data-i18n="nav_projects">Todos os projetos &rarr;</a>
      </div>
      <div class="projects-stream">
        ${sampleProjects.map(proj => `
          <div class="project-entry">
            <h3 class="project-entry-title"><a href="projects.html#${proj.id}">${proj.title}</a></h3>
            <p class="project-entry-meta">${proj.category} &bull; <strong>Status:</strong> ${proj.status}</p>
            <p class="project-entry-desc">${proj.description}</p>
          </div>
        `).join('\n')}
      </div>
    </section>
  `;

  fs.writeFileSync(path.join(ROOT_DIR, 'index.html'), renderHtmlDocument({
    title: 'Início',
    description: siteConfig.bio,
    activePage: 'home',
    pagePath: 'index.html',
    content
  }));
}

// --- 6.2 RESEARCH PAGE (research.html - Publications First, Compact Agenda After) ---
function buildResearch() {
  const content = `
    <header style="margin-bottom: 40px;">
      <h1 style="font-size: 2.2rem; margin-bottom: 8px;" data-i18n="nav_research">Pesquisa</h1>
      <p style="font-size: 1.05rem; color: var(--muted); line-height: 1.6;" data-i18n-pt="Produção científica, artigos publicados e agenda de investigação acadêmica." data-i18n-en="Scientific production, published articles, and academic research agenda." data-i18n-es="Producción científica, artículos publicados y agenda de investigación académica." data-i18n-de="Wissenschaftliche Produktion, publizierte Artikel und akademische Forschungsagenda." data-i18n-zh="学术产出、已发表论文及学术研究议程。">Produção científica, artigos publicados e agenda de investigação acadêmica.</p>
    </header>

    <!-- Publicações Científicas (FIRST!) -->
    <section class="academic-section">
      <div class="section-header-row">
        <h2 class="section-title" data-i18n="all_publications">Publicações Científicas</h2>
        <a class="section-more-link" href="publications.html" data-i18n="view_all_pubs">Visão detalhada &rarr;</a>
      </div>
      <div class="publications-stream">
        ${publications.map(p => renderPubEntry(p)).join('\n')}
      </div>
    </section>

    <!-- Agenda de Pesquisa (AFTER publications, space-efficient compact layout) -->
    <section class="academic-section">
      <div class="section-header-row">
        <h2 class="section-title" data-i18n="research_agenda">Agenda de Pesquisa</h2>
      </div>
      <div class="research-agenda-compact">
        ${siteConfig.research_areas.map(area => `
          <div class="agenda-compact-item" id="area-${area.number}">
            <div class="agenda-compact-header">
              <span class="agenda-compact-num">${area.number}.</span>
              <h3 class="agenda-compact-title" data-i18n-pt="${area.name}" data-i18n-en="${area.name_en}" data-i18n-es="${area.name_es || area.name}" data-i18n-de="${area.name_de || area.name}" data-i18n-zh="${area.name_zh || area.name}">${area.name}</h3>
            </div>
            <p class="agenda-compact-desc" data-i18n-pt="${area.description}" data-i18n-en="${area.description_en}" data-i18n-es="${area.description_es || area.description}" data-i18n-de="${area.description_de || area.description}" data-i18n-zh="${area.description_zh || area.description}">${area.description}</p>
          </div>
        `).join('\n')}
      </div>
    </section>

    <!-- Nota para Projetos Aplicados -->
    <section class="academic-section" style="border-top: 1px solid var(--line); padding-top: 24px;">
      <p style="font-size: 0.95rem; color: var(--muted);">
        Para pipelines de software, rotinas de dados e tecnologia social / extensão comunitária, consulte <a href="projects.html" style="font-weight: 600;">Projetos &rarr;</a>
      </p>
    </section>
  `;

  fs.writeFileSync(path.join(ROOT_DIR, 'research.html'), renderHtmlDocument({
    title: 'Pesquisa',
    activePage: 'research',
    pagePath: 'research.html',
    content
  }));
}

// --- 6.3 PUBLICATIONS PAGE (publications.html) ---
function buildPublications() {
  const groups = [
    { cat: 'journal_article', labelKey: 'pub_journal_articles', label: 'Artigos em periódicos' },
    { cat: 'conference_paper', labelKey: 'pub_conference_papers', label: 'Trabalhos em anais de congressos' },
    { cat: 'working_paper', labelKey: 'pub_working_papers', label: 'Working Papers' },
    { cat: 'work_in_progress', labelKey: 'pub_work_in_progress', label: 'Trabalhos em elaboração' },
    { cat: 'monograph', labelKey: 'pub_monographs', label: 'Monografias e Trabalhos de Conclusão de Curso (TCC)' }
  ];

  const content = `
    <header style="margin-bottom: 40px;">
      <h1 style="font-size: 2.2rem; margin-bottom: 8px;" data-i18n="all_publications">Publicações &amp; Working Papers</h1>
      <p style="font-size: 1.05rem; color: var(--muted); line-height: 1.6;" data-i18n-pt="Produção científica, artigos em periódicos, apresentações em congressos e textos para discussão." data-i18n-en="Scientific production, journal articles, conference papers, and working papers.">Produção científica, artigos em periódicos, apresentações em congressos e textos para discussão.</p>
    </header>

    ${groups.map(group => {
      const items = publications.filter(p => p.category === group.cat);
      if (!items.length) return '';
      return `
        <section class="publications-group">
          <h2 class="pub-group-heading" data-i18n="${group.labelKey}">${group.label}</h2>
          <div class="publications-stream">
            ${items.map(p => renderPubEntry(p)).join('\n')}
          </div>
        </section>
      `;
    }).join('\n')}
  `;

  fs.writeFileSync(path.join(ROOT_DIR, 'publications.html'), renderHtmlDocument({
    title: 'Publicações',
    activePage: 'research',
    pagePath: 'publications.html',
    content
  }));
}

// --- 6.4 TEACHING PAGE (teaching.html - Ensino) ---
function buildTeaching() {
  const courses = coursesData.courses || [];
  const assistantships = coursesData.assistantships || [];

  const content = `
    <header style="margin-bottom: 40px;">
      <h1 style="font-size: 2.2rem; margin-bottom: 8px;" data-i18n="nav_teaching">Ensino</h1>
      <p style="font-size: 1.05rem; color: var(--muted); line-height: 1.6;" data-i18n-pt="Disciplinas de graduação, materiais didáticos, listas de exercícios e atividades de monitoria docente." data-i18n-en="Undergraduate courses, teaching materials, problem sets, and teaching assistantships.">Disciplinas de graduação, materiais didáticos, listas de exercícios e atividades de monitoria docente.</p>
    </header>

    <!-- Disciplinas -->
    <section class="academic-section">
      <h2 class="section-title" style="margin-bottom: 24px;" data-i18n="teaching_courses">Disciplinas</h2>
      <div class="courses-container">
        ${courses.map(course => `
          <article class="course-entry" id="${course.id}">
            <h3 class="course-name-title">${course.name}</h3>
            <p class="course-meta-subtitle">${course.institution} &bull; ${course.level} &bull; ${course.period} &bull; <strong>${course.role}</strong></p>
            <p class="course-desc-p">${course.description}</p>

            ${course.syllabus && course.syllabus.length ? `
              <h4 class="course-subheading" data-i18n="syllabus">Ementa:</h4>
              <ul class="course-syllabus-list">
                ${course.syllabus.map(s => `<li>${s}</li>`).join('')}
              </ul>
            ` : ''}

            ${course.materials && course.materials.length ? `
              <h4 class="course-subheading" data-i18n="materials">Materiais Didáticos &amp; Downloads:</h4>
              <div class="course-materials-grid">
                ${course.materials.map(m => `
                  <a class="material-link-item" href="${m.url}" target="_blank" rel="noreferrer">
                    <span class="material-type-pill">${m.type || 'PDF'}</span>
                    <span>${m.title}</span>
                  </a>
                `).join('\n')}
              </div>
            ` : ''}
          </article>
        `).join('\n')}
      </div>
    </section>

    <!-- Atividades de Monitoria -->
    <section class="academic-section" style="margin-top: 48px;">
      <h2 class="section-title" style="margin-bottom: 24px;" data-i18n="teaching_assistant">Atividades de Monitoria Docente</h2>
      <div class="teaching-timeline">
        ${assistantships.map(item => `
          <div class="assistantship-row">
            <span class="assistantship-period">${item.period}</span>
            <div class="assistantship-details">
              <strong>${item.course} — ${item.role}</strong>
              <p>${item.description}</p>
            </div>
          </div>
        `).join('\n')}
      </div>
    </section>
  `;

  fs.writeFileSync(path.join(ROOT_DIR, 'teaching.html'), renderHtmlDocument({
    title: 'Ensino',
    activePage: 'teaching',
    pagePath: 'teaching.html',
    content
  }));
}

// --- 6.5 PROJECTS PAGE (projects.html - Applied, Tools, Extension) ---
function buildProjects() {
  const content = `
    <header style="margin-bottom: 40px;">
      <h1 style="font-size: 2.2rem; margin-bottom: 8px;" data-i18n="nav_projects">Projetos</h1>
      <p style="font-size: 1.05rem; color: var(--muted); line-height: 1.6;" data-i18n-pt="Projetos aplicados, rotinas de ciência de dados, pipelines estatísticos e tecnologia social / extensão." data-i18n-en="Applied projects, data science routines, statistical pipelines, and social technology / university extension.">Projetos aplicados, rotinas de ciência de dados, pipelines estatísticos e tecnologia social / extensão.</p>
    </header>

    <div class="projects-stream">
      ${projects.map(proj => `
        <article class="project-entry" id="${proj.id}">
          <h2 class="project-entry-title">${proj.title}</h2>
          <p class="project-entry-meta">${proj.category} &bull; <strong>Status:</strong> ${proj.status}</p>
          <p class="project-entry-desc">${proj.description}</p>
          <div class="project-tech-line">
            <strong>Tecnologias:</strong> ${proj.technologies.join(', ')}
          </div>
          <div class="pub-actions-row">
            ${proj.github ? `<a class="pub-pill-link" href="${proj.github}" target="_blank" rel="noreferrer" data-i18n="code">Código GitHub</a>` : ''}
            ${proj.demo ? `<a class="pub-pill-link" href="${proj.demo}" target="_blank" rel="noreferrer">Demonstração / Aplicação</a>` : ''}
            ${proj.paper ? `<a class="pub-pill-link" href="${proj.paper}">Paper Relacionado</a>` : ''}
            ${proj.blog ? `<a class="pub-pill-link" href="${proj.blog}">Texto no Blog</a>` : ''}
          </div>
        </article>
      `).join('\n')}
    </div>
  `;

  fs.writeFileSync(path.join(ROOT_DIR, 'projects.html'), renderHtmlDocument({
    title: 'Projetos',
    activePage: 'projects',
    pagePath: 'projects.html',
    content
  }));
}

// --- 6.6 BLOG PAGE (blog.html) & POSTS ---
function buildBlog() {
  const categories = siteConfig.blog_categories || [...new Set(compiledPosts.map(p => p.category).filter(Boolean))];

  const content = `
    <header style="margin-bottom: 30px;">
      <h1 style="font-size: 2.2rem; margin-bottom: 8px;" data-i18n="nav_blog">Blog Acadêmico</h1>
      <p style="font-size: 1.05rem; color: var(--muted); line-height: 1.6;" data-i18n-pt="Textos, notas de pesquisa, tutoriais de programação em Python/R e análises de conjuntura econômica." data-i18n-en="Essays, research notes, Python/R programming tutorials, and macroeconomic analysis.">Textos, notas de pesquisa, tutoriais de programação em Python/R e análises de conjuntura econômica.</p>
    </header>

    <div class="blog-filters-bar">
      <input type="search" id="blog-search-field" class="blog-search-field" placeholder="Buscar textos..." data-i18n-ph="search_placeholder">
      <div class="filter-pills-list">
        <button class="filter-tag-pill active" data-category="all" data-i18n="all">Todos</button>
        ${categories.map(c => `<button class="filter-tag-pill" data-category="${c}">${c}</button>`).join('\n')}
      </div>
    </div>

    <div class="posts-stream" id="blog-stream">
      ${compiledPosts.map(post => `
        <article class="post-stream-item" data-category="${post.category}">
          <div class="post-stream-meta">
            <span>${post.date}</span> &bull;
            <span>${post.reading_time} min de leitura</span> &bull;
            <span>${post.category}</span>
          </div>
          <h2 class="post-stream-title">
            <a href="${post.url}">${post.title}</a>
          </h2>
          <p class="post-stream-summary">${post.summary}</p>
          <a class="post-read-link" href="${post.url}" data-i18n="read_more">Ler texto &rarr;</a>
        </article>
      `).join('\n')}
    </div>
  `;

  fs.writeFileSync(path.join(ROOT_DIR, 'blog.html'), renderHtmlDocument({
    title: 'Blog',
    activePage: 'blog',
    pagePath: 'blog.html',
    content
  }));

  // Build Individual Posts
  compiledPosts.forEach(post => {
    const postContent = `
      <article class="single-post-wrap">
        <header style="margin-bottom: 32px;">
          <div class="single-post-meta">
            <span>${post.date}</span> &bull;
            <span>${post.reading_time} min de leitura</span> &bull;
            <span>${post.category}</span>
          </div>
          <h1 class="single-post-title">${post.title}</h1>
          <p style="font-size: 1.05rem; color: var(--ink-secondary); font-style: italic; margin-top: 8px;">Por ${siteConfig.name}</p>
        </header>

        <div class="single-post-body">
          ${post.htmlContent
            .replace(/href=["'](?!\/|http|mailto:|#|\.\.\/)([^"']+)["']/g, 'href="../$1"')
            .replace(/src=["'](?!\/|http|\.\.\/)([^"']+)["']/g, 'src="../$1"')}
        </div>

        <footer style="margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--line);">
          <a href="../blog.html" style="font-family: var(--font-sans); font-size: 0.9rem; font-weight: 500;">&larr; Voltar para todos os textos</a>
        </footer>
      </article>
    `;

    fs.writeFileSync(path.join(POSTS_OUT_DIR, `${post.slug}.html`), renderHtmlDocument({
      title: post.title,
      description: post.summary,
      activePage: 'blog',
      pagePath: post.url,
      depth: 1,
      content: postContent
    }));
  });
}

// --- 6.7 CV PAGE (cv.html) ---
function buildCv() {
  const education = Array.isArray(cvData.education) ? cvData.education : [];
  const experience = Array.isArray(cvData.experience) ? cvData.experience : [];
  const skills = Array.isArray(cvData.skills) ? cvData.skills : [];
  const languages = Array.isArray(cvData.languages) ? cvData.languages : [];

  const content = `
    <div class="cv-wrap">
      <header class="cv-hero-bar">
        <div>
          <h1 style="font-size: 2.2rem; margin-bottom: 4px;" data-i18n="nav_cv">Currículo</h1>
          <p style="font-size: 1.05rem; font-family: var(--font-sans); color: var(--ink); margin-bottom: 2px;">
            ${siteConfig.name} &bull;
            <span data-i18n-pt="${siteConfig.title}" data-i18n-en="${siteConfig.title_en}" data-i18n-es="${siteConfig.title_es || siteConfig.title}" data-i18n-de="${siteConfig.title_de || siteConfig.title}" data-i18n-zh="${siteConfig.title_zh || siteConfig.title}">${siteConfig.title}</span>
          </p>
          <p style="font-size: 0.9rem; font-family: var(--font-sans); color: var(--muted); margin: 0;">
            <span data-i18n-pt="${siteConfig.institution}" data-i18n-en="${siteConfig.institution_en}" data-i18n-es="${siteConfig.institution_es || siteConfig.institution}" data-i18n-de="${siteConfig.institution_de || siteConfig.institution}" data-i18n-zh="${siteConfig.institution_zh || siteConfig.institution}">${siteConfig.institution}</span> &bull;
            <span data-i18n-pt="${siteConfig.location}" data-i18n-en="${siteConfig.location_en}" data-i18n-es="${siteConfig.location_es || siteConfig.location}" data-i18n-de="${siteConfig.location_de || siteConfig.location}" data-i18n-zh="${siteConfig.location_zh || siteConfig.location}">${siteConfig.location}</span>
          </p>
        </div>
        <div>
          <a class="cv-download-pill" href="${siteConfig.cv_pdf}" target="_blank" rel="noreferrer" data-i18n="cv_download_btn">&darr; Baixar CV (PDF)</a>
        </div>
      </header>

      <!-- Formação Acadêmica -->
      <section class="cv-section-block">
        <h2 class="cv-section-heading" data-i18n="cv_education">Formação Acadêmica</h2>
        <div class="cv-timeline-grid">
          ${education.map(ed => `
            <div class="cv-entry-row">
              <span class="cv-date-col">${ed.period}</span>
              <div class="cv-detail-col">
                <strong data-i18n-pt="${ed.degree}" data-i18n-en="${ed.degree_en || ed.degree}">${ed.degree}</strong>
                <span data-i18n-pt="${ed.institution}" data-i18n-en="${ed.institution_en || ed.institution}">${ed.institution}</span>
              </div>
            </div>
          `).join('\n')}
        </div>
      </section>

      <!-- Experiência Acadêmica e Ensino -->
      <section class="cv-section-block">
        <h2 class="cv-section-heading" data-i18n="cv_experience">Experiência Acadêmica e Ensino</h2>
        <div class="cv-timeline-grid">
          ${experience.map(exp => `
            <div class="cv-entry-row">
              <span class="cv-date-col">${exp.period}</span>
              <div class="cv-detail-col">
                <strong data-i18n-pt="${exp.role}" data-i18n-en="${exp.role_en || exp.role}">${exp.role}</strong>
                <span data-i18n-pt="${exp.institution}" data-i18n-en="${exp.institution_en || exp.institution}">${exp.institution}</span>
              </div>
            </div>
          `).join('\n')}
        </div>
      </section>

      <!-- Produção Científica -->
      <section class="cv-section-block">
        <h2 class="cv-section-heading" data-i18n="all_publications">Publicações Científicas</h2>
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${publications.map(p => `
            <div>
              <strong>${p.title}</strong> (${p.year}). <em>${p.journal || p.venue}</em>.
              <a href="publications.html#${p.id}">[Ver detalhes]</a>
            </div>
          `).join('\n')}
        </div>
      </section>

      <!-- Habilidades e Ferramentas -->
      <section class="cv-section-block">
        <h2 class="cv-section-heading" data-i18n="cv_skills">Habilidades e Ferramentas</h2>
        <div style="font-family: var(--font-sans); font-size: 0.94rem; line-height: 1.8; color: var(--ink-secondary);">
          ${skills.map(s => `
            <p style="margin-bottom: 8px;">
              <strong data-i18n-pt="${s.category}" data-i18n-en="${s.category_en || s.category}">${s.category}:</strong> ${s.items}
            </p>
          `).join('\n')}
        </div>
      </section>

      <!-- Idiomas -->
      ${languages.length ? `
        <section class="cv-section-block">
          <h2 class="cv-section-heading" data-i18n="cv_languages">Idiomas</h2>
          <div class="cv-timeline-grid">
            ${languages.map(lang => `
              <div class="cv-entry-row">
                <span class="cv-date-col"><strong data-i18n-pt="${lang.language}" data-i18n-en="${lang.language_en || lang.language}">${lang.language}</strong></span>
                <div class="cv-detail-col">
                  <span data-i18n-pt="${lang.level}" data-i18n-en="${lang.level_en || lang.level}">${lang.level}</span>
                </div>
              </div>
            `).join('\n')}
          </div>
        </section>
      ` : ''}

      <!-- Perfis Acadêmicos -->
      <section class="cv-section-block">
        <h2 class="cv-section-heading">Perfis Acadêmicos &amp; Redes</h2>
        <p style="font-family: var(--font-sans); font-size: 0.94rem; line-height: 1.8;">
          ${siteConfig.social && siteConfig.social.lattes ? `<a href="${siteConfig.social.lattes}" target="_blank" rel="noreferrer">&bull; Currículo Lattes (CNPq)</a><br>` : ''}
          ${siteConfig.social && siteConfig.social.google_scholar ? `<a href="${siteConfig.social.google_scholar}" target="_blank" rel="noreferrer">&bull; Perfil no Google Scholar</a><br>` : ''}
          ${siteConfig.social && siteConfig.social.orcid ? `<a href="${siteConfig.social.orcid}" target="_blank" rel="noreferrer">&bull; ORCID</a><br>` : ''}
          ${siteConfig.social && siteConfig.social.github ? `<a href="${siteConfig.social.github}" target="_blank" rel="noreferrer">&bull; Repositório no GitHub</a><br>` : ''}
          ${siteConfig.social && siteConfig.social.linkedin ? `<a href="${siteConfig.social.linkedin}" target="_blank" rel="noreferrer">&bull; Perfil no LinkedIn</a><br>` : ''}
          ${siteConfig.social && siteConfig.social.instagram ? `<a href="${siteConfig.social.instagram}" target="_blank" rel="noreferrer">&bull; Instagram</a>` : ''}
        </p>
      </section>
    </div>
  `;

  fs.writeFileSync(path.join(ROOT_DIR, 'cv.html'), renderHtmlDocument({
    title: 'Currículo',
    activePage: 'cv',
    pagePath: 'cv.html',
    content
  }));
}

// --- 6.8 REDIRECT STUBS (Zero Broken Links) ---
function buildRedirects() {
  const redirects = [
    { from: 'curriculo.html', to: 'cv.html', title: 'Currículo' },
    { from: 'sobre.html', to: 'index.html', title: 'Início' },
    { from: 'projetos.html', to: 'projects.html', title: 'Projetos' },
    { from: 'arquivos.html', to: 'blog.html', title: 'Blog' },
    { from: 'materiais.html', to: 'teaching.html', title: 'Ensino' },
    { from: 'producoes.html', to: 'publications.html', title: 'Publicações' }
  ];

  redirects.forEach(({ from, to, title }) => {
    const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=${to}">
  <title>Redirecionando para ${title}...</title>
  <link rel="canonical" href="${to}">
</head>
<body>
  <p>Redirecionando para <a href="${to}">${title}</a>...</p>
</body>
</html>`;
    fs.writeFileSync(path.join(ROOT_DIR, from), html);
  });
}

// --- 6.9 SITEMAP, ROBOTS, 404 ---
function buildMetaFiles() {
  const rawBase = (siteConfig.site_url || '').replace(/\/$/, '') + (siteConfig.baseurl || '');
  const urls = ['', 'research.html', 'teaching.html', 'projects.html', 'publications.html', 'blog.html', 'cv.html', ...compiledPosts.map(p => p.url)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>\n    <loc>${rawBase}/${u}</loc>\n    <lastmod>${todayISO}</lastmod>\n  </url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(ROOT_DIR, 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(ROOT_DIR, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${rawBase}/sitemap.xml\n`);
  fs.writeFileSync(path.join(ROOT_DIR, '.nojekyll'), '# Disable Jekyll on GitHub Pages\n');

  const notFoundContent = `
    <div style="text-align: center; padding: 80px 20px;">
      <h1 style="font-size: 3rem; margin-bottom: 12px;">404</h1>
      <p style="font-size: 1.15rem; color: var(--muted); margin-bottom: 28px;">Página não encontrada.</p>
      <a href="index.html" class="pub-pill-link" style="font-size: 0.95rem; padding: 6px 16px;">&larr; Voltar para a página inicial</a>
    </div>
  `;
  fs.writeFileSync(path.join(ROOT_DIR, '404.html'), renderHtmlDocument({
    title: '404 Não Encontrado',
    activePage: 'home',
    pagePath: '404.html',
    content: notFoundContent
  }));
}

// EXECUTE BUILD
console.log('--- Compilando Site Acadêmico Orientado a Conteúdo ---');
buildHome();
console.log('✓ index.html (Perfil único, botão CV, agenda 01-04)');
buildResearch();
console.log('✓ research.html (Agenda & publicações científicas)');
buildPublications();
console.log('✓ publications.html (Citações multiformato, artigos e congressos)');
buildTeaching();
console.log('✓ teaching.html (Disciplinas e monitoria sem campos nulos)');
buildProjects();
console.log('✓ projects.html (Projetos aplicados, dados e extensão)');
buildBlog();
console.log(`✓ blog.html & ${compiledPosts.length} posts compilados`);
buildCv();
console.log('✓ cv.html (Canônico atualizado)');
buildRedirects();
console.log('✓ Redirecionamentos configurados (curriculo, sobre, projetos, etc.)');
buildMetaFiles();
console.log('✓ search-index.json, sitemap.xml, robots.txt, 404.html');
console.log('--- Concluído com sucesso! ---');
