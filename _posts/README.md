# Como criar ou editar postagens no Blog

O blog deste site foi projetado para que você possa publicar textos novos apenas criando ou editando arquivos em formato **Markdown (`.md`)**, sem precisar mexer em nenhum código HTML ou JavaScript.

---

## Passo a passo para criar uma nova postagem

1. **Copie o modelo de post:**
   Na raiz do site, copie o arquivo `_post-template.md`.

2. **Cole nesta pasta `_posts/` com o nome padronizado:**
   O nome do arquivo deve seguir o formato de data e título em letras minúsculas separadas por hífen:
   ```text
   AAAA-MM-DD-titulo-do-post.md
   ```
   *Exemplo:* `2026-11-20-novo-ensaio-politica-monetaria.md`

3. **Edite o cabeçalho inicial (Front Matter):**
   No início do arquivo, preencha as informações entre os traços `---`:
   ```yaml
   ---
   layout: post
   title: "Título do seu novo artigo ou ensaio"
   date: 2026-11-20
   summary: "Uma ou duas frases explicando o tema do texto."
   category: "Macroeconomia" # Macroeconomia, Economia Monetária, Ciência de Dados, Econometria ou Economia Regional
   tags:
     - "Política Monetária"
     - "Inflação"
   featured: false           # Mude para true se quiser destacar no topo da página inicial
   ---
   ```

4. **Escreva o conteúdo:**
   Abaixo do segundo `---`, escreva o texto normalmente em Markdown.
   - Use `##` para títulos de seção;
   - Use `**negrito**` ou `*itálico*`;
   - Fórmulas matemáticas em LaTeX são aceitas inline com `$x = y$` ou em bloco com `$$ \int f(x) dx $$`;
   - Blocos de código Python/R com crases triplas.

5. **Publique:**
   - **No GitHub (Web ou Desktop):** Basta fazer commit e enviar (*push*). O GitHub Pages compila e publica seu novo post em instantes!
   - **Localmente no seu computador (opcional):** Dê dois cliques em `build.bat` para compilar o site imediatamente.

---

## Como editar ou excluir uma postagem antiga

- Para **editar**: Abra o arquivo `.md` correspondente dentro desta pasta `_posts/`, altere o texto e salve.
- Para **excluir**: Basta apagar o arquivo `.md` correspondente e salvar/enviar ao repositório.
