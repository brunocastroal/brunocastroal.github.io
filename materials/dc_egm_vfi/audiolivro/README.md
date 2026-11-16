# Audiolivro Didático Completo — VFI vs DC-EGM com Upper Envelope

Material de estudo em formato de curso oral completo (12 capítulos independentes, ~2h15min a 2h30min de duração estimada em ritmo moderado de aula de pós-graduação), acompanhando o E-Book `EBOOK_DC_EGM_VFI_FINAL.pdf`, o relatório científico, as apresentações e os códigos MATLAB do projeto.

## Organização da Pasta

```text
AUDIOLIVRO/
├── README.md
├── ROTEIRO_COMPLETO.md
├── gerar_audiolivro.py
├── ROTEIROS_CAPITULOS/
│   ├── 01_Introducao.md
│   ├── 02_Ambiente_Economico.md
│   ├── 03_Problema_Intertemporal.md
│   ├── 04_VFI.md
│   ├── 05_EGM.md
│   ├── 06_DC_EGM.md
│   ├── 07_Implementacao_MATLAB.md
│   ├── 08_Distribuicao_Estacionaria.md
│   ├── 09_Equilibrio_Geral.md
│   ├── 10_Resultados_Computacionais.md
│   ├── 11_Resultados_Economicos.md
│   └── 12_Conclusao.md
├── AUDIO/                  # Destino dos MP3 individuais por capítulo
└── AUDIO_COMPLETO/         # Destino de AUDIOLIVRO_DC_EGM_VFI_COMPLETO.mp3
```

## Diagnóstico de Ferramentas de Síntese de Voz (TTS) no Ambiente

Auditoria realizada antes da geração de áudio:
- **Vozes locais Windows SAPI / OneCore:** apenas `Microsoft Zira Desktop` (`en-US`) e `Microsoft Helia` (`pt-PT`). Não há voz neural `pt-BR` nativa instalada offline.
- **Gemini API TTS (plugin `gemini-api` instalado):** requer `GEMINI_API_KEY` configurada (Google AI Studio). Suporta Free Tier (sujeito a cotas/limites) ou Paid Tier (`gemini-3.8-flash-tts`: US$ 0,50 / 1M tokens de texto e US$ 9,00 / 1M tokens de áudio — ~US$ 0,0135/min até 31/12/2026; ou `gemini-3.8-flash-lite-tts`: US$ 6,00 / 1M tokens de áudio — ~US$ 0,009/min).
- **Execução suportada por `gerar_audiolivro.py`:**
  1. `--engine gemini` *(padrão)* via SDK oficial `google-genai >= 2.25.0` e Interactions API (`gemini-3.8-flash-tts` / `gemini-3.8-flash-lite-tts`, voz padrão `Charon`, blocos <= 2.200 caracteres, concatenação MP3 via `imageio-ffmpeg`);
  2. `--engine edge` (gratuito, sem API key, via `edge-tts` com voz neural `pt-BR-AntonioNeural` via `uv`, requer conexão com internet);
  3. `--engine gcloud` (via `google-cloud-texttospeech`, exige `GOOGLE_APPLICATION_CREDENTIALS` autorizada e sujeita a faturamento);
  4. `--dry-run` (validação local de normalização e divisão em blocos, sem chamada de rede).

## Como Gerar os MP3s (com `uv` instalado no sistema)

Para validar localmente a normalização e contagem dos 81 blocos sem sintetizar áudio:

```powershell
uv run --offline --no-project python gerar_audiolivro.py --engine gemini --dry-run
```

Para sintetizar com **Gemini API TTS** (defina antes `$env:GEMINI_API_KEY`):

```powershell
$env:GEMINI_API_KEY="SUA_CHAVE_AQUI"
uv run --with "google-genai>=2.25.0" --with imageio-ffmpeg python gerar_audiolivro.py --engine gemini --model gemini-3.8-flash-tts --voice Charon
```

Para testar apenas o Capítulo 1 primeiro (recomendado para conferir voz e ritmo):

```powershell
uv run --with "google-genai>=2.25.0" --with imageio-ffmpeg python gerar_audiolivro.py --engine gemini --chapters 01
```

Alternativa sem API key com motor neural gratuito `edge-tts`:

```powershell
uv run --with edge-tts --with imageio-ffmpeg python gerar_audiolivro.py --engine edge --voice pt-BR-AntonioNeural --rate="-6%"
```

## Inventário dos Áudios Gerados (`edge-tts` / `pt-BR-AntonioNeural`, `--rate="-6%"`)

Formato padronizado: `MP3`, `24.000 Hz`, mono, `128 kb/s` (concatenação via `imageio-ffmpeg` com pausas de `0,45 s` entre blocos e `2,0 s` entre capítulos).

| Arquivo | Tamanho | Duração |
|---|---:|---:|
| `AUDIO/01_Introducao.mp3` | 10,25 MB | 00:11:11.86 |
| `AUDIO/02_Ambiente_Economico.mp3` | 15,68 MB | 00:17:07.59 |
| `AUDIO/03_Problema_Intertemporal.mp3` | 11,73 MB | 00:12:48.47 |
| `AUDIO/04_VFI.mp3` | 12,69 MB | 00:13:51.55 |
| `AUDIO/05_EGM.mp3` | 10,39 MB | 00:11:20.66 |
| `AUDIO/06_DC_EGM.mp3` | 17,39 MB | 00:18:59.28 |
| `AUDIO/07_Implementacao_MATLAB.mp3` | 12,36 MB | 00:13:29.92 |
| `AUDIO/08_Distribuicao_Estacionaria.mp3` | 10,42 MB | 00:11:22.91 |
| `AUDIO/09_Equilibrio_Geral.mp3` | 9,64 MB | 00:10:31.42 |
| `AUDIO/10_Resultados_Computacionais.mp3` | 11,26 MB | 00:12:17.76 |
| `AUDIO/11_Resultados_Economicos.mp3` | 9,48 MB | 00:10:21.29 |
| `AUDIO/12_Conclusao.mp3` | 6,43 MB | 00:07:01.23 |
| **`AUDIO_COMPLETO/AUDIOLIVRO_DC_EGM_VFI_COMPLETO.mp3`** | **138,03 MB** | **02:30:45.94** |
