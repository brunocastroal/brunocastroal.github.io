---
layout: post
title: "Título do seu novo artigo ou ensaio"
date: 2026-10-08
summary: "Uma ou duas frases resumindo as ideias principais, metodologia ou resultados discutidos neste texto."
category: "Macroeconomia" # Opções: Macroeconomia, Economia Monetária, Ciência de Dados, Econometria, Economia Regional
tags:
  - "Política Monetária"
  - "Brasil"
featured: false # Altere para true para destacar na página inicial
---

## Introdução

Escreva seu texto em formato Markdown tradicional. Você pode estruturar as seções usando títulos de nível 2 (`##`) ou nível 3 (`###`).

Parágrafos são criados simplesmente pulando uma linha no texto. Você pode destacar termos em **negrito** ou em *itálico*, além de criar listas:

- Primeiro ponto relevante do argumento;
- Segundo ponto com evidência empírica;
- Terceiro ponto de conclusão ou implicação de política.

## Metodologia e Modelagem

Você pode inserir equações matemáticas usando a sintaxe LaTeX. Fórmulas inline ficam entre cifrões simples: por exemplo, a regra de Taylor dada por $i_t = r^* + \pi_t + 0.5(\pi_t - \pi^*) + 0.5 y_t$.

Para blocos de equações destacadas em linha própria, utilize cifrões duplos:

$$
\min_{\theta} \sum_{i=1}^{N} \left( y_i - f(x_i; \theta) \right)^2 + \lambda \|\theta\|_2^2
$$

## Exemplos de Código

Trechos de código computacional em Python, R ou Stata podem ser delimitados por três crases:

```python
import numpy as np
import pandas as pd

# Exemplo de rotina empírica
dados = pd.DataFrame({
    'ano': [2023, 2024, 2025, 2026],
    'inflacao': [4.62, 3.90, 3.80, 3.50]
})
print(dados.describe())
```

## Considerações Finais

Apresente aqui o fechamento do seu texto, links para materiais complementares ou referências bibliográficas:

- [Link para o repositório no GitHub](https://github.com/brunocastroal)
- [Artigo relacionado no Google Scholar](https://scholar.google.com.br/citations?user=G48yrGsAAAAJ)
