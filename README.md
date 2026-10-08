# 📚 Guia de Manutenção do Site Acadêmico — GitHub Pages

Bem-vindo ao seu site acadêmico pessoal! Ele foi projetado para que você possa mantê-lo e atualizá-lo por anos **sem precisar abrir arquivos de código (HTML, CSS ou JavaScript)**.

Toda a manutenção de conteúdo é feita editando arquivos simples de texto em **Markdown (`.md`)** e **YAML (`.yml`)**, que funcionam como formulários organizados.

---

## 🗺️ Mapa do Site

```text
📁 brunocastroal.github.io
│
├── 📁 CONTEÚDO QUE VOCÊ EDITA (Prioridade Máxima)
│   ├── 📁 _posts/                  <-- ONDE VOCÊ CRIA SEUS POSTS DO BLOG (.md)
│   ├── 📁 data/
│   │   ├── profile.yml             <-- Seu nome, bio da Home, e-mail, redes e áreas (Fonte Única)
│   │   ├── cv.yml                  <-- Formação acadêmica, experiência docente, habilidades e idiomas
│   │   ├── publications.yml        <-- Seus artigos, congressos e working papers
│   │   ├── projects.yml            <-- Seus projetos de código, dados e extensão
│   │   └── teaching.yml            <-- Suas disciplinas, ementas e materiais de aula
│   ├── 📁 _i18n/                   <-- Traduções da interface (pt, en, es, de, zh)
│   ├── 📄 _post-template.md        <-- Modelo pronto para criar novos posts no blog
│   └── 📄 _config.yml              <-- Gerado automaticamente a partir de data/profile.yml
│
├── 📁 ARQUIVOS E MATERIAIS
│   └── 📁 assets/
│       ├── 📁 images/              <-- Sua foto (avatar), logotipos, ícones e ilustrações
│       ├── 📁 papers/              <-- PDFs dos seus artigos para download
│       ├── 📁 teaching/            <-- PDFs de notas de aula, listas e slides
│       └── 📁 cv/                  <-- Seu currículo em PDF (curriculo.pdf)
│
├── 📁 CÓDIGO E ENGINE (Não precisa alterar se não for programador)
│   ├── 📁 assets/css/              <-- Estilos visuais e tipografia acadêmica
│   ├── 📁 assets/js/               <-- Comportamentos interativos (citações, busca, tema, i18n)
│   ├── 📁 lib/                     <-- Parser YAML sem dependências externas
│   ├── 📁 .github/workflows/       <-- Publicador automático no GitHub Pages
│   ├── 📄 build.js                 <-- Gerador estático rápido
│   ├── 📄 server.js                <-- Servidor leve para pré-visualização no PC
│   ├── 📄 build.bat                <-- Dê 2 cliques no Windows para compilar o site
│   └── 📄 preview.bat              <-- Dê 2 cliques para testar no seu navegador
│
└── 📄 README.md                    <-- Este guia didático
```

---

## 📋 Quais arquivos posso editar?

| Arquivo / Pasta | Posso editar? | Para que serve? |
|---|:---:|---|
| `data/profile.yml` | ✅ **Sim** | Fonte Única da Verdade: Nome, biografia, resumo da Home, links (Lattes, ORCID, Scholar, etc.) |
| `data/cv.yml` | ✅ **Sim** | Formação acadêmica, monitorias docentes, habilidades técnicas e idiomas do Currículo |
| `data/publications.yml` | ✅ **Sim** | Adicionar, editar ou remover artigos e papers acadêmicos |
| `_posts/` | ✅ **Sim** | Criar novas postagens e ensaios para o blog |
| `data/projects.yml` | ✅ **Sim** | Projetos de pesquisa aplicada, ciência de dados e extensão |
| `data/teaching.yml` | ✅ **Sim** | Disciplinas, ementas, notas de aula e atividades de monitoria |
| `_i18n/*.yml` | ✅ **Sim** | Dicionários de palavras e botões em 5 idiomas (PT, EN, ES, DE, ZH) |
| `assets/images/` | ✅ **Sim** | Guardar foto de perfil e imagens para os textos |
| `assets/cv/` | ✅ **Sim** | Substituir o seu currículo em PDF (`curriculo.pdf`) |
| `assets/papers/` | ✅ **Sim** | Colocar os PDFs dos seus artigos |
| `assets/teaching/` | ✅ **Sim** | Colocar notas de aula e listas de exercícios |
| `_config.yml` | ⚙️ **Automático** | Gerado automaticamente a partir de `data/profile.yml` ao compilar |
| `build.bat` / `preview.bat` | ⚙️ **Executar** | Utilitários de clique duplo para testar no Windows |
| `build.js` / `server.js` | ❌ **Não mexer** | Motor interno do site |
| `assets/css/` / `assets/js/` | ❌ **Não mexer** | Folhas de estilo e scripts técnicos |
| Arquivos `.html` na raiz | ❌ **Não mexer** | São gerados automaticamente a partir dos arquivos de dados |

