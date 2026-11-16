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

// Sort publications: year desc, journal_article before conference_paper
const categoryRank = { journal_article: 1, monograph: 2, working_paper: 3, conference_paper: 4, work_in_progress: 5 };
publications.sort((a, b) => (b.year - a.year) || ((categoryRank[a.category] || 9) - (categoryRank[b.category] || 9)));

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

// Helper: Apply inline Markdown rules (after math & code protection)
function applyInlineMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="notranslate" translate="no">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

// Helper: Convert Markdown to HTML (supports math, code, tables, lists, hrs)
function markdownToHtml(md) {
  if (!md) return '';
  let src = md.replace(/\r\n/g, '\n');

  // Protect code blocks first so math inside code isn't touched
  const placeholders = [];
  const pushPlaceholder = (html) => {
    const token = `<!--BLOCK_PH_${placeholders.length}-->`;
    placeholders.push(html);
    return token;
  };

  src = src.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (m, lang, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return pushPlaceholder(`<pre class="code-block notranslate" translate="no"><code>${escaped}</code></pre>`);
  });

  // Protect display & inline math with notranslate for Google Translate safety
  src = src.replace(/\$\$([\s\S]*?)\$\$/g, (m, eq) =>
    pushPlaceholder(`<div class="math-display notranslate" translate="no">$$${eq.trim()}$$</div>`)
  );
  src = src.replace(/\$([^\$\n]+?)\$/g, (m, eq) =>
    pushPlaceholder(`<span class="math-inline notranslate" translate="no">$${eq}$</span>`)
  );

  const lines = src.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    // Standalone protected block or raw HTML block
    if (/^<!--BLOCK_PH_\d+-->$/.test(trimmed) || trimmed.startsWith('<div') || trimmed.startsWith('</div')) {
      if (trimmed.startsWith('<div')) {
        const htmlBuf = [line];
        let depth = (line.match(/<div\b/g) || []).length - (line.match(/<\/div>/g) || []).length;
        while (depth > 0 && i + 1 < lines.length) {
          i++;
          htmlBuf.push(lines[i]);
          depth += (lines[i].match(/<div\b/g) || []).length - (lines[i].match(/<\/div>/g) || []).length;
        }
        out.push(htmlBuf.join('\n'));
      } else {
        out.push(trimmed);
      }
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(---|\*\*\*|___)\s*$/.test(trimmed)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // Headings
    const hMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (hMatch) {
      const level = Math.max(2, hMatch[1].length); // Keep h1 unique for post title
      out.push(`<h${level}>${applyInlineMarkdown(hMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquotes
    if (trimmed.startsWith('> ')) {
      const bqLines = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        bqLines.push(applyInlineMarkdown(lines[i].trim().slice(2)));
        i++;
      }
      out.push(`<blockquote><p>${bqLines.join('<br>')}</p></blockquote>`);
      continue;
    }

    // Markdown Table (| ... | followed by | :--- |)
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|/.test(lines[i + 1].trim())) {
      const splitCells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const headers = splitCells(lines[i]);
      const aligns = splitCells(lines[i + 1]).map(s => {
        if (s.startsWith(':') && s.endsWith(':')) return 'center';
        if (s.endsWith(':')) return 'right';
        return 'left';
      });
      i += 2;
      const bodyRows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        bodyRows.push(splitCells(lines[i]));
        i++;
      }
      const thHtml = headers.map((h, idx) => `<th style="text-align:${aligns[idx] || 'left'}">${applyInlineMarkdown(h)}</th>`).join('');
      const trHtml = bodyRows.map(r => `<tr>${r.map((c, idx) => `<td style="text-align:${aligns[idx] || 'left'}">${applyInlineMarkdown(c)}</td>`).join('')}</tr>`).join('');
      out.push(`<div class="table-wrap"><table><thead><tr>${thHtml}</tr></thead><tbody>${trHtml}</tbody></table></div>`);
      continue;
    }

    // Unordered list
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        const isNested = /^\s{2,}-\s+/.test(lines[i]);
        const itemText = applyInlineMarkdown(lines[i].replace(/^\s*-\s+/, ''));
        items.push(`<li${isNested ? ' class="nested-li"' : ''}>${itemText}</li>`);
        i++;
      }
      out.push(`<ul>\n${items.join('\n')}\n</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${applyInlineMarkdown(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>\n${items.join('\n')}\n</ol>`);
      continue;
    }

    // Paragraph (stop before blank lines or special block starts)
    const pLines = [];
    while (i < lines.length) {
      const cur = lines[i];
      const curTrim = cur.trim();
      if (!curTrim) break;
      if (/^(#{1,3}\s+|>\s+|---+\s*$|\s*-\s+|\d+\.\s+|<div\b|<!--BLOCK_PH_\d+-->$)/.test(curTrim) ||
          (curTrim.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|/.test(lines[i + 1].trim()))) {
        break;
      }
      pLines.push(applyInlineMarkdown(curTrim));
      i++;
    }
    if (pLines.length) {
      out.push(`<p>${pLines.join('<br>')}</p>`);
    }
  }

  let html = out.join('\n\n');
  // IMPORTANT: pass arrow function so '$$' in LaTeX is NOT collapsed to single '$'
  placeholders.forEach((content, idx) => {
    html = html.replace(new RegExp(`<!--BLOCK_PH_${idx}-->`, 'g'), () => content);
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
            <span class="brand-name notranslate" translate="no">${siteConfig.name}</span>
          </a>
        </div>

        <nav class="nav-menu" id="nav-menu" role="navigation" aria-label="Navegação principal">
          <ul class="nav-list">
            <li><a class="nav-link ${activePage === 'home' ? 'active' : ''}" href="${prefix}index.html">Início</a></li>
            <li><a class="nav-link ${activePage === 'research' ? 'active' : ''}" href="${prefix}research.html">Pesquisa</a></li>
            <li><a class="nav-link ${activePage === 'teaching' ? 'active' : ''}" href="${prefix}teaching.html">Ensino</a></li>
            <li><a class="nav-link ${activePage === 'projects' ? 'active' : ''}" href="${prefix}projects.html">Projetos</a></li>
            <li><a class="nav-link ${activePage === 'blog' ? 'active' : ''}" href="${prefix}blog.html">Blog</a></li>
            <li><a class="nav-link ${activePage === 'cv' ? 'active' : ''}" href="${prefix}cv.html">CV</a></li>
          </ul>
        </nav>

        <div class="header-controls">
          <!-- Google Translate PT / EN Switcher -->
          <div class="lang-switch-wrap notranslate" translate="no" role="group" aria-label="Idioma / Language">
            <button class="lang-switch-btn active" type="button" data-lang="pt" aria-label="Português" title="Português">PT</button>
            <span class="lang-sep">/</span>
            <button class="lang-switch-btn" type="button" data-lang="en" aria-label="English (Google Translate)" title="Translate to English via Google Translate">EN</button>
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
          <button class="control-btn hamburger" id="hamburger-btn" type="button" aria-label="Menu" aria-expanded="false">
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
          <span class="footer-name notranslate" translate="no">${siteConfig.name}</span>
          <span>${siteConfig.title} &bull; ${siteConfig.institution}</span>
          <span>${siteConfig.location}</span>
        </div>
        <div class="footer-links-bar notranslate" translate="no">
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
        <span>Página acadêmica pessoal de <span class="notranslate" translate="no">${siteConfig.name}</span>.</span>
        <span>&copy; ${new Date().getFullYear()} <span class="notranslate" translate="no">${siteConfig.name}</span>.</span>
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
          <h3 class="cite-modal-title" id="cite-modal-title">Citar publicação</h3>
          <button class="cite-close-btn" id="cite-modal-close" type="button">&times;</button>
        </div>
        <div class="cite-modal-tabs notranslate" translate="no">
          <button class="cite-tab-btn active" data-cite-format="bibtex">BibTeX</button>
          <button class="cite-tab-btn" data-cite-format="abnt">ABNT</button>
          <button class="cite-tab-btn" data-cite-format="apa">APA 7</button>
          <button class="cite-tab-btn" data-cite-format="chicago">Chicago</button>
          <button class="cite-tab-btn" data-cite-format="mla">MLA 9</button>
          <button class="cite-tab-btn" data-cite-format="ieee">IEEE</button>
        </div>
        <div class="cite-modal-content">
          <div class="cite-box notranslate" translate="no">
            <pre class="cite-code" id="cite-formatted-text"></pre>
          </div>
          <div class="cite-modal-actions">
            <button class="cite-action-btn copy-btn" id="cite-copy-btn" type="button">
              <span id="copy-btn-label">Copiar</span>
            </button>
            <button class="cite-action-btn download-btn" id="cite-download-btn" type="button">Baixar .bib</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Search Modal -->
    <div class="search-modal-backdrop" id="search-modal" aria-hidden="true">
      <div class="search-modal-dialog" role="dialog" aria-modal="true">
        <div class="search-modal-header">
          <input type="search" class="search-input" id="global-search-input" placeholder="Buscar textos, publicações, disciplinas..." autocomplete="off">
          <button class="search-close-btn" id="search-modal-close" type="button">&times;</button>
        </div>
        <div class="search-modal-body" id="search-results-container">
          <p class="search-hint">Pressione ESC para fechar ou digite para pesquisar.</p>
        </div>
      </div>
    </div>

    <!-- Hidden mount target for Google Translate Element -->
    <div id="google_translate_element" class="notranslate" translate="no" aria-hidden="true"></div>
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
<html lang="pt-BR">
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
  <script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" async defer></script>
</body>
</html>`;
}

// Publication Entry Renderer
function renderPubEntry(pub) {
  const jsonCite = JSON.stringify(pub.citations).replace(/"/g, '&quot;');
  const venueDisplay = pub.journal || pub.venue || 'Working Paper';

  return `
    <article class="publication-entry" id="${pub.id}">
      <h3 class="pub-entry-title">
        ${pub.url ? `<a href="${pub.url}" target="_blank" rel="noreferrer">${pub.title}</a>` : pub.title}
      </h3>
      <p class="pub-entry-meta">
        <span class="pub-entry-authors notranslate" translate="no">${pub.authors.join(', ')}</span> &bull;
        <em class="pub-entry-journal notranslate" translate="no">${venueDisplay}</em> &bull;
        <span class="pub-entry-year notranslate" translate="no">${pub.year}</span>
      </p>
      <div class="pub-actions-row">
        ${pub.pdf ? `<a class="pub-pill-link notranslate" translate="no" href="${pub.pdf}" target="_blank" rel="noreferrer">PDF</a>` : ''}
        ${pub.doi ? `<a class="pub-pill-link notranslate" translate="no" href="https://doi.org/${pub.doi}" target="_blank" rel="noreferrer">DOI</a>` : ''}
        ${pub.url ? `<a class="pub-pill-link" href="${pub.url}" target="_blank" rel="noreferrer">Ler online</a>` : ''}
        ${pub.code ? `<a class="pub-pill-link" href="${pub.code}" target="_blank" rel="noreferrer">Código</a>` : ''}
        ${pub.data ? `<a class="pub-pill-link" href="${pub.data}" target="_blank" rel="noreferrer">Dados</a>` : ''}
        ${pub.replication ? `<a class="pub-pill-link" href="${pub.replication}" target="_blank" rel="noreferrer">Replicação</a>` : ''}
        <button class="pub-pill-btn cite-trigger-btn" type="button" data-cite-info="${jsonCite}">Citar</button>
        ${pub.abstract ? `<button class="pub-pill-btn abstract-toggle-btn" type="button" aria-expanded="false">+ Resumo</button>` : ''}
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
    <!-- Single Hero Profile -->
    <section class="profile-hero">
      <div class="profile-avatar-wrap">
        <img class="profile-avatar" src="${siteConfig.avatar}" alt="${siteConfig.name}" width="120" height="120">
      </div>
      <div class="profile-intro">
        <h1 class="profile-name notranslate" translate="no">${siteConfig.name}</h1>
        <p class="profile-title">${siteConfig.title} &bull; ${siteConfig.institution}</p>
        <p class="profile-areas">${siteConfig.areas || 'Macroeconomia &bull; Consumo e Poupança &bull; Economia Regional &bull; Ciência de Dados'}</p>
        <p class="profile-location">
          <svg class="inline-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span class="notranslate" translate="no">${siteConfig.location}</span>
        </p>
        <p class="profile-bio">${(siteConfig.bio || '').trim()}</p>

        <div class="profile-links-bar">
          ${siteConfig.social && siteConfig.social.lattes ? `<a class="prof-link notranslate" translate="no" href="${siteConfig.social.lattes}" target="_blank" rel="noreferrer">Lattes</a> <span>&bull;</span>` : ''}
          ${siteConfig.social && siteConfig.social.google_scholar ? `<a class="prof-link notranslate" translate="no" href="${siteConfig.social.google_scholar}" target="_blank" rel="noreferrer">Google Scholar</a> <span>&bull;</span>` : ''}
          ${siteConfig.social && siteConfig.social.orcid ? `<a class="prof-link notranslate" translate="no" href="${siteConfig.social.orcid}" target="_blank" rel="noreferrer">ORCID</a> <span>&bull;</span>` : ''}
          ${siteConfig.social && siteConfig.social.github ? `<a class="prof-link notranslate" translate="no" href="${siteConfig.social.github}" target="_blank" rel="noreferrer">GitHub</a> <span>&bull;</span>` : ''}
          ${siteConfig.social && siteConfig.social.linkedin ? `<a class="prof-link notranslate" translate="no" href="${siteConfig.social.linkedin}" target="_blank" rel="noreferrer">LinkedIn</a> <span>&bull;</span>` : ''}
          ${siteConfig.social && siteConfig.social.instagram ? `<a class="prof-link notranslate" translate="no" href="${siteConfig.social.instagram}" target="_blank" rel="noreferrer">Instagram</a> <span>&bull;</span>` : ''}
          ${siteConfig.social && siteConfig.social.email ? `<a class="prof-link" href="${siteConfig.social.email}">E-mail</a>` : ''}
          <a class="cv-download-pill" href="${siteConfig.cv_pdf}" target="_blank" rel="noreferrer">&darr; Baixar CV (PDF)</a>
        </div>
      </div>
    </section>

    <!-- Selected Publications -->
    <section class="academic-section">
      <div class="section-header-row">
        <h2 class="section-title">Publicações selecionadas</h2>
        <a class="section-more-link" href="publications.html">Todas as publicações &rarr;</a>
      </div>
      <div class="publications-stream">
        ${selectedPubs.map(p => renderPubEntry(p)).join('\n')}
      </div>
    </section>

    <!-- Research Agenda (Placed AFTER publications) -->
    <section class="academic-section">
      <div class="section-header-row">
        <h2 class="section-title">Agenda de Pesquisa</h2>
        <a class="section-more-link" href="research.html">Ver mais &rarr;</a>
      </div>
      <div class="research-agenda-compact">
        ${(siteConfig.research_areas || []).map(area => `
          <div class="agenda-compact-item">
            <div class="agenda-compact-header">
              <span class="agenda-compact-num">${area.number}.</span>
              <h3 class="agenda-compact-title">${area.name}</h3>
            </div>
            <p class="agenda-compact-desc">${area.description}</p>
          </div>
        `).join('\n')}
      </div>
    </section>

    <!-- Recent Posts -->
    ${recentPosts.length ? `
    <section class="academic-section">
      <div class="section-header-row">
        <h2 class="section-title">Últimos textos</h2>
        <a class="section-more-link" href="blog.html">Ver todos os textos &rarr;</a>
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
            <a class="post-read-link" href="${post.url}">Ler texto &rarr;</a>
          </article>
        `).join('\n')}
      </div>
    </section>` : ''}

    ${sampleProjects.length ? `
    <!-- Featured Applied Projects -->
    <section class="academic-section">
      <div class="section-header-row">
        <h2 class="section-title">Projetos em destaque</h2>
        <a class="section-more-link" href="projects.html">Todos os projetos &rarr;</a>
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
    </section>` : ''}
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
      <h1 style="font-size: 2.2rem; margin-bottom: 8px;">Pesquisa</h1>
      <p style="font-size: 1.05rem; color: var(--muted); line-height: 1.6;">Produção científica, artigos publicados e agenda de investigação acadêmica.</p>
    </header>

    <!-- Publicações Científicas (FIRST!) -->
    <section class="academic-section">
      <div class="section-header-row">
        <h2 class="section-title">Publicações Científicas</h2>
        <a class="section-more-link" href="publications.html">Visão detalhada &rarr;</a>
      </div>
      <div class="publications-stream">
        ${publications.map(p => renderPubEntry(p)).join('\n')}
      </div>
    </section>

    <!-- Agenda de Pesquisa (AFTER publications) -->
    <section class="academic-section">
      <div class="section-header-row">
        <h2 class="section-title">Agenda de Pesquisa</h2>
      </div>
      <div class="research-agenda-compact">
        ${(siteConfig.research_areas || []).map(area => `
          <div class="agenda-compact-item" id="area-${area.number}">
            <div class="agenda-compact-header">
              <span class="agenda-compact-num">${area.number}.</span>
              <h3 class="agenda-compact-title">${area.name}</h3>
            </div>
            <p class="agenda-compact-desc">${area.description}</p>
          </div>
        `).join('\n')}
      </div>
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
    { cat: 'journal_article', label: 'Artigos em periódicos' },
    { cat: 'conference_paper', label: 'Trabalhos em anais de congressos' },
    { cat: 'working_paper', label: 'Working Papers' },
    { cat: 'work_in_progress', label: 'Trabalhos em elaboração' },
    { cat: 'monograph', label: 'Monografias e Trabalhos de Conclusão de Curso (TCC)' }
  ];

  const content = `
    <header style="margin-bottom: 40px;">
      <h1 style="font-size: 2.2rem; margin-bottom: 8px;">Publicações &amp; Working Papers</h1>
      <p style="font-size: 1.05rem; color: var(--muted); line-height: 1.6;">Produção científica, artigos em periódicos, apresentações em congressos e textos para discussão.</p>
    </header>

    ${groups.map(group => {
      const items = publications.filter(p => p.category === group.cat);
      if (!items.length) return '';
      return `
        <section class="publications-group">
          <h2 class="pub-group-heading">${group.label}</h2>
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
      <h1 style="font-size: 2.2rem; margin-bottom: 8px;">Ensino</h1>
      <p style="font-size: 1.05rem; color: var(--muted); line-height: 1.6;">Disciplinas de graduação, materiais didáticos e atividades de monitoria docente.</p>
    </header>

    <!-- Disciplinas -->
    <section class="academic-section">
      <h2 class="section-title" style="margin-bottom: 24px;">Disciplinas</h2>
      <div class="courses-container">
        ${courses.map(course => `
          <article class="course-entry" id="${course.id}">
            <h3 class="course-name-title">${course.name}</h3>
            <p class="course-meta-subtitle">${course.institution} &bull; ${course.level} &bull; ${course.period} &bull; <strong>${course.role}</strong></p>
            <p class="course-desc-p">${course.description}</p>

            ${course.syllabus && course.syllabus.length ? `
              <h4 class="course-subheading">Ementa:</h4>
              <ul class="course-syllabus-list">
                ${course.syllabus.map(s => `<li>${s}</li>`).join('')}
              </ul>
            ` : ''}

            ${course.materials && course.materials.length ? `
              <h4 class="course-subheading">Materiais Didáticos &amp; Downloads:</h4>
              <div class="course-materials-grid">
                ${course.materials.map(m => `
                  <a class="material-link-item" href="${m.url}" target="_blank" rel="noreferrer">
                    <span class="material-type-pill notranslate" translate="no">${m.type || 'PDF'}</span>
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
      <h2 class="section-title" style="margin-bottom: 24px;">Atividades de Monitoria Docente</h2>
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

// --- 6.5 PROJECTS PAGE (projects.html) ---
function buildProjects() {
  const projectsHtml = projects.length
    ? `
      <div class="projects-stream">
        ${projects.map(proj => `
          <article class="project-entry" id="${proj.id}">
            <h2 class="project-entry-title">${proj.title}</h2>
            <p class="project-entry-meta">${proj.category} &bull; <strong>Status:</strong> ${proj.status}</p>
            <p class="project-entry-desc">${proj.description}</p>
            <div class="project-tech-line">
              <strong>Tecnologias:</strong> ${(proj.technologies || []).join(', ')}
            </div>
            <div class="pub-actions-row">
              ${proj.github ? `<a class="pub-pill-link" href="${proj.github}" target="_blank" rel="noreferrer">Código GitHub</a>` : ''}
              ${proj.demo ? `<a class="pub-pill-link" href="${proj.demo}" target="_blank" rel="noreferrer">Demonstração / Aplicação</a>` : ''}
              ${proj.paper ? `<a class="pub-pill-link" href="${proj.paper}">Paper Relacionado</a>` : ''}
              ${proj.blog ? `<a class="pub-pill-link" href="${proj.blog}">Texto no Blog</a>` : ''}
            </div>
          </article>
        `).join('\n')}
      </div>
    `
    : `
      <div class="under-construction-box">
        <h2 class="under-construction-title">Em construção</h2>
        <p class="under-construction-desc">Esta página está em construção. Novos projetos serão publicados em breve.</p>
      </div>
    `;

  const content = `
    <header style="margin-bottom: 40px;">
      <h1 style="font-size: 2.2rem; margin-bottom: 8px;">Projetos</h1>
      <p style="font-size: 1.05rem; color: var(--muted); line-height: 1.6;">Projetos aplicados, rotinas de economia computacional e ciência de dados.</p>
    </header>
    ${projectsHtml}
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
  const categories = [...new Set(compiledPosts.map(p => p.category).filter(Boolean))];

  const filtersHtml = compiledPosts.length > 1 ? `
    <div class="blog-filters-bar">
      <input type="search" id="blog-search-field" class="blog-search-field" placeholder="Buscar textos...">
      <div class="filter-pills-list">
        <button class="filter-tag-pill active" data-category="all">Todos</button>
        ${categories.map(c => `<button class="filter-tag-pill" data-category="${c}">${c}</button>`).join('\n')}
      </div>
    </div>
  ` : '';

  const content = `
    <header style="margin-bottom: 30px;">
      <h1 style="font-size: 2.2rem; margin-bottom: 8px;">Blog Acadêmico</h1>
      <p style="font-size: 1.05rem; color: var(--muted); line-height: 1.6;">Notas técnicas, materiais computacionais e estudos em macroeconomia quantitativa.</p>
    </header>

    ${filtersHtml}

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
          <a class="post-read-link" href="${post.url}">Ler texto &rarr;</a>
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
          <p style="font-size: 1.05rem; color: var(--ink-secondary); font-style: italic; margin-top: 8px;">Por <span class="notranslate" translate="no">${siteConfig.name}</span></p>
        </header>

        <div class="single-post-body">
          ${post.htmlContent
            .replace(/href=["'](?!\/|http|mailto:|#|\.\.\/)([^"']+)["']/g, 'href="../$1"')
            .replace(/src=["'](?!\/|http|\.\.\/)([^"']+)["']/g, 'src="../$1"')}
        </div>

        <footer style="margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--line);">
          <a href="../blog.html" style="font-family: var(--font-sans); font-size: 0.9rem; font-weight: 500;">&larr; Voltar para o Blog</a>
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
  const researchExtension = Array.isArray(cvData.research_and_extension) ? cvData.research_and_extension : [];
  const technicalEvents = Array.isArray(cvData.technical_and_events) ? cvData.technical_and_events : [];
  const conferenceHighlights = Array.isArray(cvData.conference_highlights) ? cvData.conference_highlights : [];
  const skills = Array.isArray(cvData.skills) ? cvData.skills : [];
  const languages = Array.isArray(cvData.languages) ? cvData.languages : [];

  const content = `
    <div class="cv-wrap">
      <header class="cv-hero-bar">
        <div>
          <h1 style="font-size: 2.2rem; margin-bottom: 4px;">Currículo Vitae</h1>
          <p style="font-size: 1.05rem; font-family: var(--font-sans); color: var(--ink); margin-bottom: 2px;">
            <span class="notranslate" translate="no">${siteConfig.name}</span> &bull;
            <span>${siteConfig.title}</span>
          </p>
          <p style="font-size: 0.9rem; font-family: var(--font-sans); color: var(--muted); margin: 0;">
            <span>${siteConfig.institution}</span> &bull;
            <span class="notranslate" translate="no">${siteConfig.location}</span>
          </p>
        </div>
        <div>
          <a class="cv-download-pill" href="${siteConfig.cv_pdf}" target="_blank" rel="noreferrer">&darr; Baixar CV (PDF)</a>
        </div>
      </header>

      <!-- Formação Acadêmica -->
      <section class="cv-section-block">
        <h2 class="cv-section-heading">Formação Acadêmica</h2>
        <div class="cv-timeline-grid">
          ${education.map(ed => `
            <div class="cv-entry-row">
              <span class="cv-date-col">${ed.period}</span>
              <div class="cv-detail-col">
                <strong>${ed.degree}</strong>
                <span>${ed.institution}</span>
                ${ed.details ? `<p>${ed.details}</p>` : ''}
              </div>
            </div>
          `).join('\n')}
        </div>
      </section>

      <!-- Atuação Acadêmica, Ensino e Pesquisa -->
      <section class="cv-section-block">
        <h2 class="cv-section-heading">Atuação Acadêmica, Ensino e Grupos de Pesquisa</h2>
        <div class="cv-timeline-grid">
          ${experience.map(exp => `
            <div class="cv-entry-row">
              <span class="cv-date-col">${exp.period}</span>
              <div class="cv-detail-col">
                <strong>${exp.role}</strong>
                <span>${exp.institution}</span>
                ${exp.details ? `<p>${exp.details}</p>` : ''}
              </div>
            </div>
          `).join('\n')}
        </div>
      </section>

      ${researchExtension.length ? `
      <!-- Projetos de Pesquisa e Extensão -->
      <section class="cv-section-block">
        <h2 class="cv-section-heading">Projetos de Pesquisa e Extensão (Lattes)</h2>
        <div class="cv-timeline-grid">
          ${researchExtension.map(item => `
            <div class="cv-entry-row">
              <span class="cv-date-col">${item.period}</span>
              <div class="cv-detail-col">
                <strong>${item.role}</strong>
                <span>${item.institution}</span>
                ${item.details ? `<p>${item.details}</p>` : ''}
              </div>
            </div>
          `).join('\n')}
        </div>
      </section>` : ''}

      <!-- Produção Bibliográfica -->
      <section class="cv-section-block">
        <h2 class="cv-section-heading">Artigos em Periódicos</h2>
        <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px;">
          ${publications.filter(p => p.category === 'journal_article').map(p => `
            <div>
              <strong>${p.title}</strong> (${p.year}). <em>${p.journal}</em>${p.volume ? `, v. ${p.volume}` : ''}${p.pages ? `, p. ${p.pages}` : ''}.
              <a href="publications.html#${p.id}">[Ver detalhes]</a>
            </div>
          `).join('\n')}
        </div>
        ${conferenceHighlights.length ? `
          <h3 style="font-size: 1.05rem; margin-bottom: 10px;">Trabalhos completos em anais de congressos</h3>
          <ul style="font-family: var(--font-sans); font-size: 0.9rem; line-height: 1.65; color: var(--ink-secondary); padding-left: 18px; margin: 0;">
            ${conferenceHighlights.map(c => `<li style="margin-bottom: 6px;">${c}</li>`).join('\n')}
          </ul>
        ` : ''}
      </section>

      ${technicalEvents.length ? `
      <!-- Produção Técnica e Eventos -->
      <section class="cv-section-block">
        <h2 class="cv-section-heading">Produção Técnica, Cursos e Organização de Eventos</h2>
        <div class="cv-timeline-grid">
          ${technicalEvents.map(item => `
            <div class="cv-entry-row">
              <span class="cv-date-col">${item.period}</span>
              <div class="cv-detail-col">
                <strong>${item.role}</strong>
                <span>${item.institution}</span>
              </div>
            </div>
          `).join('\n')}
        </div>
      </section>` : ''}

      <!-- Habilidades e Ferramentas -->
      <section class="cv-section-block">
        <h2 class="cv-section-heading">Habilidades e Ferramentas</h2>
        <div style="font-family: var(--font-sans); font-size: 0.94rem; line-height: 1.8; color: var(--ink-secondary);">
          ${skills.map(s => `
            <p style="margin-bottom: 8px;">
              <strong>${s.category}:</strong> <span class="notranslate" translate="no">${s.items}</span>
            </p>
          `).join('\n')}
        </div>
      </section>

      <!-- Idiomas -->
      ${languages.length ? `
        <section class="cv-section-block">
          <h2 class="cv-section-heading">Idiomas</h2>
          <div class="cv-timeline-grid">
            ${languages.map(lang => `
              <div class="cv-entry-row">
                <span class="cv-date-col"><strong>${lang.language}</strong></span>
                <div class="cv-detail-col">
                  <span>${lang.level}</span>
                </div>
              </div>
            `).join('\n')}
          </div>
        </section>
      ` : ''}

      <!-- Perfis Acadêmicos -->
      <section class="cv-section-block">
        <h2 class="cv-section-heading">Perfis Acadêmicos &amp; Redes</h2>
        <p class="notranslate" translate="no" style="font-family: var(--font-sans); font-size: 0.94rem; line-height: 1.8;">
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
