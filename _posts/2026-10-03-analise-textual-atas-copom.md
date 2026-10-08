---
title: "Análise textual das atas do Copom: comunicação e política monetária"
date: "2026-10-03"
category: "Macroeconomia"
tags:
  - Copom
  - Política Monetária
  - Text Mining
  - NLP
summary: "Análise multidimensional das atas publicadas sobre as reuniões do Comitê de Política Monetária do Banco Central do Brasil, examinando sentimento, tom de comunicação e expectativas inflacionárias."
reading_time: 16
lang: "pt"
featured: true
author: "Bruno Castro Alves"
---

## Comunicação do Banco Central e Política Monetária

A comunicação oficial das autoridades monetárias consolidou-se nas últimas décadas como um instrumento indispensável de política econômica. No Brasil, as atas do Comitê de Política Monetária (Copom), divulgadas após cada decisão sobre a taxa básica de juros (Selic), sintetizam a leitura da autoridade sobre o balanço de riscos para a inflação, o cenário internacional e a atividade doméstica.

Neste projeto de análise de dados textuais (*text analysis*), investigamos a evolução vocabular e o tom predominante dos comunicados por meio de técnicas de Processamento de Linguagem Natural (NLP) e mineração de texto.

## Metodologia de Mineração de Texto

A base de dados compreende a totalidade das atas publicadas no período recente. O pré-processamento seguiu etapas rigorosas:

1. **Extração automatizada:** Web scraping das atas diretamente do portal do Banco Central do Brasil;
2. **Normalização linguística:** Remoção de stopwords econômicas neutras, pontuação e lematização;
3. **Mapeamento de polaridade:** Construção de léxico econômico categorizado em tons contracionistas (*hawkish*) e expansionistas (*dovish*);
4. **Análise de tópicos:** Modelagem não supervisionada via *Latent Dirichlet Allocation* (LDA) para identificação dos temas mais recorrentes em cada conjuntura.

## Modelagem e Equação de Taylor Expandida

Para avaliar a transmissão do tom da comunicação para as expectativas de mercado, incorporamos o índice de sentimento textual ($S_t$) em uma regra de reação monetária inspirada em Taylor:

$$
i_t = \rho i_{t-1} + (1 - \rho) \left[ r^* + \pi_t^* + \beta (\pi_{t+k}^e - \pi_t^*) + \gamma y_t + \theta S_t \right] + \epsilon_t
$$

Onde:
- $i_t$ representa a meta para a taxa Selic;
- $\pi_{t+k}^e - \pi_t^*$ representa o desvio da expectativa de inflação em relação à meta;
- $y_t$ denota o hiato do produto;
- $S_t$ capta o tom textual da ata divulgada no período $t$.

## Principais Resultados e Considerações

Os resultados indicam uma forte correlação contemporânea entre a ênfase lexical em riscos inflacionários e os ajustes subsequentes na trajetória dos juros futuros (DI). A precisão na comunicação atua como uma âncora complementar para as expectativas do mercado financeiro, mitigando ruídos e volatilidade excessiva.

Os scripts em Python e notebooks interativos para replicação deste pipeline de dados estão disponíveis na página de [Projetos](projects.html).