---

# Como atualizar o site

---

## 1. Alterar o resumo da Home
- **Arquivo:** `data/profile.yml`
- **Campo:** `bio:` (e `bio_en:` para a versão em inglês)

Abra o arquivo `data/profile.yml` no Bloco de Notas ou em qualquer editor e altere o texto:

```yaml
bio: >
  Bacharel em Ciências Econômicas pela Universidade Federal do Delta do Parnaíba (UFDPar). Atuo com pesquisa quantitativa aplicada em macroeconomia, economia monetária, economia regional e métodos de ciência de dados.
```

> **Dica:** O símbolo `>` no YAML permite escrever textos com várias linhas sem precisar quebrar o arquivo ou usar códigos especiais.

---

## 2. Adicionar uma nova publicação acadêmica
- **Arquivo:** `data/publications.yml`

Para adicionar um artigo, working paper ou capítulo:
1. Abra `data/publications.yml`.
2. Vá até o final do arquivo e cole um novo bloco de publicação:

```yaml
- id: "alves-2026-meu-artigo"
  title: "Título do seu novo artigo acadêmico"
  authors:
    - "Bruno Castro Alves"
    - "Outro Autor"
  year: 2026
  category: "journal_article" # Opções: journal_article, conference_paper, working_paper, monograph
  journal: "Nome da Revista Científica ou Evento"
  volume: "25"
  pages: "1-20"
  doi: "10.xxxx/exemplo"
  pdf: "https://link-para-o-pdf.pdf"
  url: "https://link-para-a-revista.com"
  selected: true              # true para destacar na página inicial
  abstract: >
    Cole aqui o resumo do seu artigo em texto corrido...
  keywords:
    - "Macroeconomia"
    - "Econometria"
```

3. Salve o arquivo.
4. Faça commit/push no GitHub. O site irá criar **automaticamente** os botões de PDF, DOI, Resumo e os formatos de citação em **ABNT, BibTeX, APA, Chicago, IEEE e MLA**.

---

## 3. Criar uma nova postagem no Blog
- **Local:** pasta `_posts/`

1. Na raiz do site, copie o arquivo `_post-template.md`.
2. Cole dentro da pasta `_posts/`.
3. Renomeie o arquivo seguindo o padrão de data e título:
   ```text
   AAAA-MM-DD-titulo-do-post.md
   ```
   *Exemplo:* `2026-11-15-politica-monetaria-e-credito.md`
4. Abra o arquivo e altere o cabeçalho inicial:

```yaml
---
layout: post
title: "Título da sua postagem"
date: 2026-11-15
summary: "Uma ou duas frases explicando do que se trata o texto."
category: "Macroeconomia" # Macroeconomia, Economia Monetária, Ciência de Dados, Econometria ou Economia Regional
tags:
  - "Política Monetária"
  - "Crédito"
featured: false           # Mude para true para destacar no topo da página inicial
---

## Introdução

Escreva seu texto em Markdown normal.

## Metodologia

Você pode inserir equações matemáticas usando LaTeX: $Y = C + I + G$.
Ou em blocos destacados:

$$
i_t = r^* + \pi_t + 0.5(\pi_t - \pi^*)
$$
```

