---
title: "Machine learning na economia: por onde começar uma revisão bibliométrica?"
date: "2025-11-04"
category: "Ciência de Dados"
tags:
  - Ciência de Dados
  - Bibliometria
  - Métodos Quantitativos
  - Machine Learning
summary: "Um guia metodológico e reflexão bibliométrica sobre a incorporação de técnicas de aprendizado de máquina na literatura econômica internacional e nacional."
reading_time: 5
lang: "pt"
featured: true
author: "Bruno Castro Alves"
---

## Machine Learning na Literatura Econômica

A fronteira da econometria e da análise empírica contemporânea vem incorporando com intensidade crescente modelos de aprendizado estatístico supervisionado e não supervisionado. Para pesquisadores interessados em compreender a gênese e a evolução dessa literatura, o método bibliométrico oferece uma abordagem rigorosa, reproduzível e abrangente.

Este texto resume notas do trabalho de conclusão de curso na UFDPar, explorando caminhos práticos para estruturar uma revisão de escopo orientada a dados.

## Estrutura Metodológica Sugerida

Ao conduzir um mapeamento bibliométrico sobre inteligência artificial e economia, recomendamos quatro etapas fundamentais:

1. **Definição da Pergunta e Recorte Temporal:** Delimitação clara dos conceitos (ex.: *Machine Learning*, *Deep Learning*, *Random Forest* versus inferência causal tradicional);
2. **Seleção de Bases Científicas:** Extração de metadados padronizados em repositórios de referência (Scopus, Web of Science, EconLit);
3. **Higienização de Registros:** Desduplicação, normalização de filiações institucionais e harmonização de palavras-chave com scripts em R (`bibliometrix`) ou Python (`pybliometrics`);
4. **Análise de Redes e Co-ocorrência:** Identificação de clusters temáticos, frentes de pesquisa emergentes e redes de coautoria internacional.

## Redes de Palavras-chave e Fronteiras Temáticas

A literatura revela uma transição evidente: de aplicações focadas primariamente em previsão macroeconômica e séries temporais financeiras para a fusão entre *Machine Learning* e modelos estruturais de identificação causal (como *Double Machine Learning* e *Causal Forests* desenvolvidos por Susan Athey e Guido Imbens).

```python
# Exemplo de extração de co-ocorrência de termos com spacy e networkx
import networkx as nx

# Criação de grafo bibliográfico
G = nx.Graph()
G.add_edge("Machine Learning", "Causal Inference", weight=42)
G.add_edge("Machine Learning", "Macroeconomic Forecasting", weight=68)
G.add_edge("Causal Inference", "Policy Evaluation", weight=35)
```

## Próximos Passos na Pesquisa

A aplicação dessas técnicas no contexto de dados brasileiros — como os microdados da RAIS, CAGED e censos agropecuários — abre oportunidades férteis para investigar desigualdades regionais e impactos de políticas públicas com granularidade inédita.