5. Salve o arquivo e envie para o GitHub. A postagem aparecerá no topo do Blog imediatamente!

---

## 4. Editar ou excluir uma postagem antiga
- Vá até a pasta `_posts/`.
- Abra o arquivo correspondente da postagem que deseja alterar (ex: `2024-06-22-economia-solidaria.md`).
- Faça as alterações no texto e salve o arquivo.
- Para excluir, basta apagar o arquivo `.md`.

---

## 5. Alterar links de redes sociais e perfis acadêmicos
- **Arquivo:** `data/profile.yml`
- **Seção:** `social:`

Basta alterar os links dos seus perfis:

```yaml
social:
  lattes: "https://lattes.cnpq.br/4936269417036697"
  google_scholar: "https://scholar.google.com.br/citations?user=G48yrGsAAAAJ&hl=pt-BR&oi=ao"
  orcid: "https://orcid.org/0009-0004-9469-8239"
  github: "https://github.com/brunocastroal"
  linkedin: "https://www.linkedin.com/in/brunocastroalves"
  instagram: "https://www.instagram.com/brun0_castr0/"
  email: "mailto:brunocastr0@usp.br"
```

Alterando aqui, todos os botões da Home, do Currículo, do Rodapé e os metadados de busca são atualizados de uma só vez!

---

## 6. Alterar e-mail de contato
- **Arquivo:** `data/profile.yml`
- **Campo:** `email: "seu-email@usp.br"`

Basta alterar essa linha. O site atualiza os links `mailto:` em todas as páginas automaticamente.

---

## 7. Atualizar o Currículo (Página Web e PDF)

### Como alterar o texto da página `/cv.html`:
- **Arquivo:** `data/cv.yml`
Abra `data/cv.yml` para editar sua formação acadêmica, experiências de ensino/monitoria, habilidades técnicas e idiomas:

```yaml
education:
  - period: "2020 — 2025"
    degree: "Bacharelado em Ciências Econômicas"
    degree_en: "Bachelor of Arts in Economics"
    institution: "Universidade Federal do Delta do Parnaíba (UFDPar)"

experience:
  - period: "2025.1"
    role: "Monitor Bolsista de Macroeconomia I"
    role_en: "Teaching Assistant for Macroeconomics I"
    institution: "Universidade Federal do Delta do Parnaíba (UFDPar)"

skills:
  - category: "Métodos Quantitativos"
    items: "Econometria Espacial, Análise Bibliométrica, Processamento de Linguagem Natural (NLP), Séries Temporais."

languages:
  - language: "Português"
    level: "Nativo"
  - language: "Inglês"
    level: "Intermediário / Leitura Acadêmica"
```
Ao compilar ou fazer commit, a página `cv.html` é atualizada automaticamente em todos os idiomas.

### Como atualizar o arquivo PDF para download:
1. Exporte seu novo currículo em formato PDF com o nome `curriculo.pdf`.
2. Cole o arquivo na pasta `assets/cv/curriculo.pdf`, substituindo o arquivo anterior.
3. O botão de download no topo do site e na página de CV já apontará para o novo documento.

---

## 8. Adicionar material de uma disciplina (Ensino)
1. Coloque o arquivo PDF da nota de aula, lista de exercícios ou slides na pasta:
   `assets/teaching/` (exemplo: `assets/teaching/macro1_lista_03.pdf`).
2. Abra o arquivo `data/teaching.yml`.
3. Na disciplina desejada (ex: `macroeconomia-i`), adicione o item sob `materials:`:

```yaml
    materials:
      - title: "Lista de Exercícios 03 — Política Fiscal e Modelo IS-LM"
        type: "PDF"
        url: "assets/teaching/macro1_lista_03.pdf"
        description: "Exercícios com gabarito comentado para estudo autônomo."
```

---

## 9. Idiomas e Traduções (Suporte a 5 Idiomas: PT / EN / ES / DE / ZH)

O site conta com um seletor multilíngue instantâneo no cabeçalho: **PT / EN / ES / DE / ZH**.

### Traduções da Interface (botões, menus e rodapé):
- **Local:** pasta `_i18n/`
  - `_i18n/pt.yml`: Português
  - `_i18n/en.yml`: Inglês
  - `_i18n/es.yml`: Espanhol
  - `_i18n/de.yml`: Alemão
  - `_i18n/zh.yml`: Chinês

Abra o arquivo desejado e altere o texto entre aspas correspondente ao botão ou título.

### Traduções do Conteúdo Principal (Biografia, Cargos e Agenda):
- **Arquivo:** `data/profile.yml`
Campos multilíngues disponíveis para edição:
  - `title`, `title_en`, `title_es`, `title_de`, `title_zh`
  - `institution`, `institution_en`, `institution_es`, `institution_de`, `institution_zh`
  - `bio`, `bio_en`, `bio_es`, `bio_de`, `bio_zh`
  - Cada item de `research_areas` possui `name` e `description` traduzidos para os 5 idiomas.

---

## 10. Trocar sua foto de perfil ou imagens
1. Coloque a sua nova foto na pasta `assets/images/` (preferencialmente em formato JPG ou PNG quadrado, exemplo: `assets/images/minha-foto.jpg`).
2. Abra `data/profile.yml` e altere a linha:
   ```yaml
   avatar: "assets/images/minha-foto.jpg"
   ```

---

## 11. Como publicar as alterações no GitHub

### Opção A: Diretamente pelo site GitHub.com (Mais fácil!)
1. Acesse o seu repositório no navegador: `https://github.com/brunocastroal/brunocastroal.github.io`.
2. Navegue até o arquivo que deseja alterar (ex: `data/profile.yml` ou `_posts/`).
3. Clique no ícone de lápis ✏️ no canto superior direito para editar o arquivo.
4. Faça a alteração no texto.
5. No final da página, clique no botão verde **Commit changes**.
6. **Pronto!** O GitHub Actions irá rodar automaticamente e, em cerca de 30 segundos, seu site atualizado estará no ar.

### Opção B: Pelo GitHub Desktop
1. Abra o aplicativo **GitHub Desktop** no seu computador.
2. Faça as alterações nos arquivos na pasta do seu computador (pode usar o Bloco de Notas ou VS Code).
3. O GitHub Desktop mostrará a lista de arquivos alterados no painel esquerdo.
4. Escreva um resumo simples no campo inferior (ex: *"Novo post no blog"*).
5. Clique em **Commit to main**.
6. Clique no botão azul superior **Push origin**.
7. O site será atualizado na web automaticamente.

### Opção C: Testando no seu computador antes de enviar (Opcional)
Se você tiver o Node.js instalado no seu computador e quiser ver o resultado antes de publicar:
- Dê **dois cliques no arquivo `preview.bat`**.
- Uma janela abrirá automaticamente no seu navegador em `http://localhost:8080`.
- Você poderá navegar por todas as páginas exatamente como elas ficarão na internet.

---

## 🏛️ Arquitetura e Decisões Técnicas

- **Por que esta solução em vez de Jekyll ou CMS complexos?**
  Jekyll no Windows costuma apresentar falhas frequentes de compilação de extensões C do Ruby (DevKit/MSYS2), dependências quebradas de gems e lentidão. CMSs tradicionais exigem bancos de dados, servidores PHP/Python ativos e logins vulneráveis a invasões.
- **Motor estático com zero dependências externas:**
  O site utiliza um motor ultra-leve (`build.js`) integrado a um parser YAML nativo (`lib/js-yaml.js`). Isso significa que ele **não requer `npm install`** e funciona instantaneamente em qualquer computador com Node.js ou nos servidores do GitHub Actions.
- **Integração total com GitHub Pages:**
  O fluxo de automação em `.github/workflows/deploy.yml` monitora cada alteração na branch principal e realiza a compilação e deploy automático através da infraestrutura oficial do GitHub Pages.
- **Princípio de Uma Fonte da Verdade:**
  Cada informação (como seu nome, e-mail, biografia ou uma publicação científica) existe em apenas **um lugar**. Ao atualizar esse lugar, a Home, a página de Pesquisa, as citações, o Currículo e o Rodapé se sincronizam automaticamente.
