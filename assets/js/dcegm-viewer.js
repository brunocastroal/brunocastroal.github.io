/**
 * assets/js/dcegm-viewer.js
 * Visualizador Científico Interativo v2 em HTML5 Canvas para DC-EGM vs. VFI
 * Lê dados pré-computados do modelo em materials/dc_egm_vfi/dc_egm_vfi_interactive.json
 */

(function () {
  'use strict';

  const container = document.getElementById('dcegm-explorer');
  if (!container) return;

  const viewerScript = document.querySelector('script[data-json-url]');
  const isPost = window.location.pathname.includes('/posts/');
  const JSON_URL = (viewerScript && viewerScript.getAttribute('data-json-url'))
    || ((isPost ? '../' : '') + 'materials/dc_egm_vfi/dc_egm_vfi_interactive.json');
  const OCC_SHORT = ['N', 'I', 'F'];

  const DEFAULTS = {
    iz: 2,
    dPrev: 2,
    policyVar: 'ap',
    compareVfi: true,
    zoomLow: true,
    foldZoomLow: false,
    foldMode: 'endo',
    foldIdx: 1,
    distView: 'mu',
    benchView: 'multigrade'
  };

  let DATA = null;
  let rafId = null;
  let state = Object.assign({ tab: 'policies' }, DEFAULTS);
  let hoverState = { active: false, px: 0, py: 0 };

  function getPalette() {
    const dark = document.body.classList.contains('dark');
    return {
      bg: dark ? '#131821' : '#ffffff',
      bgSubtle: dark ? '#192130' : '#f8fafc',
      ink: dark ? '#f1f5f9' : '#1e293b',
      muted: dark ? '#94a3b8' : '#64748b',
      grid: dark ? '#263144' : '#e2e8f0',
      dc: dark ? '#58a6ff' : '#0969da',
      vfi: dark ? '#f59e0b' : '#d97706',
      green: dark ? '#34d399' : '#059669',
      slate: dark ? '#94a3b8' : '#475569',
      crimson: dark ? '#f87171' : '#dc2626',
      shade: dark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.16)'
    };
  }

  function fmt(v, d = 4) {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function fmtSci(v) {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    return `<span class="dcegm-nowrap">${Number(v).toExponential(2).replace('.', ',')}</span>`;
  }

  function nw(txt) {
    return `<span class="dcegm-nowrap">${txt}</span>`;
  }

  function getChartMeta() {
    if (state.tab === 'policies') {
      const titles = {
        ap: "Poupança ótima a'(a)",
        c: 'Consumo ótimo c*(a)',
        V: 'Função valor V(a)',
        net: "Poupança líquida a'(a) − a",
        d_star: 'Ocupação ótima d*(a) em degraus'
      };
      return {
        heading: `${titles[state.policyVar]} — ${state.compareVfi ? 'DC-EGM versus VFI' : 'DC-EGM'}`,
        regime: 'EG · Na = 400 · χ̄ = 0,05'
      };
    }
    if (state.tab === 'folds') {
      return state.foldMode === 'endo'
        ? { heading: 'Seleção do ramo dominante — Upper Envelope', regime: `EP · Na = 1600 · χ̄ = 0,05 · r = ${fmt(DATA ? DATA.dobras_ep.r_pct : 4.17, 2)}%` }
        : { heading: 'Seleção discreta em v_d(a) — Upper Envelope', regime: 'EG · Na = 400 · χ̄ = 0,05 · r* = 2,80%' };
    }
    if (state.tab === 'dist') {
      const titles = {
        mu: 'Distribuição estacionária da riqueza — DC-EGM versus VFI',
        cdf: 'Distribuição acumulada da riqueza F(a) — DC-EGM versus VFI',
        bisection: 'Convergência da bisseção r* — DC-EGM versus VFI'
      };
      return { heading: titles[state.distView], regime: 'EG · Na = 400 · Young (2010)' };
    }
    return state.benchView === 'multigrade'
      ? { heading: 'Escalabilidade por resolução da malha — EP', regime: 'EP Multigrade · χ̄ = 0,05' }
      : { heading: 'Fronteira Tempo × Erro de Euler — Benchmark Histórico', regime: 'Benchmark Histórico · χ̄ = 0' };
  }

  function pairSeries(xs, ys, maxX = Infinity) {
    const out = [];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i], y = ys[i];
      if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y) && x <= maxX) {
        out.push({ x, y });
      }
    }
    return out;
  }

  function computeCdf(mu) {
    const cdf = new Array(mu.length);
    let acc = 0;
    for (let i = 0; i < mu.length; i++) {
      acc += mu[i] || 0;
      cdf[i] = Math.min(1, acc);
    }
    return cdf;
  }

  function setupCanvas(canvas, customHeight = null) {
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(280, Math.floor(rect.width));
    const h = customHeight || (w < 560 ? 320 : 410);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function niceBounds(values, padRatio = 0.07) {
    let mn = Infinity, mx = -Infinity;
    for (const v of values) {
      if (v !== null && Number.isFinite(v)) {
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    if (!Number.isFinite(mn) || !Number.isFinite(mx)) return [0, 1];
    if (Math.abs(mx - mn) < 1e-9) return [mn - 1, mx + 1];
    const span = mx - mn;
    return [mn - span * padRatio, mx + span * padRatio];
  }

  function drawAxesInBox(ctx, bx, by, bw, bh, pad, xMin, xMax, yMin, yMax, pal, opts = {}) {
    const plotW = bw - pad.l - pad.r;
    const plotH = bh - pad.t - pad.b;
    const ox = bx + pad.l;
    const oy = by + pad.t;
    const xLog = !!opts.xLog;
    const yLog = !!opts.yLog;
    const tickCount = opts.ticks || 5;
    const compact = !!opts.compact;

    ctx.fillStyle = pal.bg;
    ctx.fillRect(bx, by, bw, bh);

    const tx = (x) => {
      const val = xLog ? Math.log10(Math.max(x, 1e-12)) : x;
      const mn = xLog ? Math.log10(Math.max(xMin, 1e-12)) : xMin;
      const mx = xLog ? Math.log10(Math.max(xMax, 1e-12)) : xMax;
      return ox + ((val - mn) / (mx - mn || 1)) * plotW;
    };
    const ty = (y) => {
      const val = yLog ? Math.log10(Math.max(y, 1e-12)) : y;
      const mn = yLog ? Math.log10(Math.max(yMin, 1e-12)) : yMin;
      const mx = yLog ? Math.log10(Math.max(yMax, 1e-12)) : yMax;
      return oy + plotH - ((val - mn) / (mx - mn || 1)) * plotH;
    };

    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    ctx.font = compact ? '10px Inter, -apple-system, sans-serif' : '11.5px Inter, -apple-system, sans-serif';
    ctx.fillStyle = pal.muted;

    for (let t = 0; t <= tickCount; t++) {
      const frac = t / tickCount;
      const py = oy + plotH - frac * plotH;
      ctx.beginPath();
      ctx.moveTo(ox, py);
      ctx.lineTo(ox + plotW, py);
      ctx.stroke();

      if (opts.yFormatter) {
        const yVal = yLog
          ? Math.pow(10, Math.log10(yMin) + frac * (Math.log10(yMax) - Math.log10(yMin)))
          : yMin + frac * (yMax - yMin);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(opts.yFormatter(yVal), ox - 6, py);
      }
    }

    for (let t = 0; t <= tickCount; t++) {
      const frac = t / tickCount;
      const px = ox + frac * plotW;
      ctx.beginPath();
      ctx.moveTo(px, oy);
      ctx.lineTo(px, oy + plotH);
      ctx.stroke();

      if (opts.xFormatter) {
        const xVal = xLog
          ? Math.pow(10, Math.log10(xMin) + frac * (Math.log10(xMax) - Math.log10(xMin)))
          : xMin + frac * (xMax - xMin);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(opts.xFormatter(xVal), px, oy + plotH + 6);
      }
    }

    ctx.strokeStyle = pal.grid;
    ctx.strokeRect(ox, oy, plotW, plotH);

    if (opts.title) {
      ctx.fillStyle = pal.ink;
      ctx.font = compact ? '700 10.5px Merriweather, Georgia, serif' : '700 12px Merriweather, Georgia, serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(opts.title, compact ? bx + 8 : ox, by + 5);
    }

    if (opts.xLabel) {
      ctx.fillStyle = pal.ink;
      ctx.font = compact ? '600 10.5px Inter, -apple-system, sans-serif' : '600 12.5px Inter, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(opts.xLabel, ox + plotW / 2, by + bh - 3);
    }

    if (opts.yLabel) {
      ctx.save();
      ctx.fillStyle = pal.ink;
      ctx.font = compact ? '600 10.5px Inter, -apple-system, sans-serif' : '600 12.5px Inter, -apple-system, sans-serif';
      ctx.translate(bx + 6, oy + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(opts.yLabel, 0, 0);
      ctx.restore();
    }

    return { tx, ty, ox, oy, plotW, plotH };
  }

  function drawLineSeries(ctx, pts, tx, ty, color, opts = {}) {
    if (!pts.length) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = opts.width || 2.5;
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    if (opts.dashed) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    pts.forEach((p, idx) => {
      const x = tx(p.x), y = ty(p.y);
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        if (opts.step) ctx.lineTo(x, ty(pts[idx - 1].y));
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    if (opts.fillAlpha) {
      const yZero = ty(opts.baseline !== undefined ? opts.baseline : 0);
      ctx.lineTo(tx(pts[pts.length - 1].x), yZero);
      ctx.lineTo(tx(pts[0].x), yZero);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.globalAlpha = opts.fillAlpha;
      ctx.fill();
    }
    ctx.restore();
  }

  function nearestIndex(xs, targetX, maxX = Infinity) {
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] > maxX) break;
      const d = Math.abs(xs[i] - targetX);
      if (d < bestDist) { best = i; bestDist = d; }
    }
    return best;
  }

  function nearestPoint(pts, targetX) {
    if (!pts.length) return null;
    let best = pts[0], bestDist = Math.abs(pts[0].x - targetX);
    for (let i = 1; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - targetX);
      if (d < bestDist) { best = pts[i]; bestDist = d; }
    }
    return best;
  }

  function analyzeEnvelopeBranches(aGrid, branches, maxX) {
    const pts = [];
    const crossings = [];
    let prevDom = null;

    for (let i = 0; i < aGrid.length; i++) {
      const a = aGrid[i];
      if (a > maxX) break;
      const vals = [branches[0][i], branches[1][i], branches[2][i]];
      let bestD = null, bestV = -Infinity;
      for (let d = 0; d < 3; d++) {
        if (vals[d] !== null && Number.isFinite(vals[d]) && vals[d] > bestV) {
          bestV = vals[d];
          bestD = d;
        }
      }
      if (bestD === null) continue;

      if (prevDom !== null && bestD !== prevDom.dom) {
        const dA = prevDom.dom, dB = bestD;
        const va0 = prevDom.vals[dA], va1 = vals[dA];
        const vb0 = prevDom.vals[dB], vb1 = vals[dB];
        if (va0 !== null && va1 !== null && vb0 !== null && vb1 !== null) {
          const denom = (va1 - va0) - (vb1 - vb0);
          const t = Math.abs(denom) > 1e-12 ? Math.max(0, Math.min(1, (vb0 - va0) / denom)) : 0.5;
          crossings.push({ x: prevDom.a + t * (a - prevDom.a), y: va0 + t * (va1 - va0), from: dA, to: dB });
        } else {
          crossings.push({ x: a, y: bestV, from: dA, to: dB });
        }
      }
      pts.push({ a, vals, dom: bestD, vEnv: bestV });
      prevDom = { a, vals, dom: bestD, vEnv: bestV };
    }
    return { pts, crossings };
  }

  function drawDistributionInset(ctx, box, aFull, dcMu, vfiMu, pal) {
    const maxA = 3.0;
    const sDc = pairSeries(aFull, dcMu, maxA);
    const sVfi = pairSeries(aFull, vfiMu, maxA);
    const [, yMax] = niceBounds([...sDc.map(p => p.y), ...sVfi.map(p => p.y), 0], 0.1);

    ctx.save();
    ctx.fillStyle = pal.bgSubtle;
    ctx.strokeStyle = pal.muted;
    ctx.lineWidth = 1;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    const pad = { l: 38, r: 8, t: 22, b: 22 };
    const ax = drawAxesInBox(ctx, box.x + 1, box.y + 1, box.w - 2, box.h - 2, pad, 0, maxA, 0, yMax, pal, {
      title: 'Zoom: a ∈ [0, 3]',
      xFormatter: (v) => v.toFixed(1),
      yFormatter: (v) => (v * 100).toFixed(0) + '%',
      ticks: 3,
      compact: true
    });

    drawLineSeries(ctx, sDc, ax.tx, ax.ty, pal.dc, { width: 2.1, fillAlpha: 0.14, baseline: 0 });
    drawLineSeries(ctx, sVfi, ax.tx, ax.ty, pal.vfi, { width: 1.9, dashed: true });

    // Highlight mass points exactly at a=0
    [ { y: dcMu[0], c: pal.dc }, { y: vfiMu[0], c: pal.vfi } ].forEach(({ y, c }) => {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(ax.tx(0), ax.ty(y), 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = pal.bg; ctx.lineWidth = 1.2; ctx.stroke();
    });
    ctx.restore();
  }

  function renderChart() {
    const canvas = container.querySelector('#dcegm-canvas');
    const headingEl = container.querySelector('#dcegm-chart-heading');
    const regimeEl = container.querySelector('#dcegm-regime');
    const readoutEl = container.querySelector('#dcegm-readout');
    const legendEl = container.querySelector('#dcegm-legend');
    const kpiEl = container.querySelector('#dcegm-kpis');
    if (!canvas || !DATA) return;

    const metaInfo = getChartMeta();
    if (headingEl) headingEl.textContent = metaInfo.heading;
    if (regimeEl) regimeEl.textContent = metaInfo.regime;

    const pal = getPalette();
    const occColors = [pal.slate, pal.green, pal.dc];
    const eq = DATA.equilibrio_geral;
    const aGrid = DATA.meta.a_sampled;
    const zVals = DATA.meta.z;
    const occNames = DATA.meta.occupations;

    const isDualEndo = (state.tab === 'folds' && state.foldMode === 'endo');
    const rectW = Math.max(280, Math.floor(canvas.parentElement.getBoundingClientRect().width));
    let customH = null;
    if (isDualEndo) {
      customH = rectW < 620 ? 540 : 450;
    } else if (state.tab === 'folds' || state.tab === 'bench') {
      customH = rectW < 560 ? 340 : 440;
    }
    const { ctx, w, h } = setupCanvas(canvas, customH);
    const pad = { l: w < 460 ? 60 : 68, r: 18, t: 18, b: 40 };
    kpiEl.className = (state.tab === 'policies' || state.tab === 'dist') ? 'dcegm-kpis dcegm-kpi-groups' : 'dcegm-kpis';

    // --------------------------------------------------------
    // TAB 1: POLICIES & VALUE FUNCTION (EG Na=400)
    // --------------------------------------------------------
    if (state.tab === 'policies') {
      const maxX = state.zoomLow ? 20 : 80;
      const dcSol = eq.dc;
      const vfiSol = eq.vfi;

      const getSeries = (sol) => {
        if (state.policyVar === 'V') return pairSeries(aGrid, sol.V[state.dPrev][state.iz], maxX);
        if (state.policyVar === 'c') return pairSeries(aGrid, sol.c[state.dPrev][state.iz], maxX);
        if (state.policyVar === 'ap') return pairSeries(aGrid, sol.ap[state.dPrev][state.iz], maxX);
        if (state.policyVar === 'net') {
          const ap = sol.ap[state.dPrev][state.iz];
          return pairSeries(aGrid, ap.map((v, i) => (v !== null ? v - aGrid[i] : null)), maxX);
        }
        return pairSeries(aGrid, sol.d_star[state.dPrev][state.iz], maxX);
      };

      const ptsDc = getSeries(dcSol);
      const ptsVfi = state.compareVfi ? getSeries(vfiSol) : [];
      const isStep = state.policyVar === 'd_star';

      let yMin, yMax;
      if (isStep) {
        yMin = 0.7; yMax = 3.3;
      } else {
        const allY = ptsDc.map(p => p.y).concat(ptsVfi.map(p => p.y));
        if (state.policyVar === 'net') allY.push(0);
        [yMin, yMax] = niceBounds(allY);
      }

      const yLabels = {
        V: 'Função Valor V(a)',
        c: 'Consumo c*(a)',
        ap: "Poupança a'(a)",
        net: "Poupança Líq. a'(a) − a",
        d_star: 'Ocupação (1=N, 2=I, 3=F)'
      };
      const yFmt = isStep
        ? (v) => (Math.abs(v - 1) < 0.2 ? '1 (N)' : Math.abs(v - 2) < 0.2 ? '2 (I)' : Math.abs(v - 3) < 0.2 ? '3 (F)' : '')
        : (v) => Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1);

      const ax = drawAxesInBox(ctx, 0, 0, w, h, pad, 0, maxX, yMin, yMax, pal, {
        xLabel: 'Ativos a',
        yLabel: yLabels[state.policyVar],
        xFormatter: (v) => v.toFixed(0),
        yFormatter: yFmt
      });

      if (isStep) {
        ctx.save();
        const bands = [
          { y0: 0.7, y1: 1.5, c: pal.slate },
          { y0: 1.5, y1: 2.5, c: pal.green },
          { y0: 2.5, y1: 3.3, c: pal.dc }
        ];
        ctx.globalAlpha = 0.06;
        bands.forEach((b) => {
          ctx.fillStyle = b.c;
          const py1 = ax.ty(b.y1), py0 = ax.ty(b.y0);
          ctx.fillRect(ax.ox, py1, ax.plotW, Math.max(0, py0 - py1));
        });
        ctx.restore();
      } else if (state.policyVar === 'net') {
        drawLineSeries(ctx, [{ x: 0, y: 0 }, { x: maxX, y: 0 }], ax.tx, ax.ty, pal.muted, { width: 1.2, dashed: true });
      } else if (state.policyVar === 'ap') {
        drawLineSeries(ctx, [{ x: 0, y: 0 }, { x: Math.min(maxX, yMax), y: Math.min(maxX, yMax) }], ax.tx, ax.ty, pal.muted, { width: 1.2, dashed: true });
      }

      drawLineSeries(ctx, ptsDc, ax.tx, ax.ty, pal.dc, { width: 2.6, step: isStep });
      if (state.compareVfi) {
        drawLineSeries(ctx, ptsVfi, ax.tx, ax.ty, pal.vfi, { width: 2.2, dashed: true, step: isStep });
      }

      const uniqueStepOccs = isStep ? new Set(ptsDc.map(p => p.y).concat(ptsVfi.map(p => p.y))) : null;
      const stepHint = isStep
        ? (uniqueStepOccs.size <= 1
          ? ` Códigos: <strong>1 = Inatividade (N)</strong> &middot; <strong>2 = Informalidade (I)</strong> &middot; <strong>3 = Formalidade (F)</strong>. Sem transição neste recorte (constante ${occNames[ptsDc[0].y - 1]}) — desmarque o zoom ou escolha z1 para ver degraus.`
          : ' Códigos: <strong>1 = Inatividade (N)</strong> &middot; <strong>2 = Informalidade (I)</strong> &middot; <strong>3 = Formalidade (F)</strong>.')
        : '';

      let infoText = `Equilíbrio Geral (Na=400, z${state.iz + 1}=${fmt(zVals[state.iz], 3)}, d⁻=${occNames[state.dPrev]}): passe o cursor ou toque no gráfico.` +
        stepHint +
        `<br>Nota: ||&Delta;V||<sub>&infin;</sub> e ||&Delta;c||<sub>&infin;</sub> medem discrepância máxima entre soluções finais DC-EGM e VFI (sob r* distintos por 1,8 pb), não erro de convergência.`;

      if (hoverState.active && hoverState.px >= ax.ox && hoverState.px <= ax.ox + ax.plotW) {
        const targetX = ((hoverState.px - ax.ox) / ax.plotW) * maxX;
        const pDc = nearestPoint(ptsDc, targetX);
        const pVfi = state.compareVfi ? nearestPoint(ptsVfi, targetX) : null;
        if (pDc) {
          const cx = ax.tx(pDc.x);
          ctx.save();
          ctx.strokeStyle = pal.muted; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(cx, ax.oy); ctx.lineTo(cx, ax.oy + ax.plotH); ctx.stroke();
          ctx.fillStyle = pal.dc; ctx.beginPath(); ctx.arc(cx, ax.ty(pDc.y), 4.8, 0, Math.PI * 2); ctx.fill();
          if (pVfi) {
            ctx.fillStyle = pal.vfi; ctx.beginPath(); ctx.arc(ax.tx(pVfi.x), ax.ty(pVfi.y), 4.2, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();

          const dcValStr = isStep ? occNames[Math.round(pDc.y) - 1] : fmt(pDc.y, 4);
          const vfiValStr = pVfi ? (isStep ? occNames[Math.round(pVfi.y) - 1] : fmt(pVfi.y, 4)) : null;
          infoText = `<strong>a = ${fmt(pDc.x, 2)}</strong> &middot; <span style="color:${pal.dc}">DC-EGM: ${dcValStr}</span>` +
            (vfiValStr ? ` &middot; <span style="color:${pal.vfi}">VFI: ${vfiValStr}</span>` : '');
        }
      }
      readoutEl.innerHTML = infoText;
      legendEl.innerHTML = `<span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>DC-EGM (Upper Envelope)</span>` +
        (state.compareVfi ? `<span class="dcegm-leg-item"><i class="dashed" style="border-color:${pal.vfi}"></i>VFI Vetorizada</span>` : '') +
        (isStep ? `<span class="dcegm-leg-item">1 = Inatividade (N) &middot; 2 = Informalidade (I) &middot; 3 = Formalidade (F)</span>` : '');
      kpiEl.innerHTML = `
        <div class="dcegm-kpi-group">
          <div class="dcegm-group-title">Resultados do equilíbrio (Na=400)</div>
          <div class="dcegm-group-pair">
            <div class="dcegm-kpi dcegm-kpi-primary kpi-dc"><span>Taxa de juros r*</span><strong>${nw(`${fmt(dcSol.resumo.r, 4)}%`)}</strong><small>DC-EGM &middot; VFI: ${fmt(vfiSol.resumo.r, 4)}%</small></div>
            <div class="dcegm-kpi kpi-dc"><span>Salário real w*</span><strong>${nw(fmt(dcSol.resumo.w, 4))}</strong><small>DC-EGM &middot; VFI: ${fmt(vfiSol.resumo.w, 4)}</small></div>
          </div>
        </div>
        <div class="dcegm-kpi-group">
          <div class="dcegm-group-title">Diagnósticos de comparação (soluções EG)</div>
          <div class="dcegm-group-pair">
            <div class="dcegm-kpi" title="Diferença máxima entre funções valor DC-EGM e VFI no EG (Na=400); não é resíduo de convergência"><span>Discrepância em V</span><strong>${fmt(eq.discrepancias.dif_sup_V, 4)}</strong><small>||&Delta;V||<sub>&infin;</sub> (DC vs VFI)</small></div>
            <div class="dcegm-kpi" title="Diferença máxima entre políticas de consumo DC-EGM e VFI no EG (Na=400); não é resíduo de convergência"><span>Discrepância em consumo</span><strong>${fmt(eq.discrepancias.dif_sup_c, 4)}</strong><small>||&Delta;c||<sub>&infin;</sub> (DC vs VFI)</small></div>
          </div>
        </div>
      `;
    }

    // --------------------------------------------------------
    // TAB 2: UPPER ENVELOPE (2-Panel EP Folds OR EG v_d Branches)
    // --------------------------------------------------------
    else if (state.tab === 'folds') {
      const row1600 = DATA.benchmarks.multigrade.find(r => String(r.Na) === '1600');
      const conc1600 = row1600 ? fmt(parseFloat(row1600.Concordancia_Ocup_pct), 2) + '%' : '—';

      if (state.foldMode === 'endo') {
        const folds = DATA.dobras_ep.folds;
        const fItem = folds[state.foldIdx] || folds[0];
        const ev = fItem.envelope;
        const kRel = fItem.k_rel;
        const kFim = fItem.k_fim_rel;

        const ptsAll = fItem.fold_a_prime.map((ap, i) => ({ x: ap, y: fItem.fold_a_endo[i] }));
        const ptsR1 = ptsAll.slice(0, kRel + 1);
        const ptsInv = ptsAll.slice(kRel, kFim + 1);
        const ptsR2 = ptsAll.slice(kFim);

        const xMinA = ptsAll[0].x, xMaxA = ptsAll[ptsAll.length - 1].x;
        const [yMinA, yMaxA] = niceBounds(ptsAll.map(p => p.y), 0.14);

        const stacked = w < 620;
        const boxA = stacked
          ? { x: 0, y: 0, w: w, h: Math.floor(h / 2) - 4 }
          : { x: 0, y: 0, w: Math.floor(w / 2) - 6, h: h };
        const boxB = stacked
          ? { x: 0, y: Math.floor(h / 2) + 4, w: w, h: h - Math.floor(h / 2) - 4 }
          : { x: Math.floor(w / 2) + 6, y: 0, w: w - Math.floor(w / 2) - 6, h: h };

        const subPad = { l: w < 460 ? 54 : 60, r: 28, t: 28, b: 38 };

        // --- PAINEL A: Grade endogena nao-monotonica ---
        const axA = drawAxesInBox(ctx, boxA.x, boxA.y, boxA.w, boxA.h, subPad, xMinA, xMaxA, yMinA, yMaxA, pal, {
          title: 'Painel A · Dobra na Grade Endógena',
          xLabel: "Poupança a' (controle)",
          yLabel: "Ativos a_endog(a')",
          xFormatter: (v) => v.toFixed(2),
          yFormatter: (v) => v.toFixed(2),
          ticks: 3
        });

        // Shade multivalued interval horizontally in Painel A
        ctx.save();
        ctx.fillStyle = pal.shade;
        const yTopShade = axA.ty(ev.ov_max), yBotShade = axA.ty(ev.ov_min);
        ctx.fillRect(axA.ox, yTopShade, axA.plotW, Math.max(2, yBotShade - yTopShade));
        ctx.restore();

        drawLineSeries(ctx, ptsR1, axA.tx, axA.ty, pal.dc, { width: 2.5 });
        drawLineSeries(ctx, ptsR2, axA.tx, axA.ty, pal.green, { width: 2.5 });
        drawLineSeries(ctx, ptsInv, axA.tx, axA.ty, pal.crimson, { width: 2.8, dashed: true });

        // Markers
        ctx.save();
        ptsR1.forEach((p, idx) => {
          if (idx % 2 === 0 || idx === ptsR1.length - 1) {
            ctx.fillStyle = pal.dc;
            ctx.beginPath(); ctx.arc(axA.tx(p.x), axA.ty(p.y), 3, 0, Math.PI * 2); ctx.fill();
          }
        });
        ptsR2.forEach((p, idx) => {
          if (idx % 2 === 0 || idx === 0) {
            ctx.fillStyle = pal.green;
            ctx.fillRect(axA.tx(p.x) - 2.8, axA.ty(p.y) - 2.8, 5.6, 5.6);
          }
        });
        ptsInv.forEach((p) => {
          const px = axA.tx(p.x), py = axA.ty(p.y);
          ctx.strokeStyle = pal.crimson; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(px - 4, py - 4); ctx.lineTo(px + 4, py + 4); ctx.moveTo(px + 4, py - 4); ctx.lineTo(px - 4, py + 4); ctx.stroke();
        });
        ctx.restore();

        // --- PAINEL B: Ramos v1 vs v2 e Envoltória Superior ---
        const ptsV1 = ev.a1.map((x, i) => ({ x, y: ev.dv1[i] }));
        const ptsV2 = ev.a2.map((x, i) => ({ x, y: ev.dv2[i] }));
        const xMinB = Math.min(ev.a1[0], ev.a2[0]);
        const xMaxB = Math.max(ev.a1[ev.a1.length - 1], ev.a2[ev.a2.length - 1]);
        const [yMinB, yMaxB] = niceBounds([...ev.dv1, ...ev.dv2], 0.14);

        const axB = drawAxesInBox(ctx, boxB.x, boxB.y, boxB.w, boxB.h, subPad, xMinB, xMaxB, yMinB, yMaxB, pal, {
          title: 'Painel B · Poda e Envoltória Superior',
          xLabel: 'Ativos Iniciais a (zoom na dobra)',
          yLabel: 'Desvio v − reta (×10⁻⁴)',
          xFormatter: (v) => v.toFixed(3),
          yFormatter: (v) => v.toFixed(1),
          ticks: 2
        });

        // Shade multivalued interval vertically in Painel B
        ctx.save();
        ctx.fillStyle = pal.shade;
        const xLeftShade = axB.tx(ev.ov_min), xRightShade = axB.tx(ev.ov_max);
        ctx.fillRect(xLeftShade, axB.oy, Math.max(2, xRightShade - xLeftShade), axB.plotH);
        ctx.restore();

        // Pruned/candidate curves (dashed thinner)
        drawLineSeries(ctx, ptsV1, axB.tx, axB.ty, pal.dc, { width: 1.7, dashed: true, alpha: 0.72 });
        drawLineSeries(ctx, ptsV2, axB.tx, axB.ty, pal.green, { width: 1.7, dashed: true, alpha: 0.72 });

        // Active Upper Envelope selected
        const winCut = ev.a_cross;
        const active1 = ptsV1.filter(p => p.x <= winCut + 1e-6);
        const active2 = ptsV2.filter(p => p.x >= winCut - 1e-6);
        if (ev.ov_winner === 'cross' && active1.length && active2.length) {
          active1.push({ x: ev.a_cross, y: ev.dv_cross });
          active2.unshift({ x: ev.a_cross, y: ev.dv_cross });
        }
        drawLineSeries(ctx, active1, axB.tx, axB.ty, pal.dc, { width: 3.4 });
        drawLineSeries(ctx, active2, axB.tx, axB.ty, pal.green, { width: 3.4 });

        // Crossing / cut marker
        ctx.save();
        const cxB = axB.tx(ev.a_cross), cyB = axB.ty(ev.dv_cross);
        ctx.strokeStyle = pal.crimson; ctx.lineWidth = 1.3; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(cxB, axB.oy); ctx.lineTo(cxB, axB.oy + axB.plotH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = pal.crimson; ctx.beginPath(); ctx.arc(cxB, cyB, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = pal.bg; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.fillStyle = pal.ink; ctx.font = '600 10.5px Inter, sans-serif';
        ctx.textAlign = cxB > axB.ox + axB.plotW * 0.55 ? 'right' : 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Corte a*=${ev.a_cross.toFixed(3)}`, cxB + (cxB > axB.ox + axB.plotW * 0.55 ? -7 : 7), Math.max(axB.oy + 16, cyB - 6));
        ctx.restore();

        let infoText = `${fItem.label} &middot; Faixa multivalorada a &isin; [${fmt(ev.ov_min, 4)}, ${fmt(ev.ov_max, 4)}]. ` +
          (ev.has_crossing
            ? `Cruzamento interior em <strong>a* = ${fmt(ev.a_cross, 4)}</strong>: Ramo 1 domina até a*, Ramo 2 acima (trechos em tracejado são podados).`
            : `Ramo 2 domina toda a faixa sobreposta a partir de <strong>a* = ${fmt(ev.a_cross, 4)}</strong> (ponta subótima do Ramo 1 é podada).`);

        if (hoverState.active) {
          if (hoverState.px >= axA.ox && hoverState.px <= axA.ox + axA.plotW && hoverState.py >= boxA.y && hoverState.py <= boxA.y + boxA.h) {
            const txVal = xMinA + ((hoverState.px - axA.ox) / axA.plotW) * (xMaxA - xMinA);
            const p = nearestPoint(ptsAll, txVal);
            if (p) {
              const isInv = ptsInv.some(q => q.x === p.x);
              const isR2 = p.x >= ptsR2[0].x && !isInv;
              const col = isInv ? pal.crimson : (isR2 ? pal.green : pal.dc);
              ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(axA.tx(p.x), axA.ty(p.y), 5.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
              infoText = `<strong>Painel A · a' = ${fmt(p.x, 4)}</strong> &rarr; a_endog = <strong>${fmt(p.y, 4)}</strong> ` +
                `<span style="color:${col};font-weight:600">(${isInv ? 'Trecho invertido descartado' : isR2 ? 'Ramo 2 pós-dobra' : 'Ramo 1 pré-dobra'})</span>`;
            }
          } else if (hoverState.px >= axB.ox && hoverState.px <= axB.ox + axB.plotW && hoverState.py >= boxB.y && hoverState.py <= boxB.y + boxB.h) {
            const txVal = xMinB + ((hoverState.px - axB.ox) / axB.plotW) * (xMaxB - xMinB);
            const p1 = nearestPoint(ptsV1, txVal), p2 = nearestPoint(ptsV2, txVal);
            const winR = (txVal <= ev.a_cross && ev.ov_winner !== 'r2') ? 'Ramo 1 (azul)' : (txVal < ev.ov_min ? 'Ramo 1 (azul)' : 'Ramo 2 (verde)');
            infoText = `<strong>Painel B · a = ${fmt(txVal, 4)}</strong> &middot; Vencedor: <strong>${winR}</strong>` +
              (p1 && txVal <= ev.ov_max ? ` | &Delta;v<sub>1</sub>=${fmt(p1.y, 2)}` : '') +
              (p2 && txVal >= ev.ov_min ? ` | &Delta;v<sub>2</sub>=${fmt(p2.y, 2)}` : '');
          }
        }
        readoutEl.innerHTML = infoText;
        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>Ramo 1 (pré-dobra / envelope)</span>
          <span class="dcegm-leg-item"><i style="background:${pal.green}"></i>Ramo 2 (pós-dobra / envelope)</span>
          <span class="dcegm-leg-item"><i class="dashed" style="border-color:${pal.crimson}"></i>Inversão (da/da'&lt;0)</span>
          <span class="dcegm-leg-item"><i class="swatch" style="background:${pal.shade};border:1px solid ${pal.vfi}"></i>Faixa multivalorada</span>
        `;
        kpiEl.innerHTML = `
          <div class="dcegm-kpi dcegm-kpi-primary"><span>Dobras Detectadas (EP Na=1600)</span><strong>${DATA.dobras_ep.total_dobras} dobras</strong><small>3 interiores + 1 na fronteira</small></div>
          <div class="dcegm-kpi"><span>Ponto de Poda (Dobra Atual)</span><strong>${nw(`a* = ${fmt(ev.a_cross, 4)}`)}</strong><small>[${fmt(ev.ov_min, 3)}; ${fmt(ev.ov_max, 3)}]</small></div>
          <div class="dcegm-kpi"><span>Dobras no EG (Na=400)</span><strong>${eq.dobras_eg} (monotônica)</strong><small>min &Delta;a_endog &gt; +0,12</small></div>
          <div class="dcegm-kpi"><span>Conc. d* (EP Na=1600)</span><strong>${conc1600}</strong><small>VFI vs DC-EGM em EP</small></div>
        `;
      } else {
        const maxX = state.foldZoomLow ? 25 : 80;
        const dcVc = eq.dc.v_cond[state.dPrev];
        const branches = [dcVc[0][state.iz], dcVc[1][state.iz], dcVc[2][state.iz]];
        const sN = pairSeries(aGrid, branches[0], maxX);
        const sI = pairSeries(aGrid, branches[1], maxX);
        const sF = pairSeries(aGrid, branches[2], maxX);

        const { pts: envPts, crossings } = analyzeEnvelopeBranches(aGrid, branches, maxX);
        const [yMin, yMax] = niceBounds([...sN, ...sI, ...sF].map(p => p.y));
        const ax = drawAxesInBox(ctx, 0, 0, w, h, pad, 0, maxX, yMin, yMax, pal, {
          xLabel: 'Ativos a',
          yLabel: 'Valor Condicional v_d(a, z, d⁻)',
          xFormatter: (v) => v.toFixed(0),
          yFormatter: (v) => v.toFixed(1)
        });

        drawLineSeries(ctx, sN, ax.tx, ax.ty, pal.slate, { width: 1.6, dashed: true, alpha: 0.72 });
        drawLineSeries(ctx, sI, ax.tx, ax.ty, pal.green, { width: 1.6, alpha: 0.55 });
        drawLineSeries(ctx, sF, ax.tx, ax.ty, pal.dc, { width: 1.6, alpha: 0.55 });

        let segStart = 0;
        for (let i = 0; i < envPts.length; i++) {
          const isEnd = (i === envPts.length - 1) || (envPts[i + 1].dom !== envPts[i].dom);
          if (isEnd) {
            const seg = envPts.slice(segStart, i + 1).map(p => ({ x: p.a, y: p.vEnv }));
            if (i + 1 < envPts.length) {
              const cMatch = crossings.find(c => c.x >= envPts[i].a && c.x <= envPts[i + 1].a);
              if (cMatch) seg.push({ x: cMatch.x, y: cMatch.y });
            }
            if (segStart > 0) {
              const cPrev = crossings.find(c => c.x >= envPts[segStart - 1].a && c.x <= envPts[segStart].a);
              if (cPrev) seg.unshift({ x: cPrev.x, y: cPrev.y });
            }
            drawLineSeries(ctx, seg, ax.tx, ax.ty, occColors[envPts[i].dom], { width: 3.4 });
            segStart = i + 1;
          }
        }

        let lastLabelX = -100;
        crossings.forEach((c) => {
          const cx = ax.tx(c.x), cy = ax.ty(c.y);
          ctx.save();
          ctx.fillStyle = pal.crimson; ctx.beginPath(); ctx.arc(cx, cy, 5.4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = pal.bg; ctx.lineWidth = 1.6; ctx.stroke();
          if (cx - lastLabelX > 52) {
            const lbl = `${OCC_SHORT[c.from]}→${OCC_SHORT[c.to]} (${c.x.toFixed(1)})`;
            ctx.font = '600 11px Inter, sans-serif'; ctx.fillStyle = pal.ink;
            ctx.textAlign = cx > ax.ox + ax.plotW - 60 ? 'right' : 'left'; ctx.textBaseline = 'bottom';
            ctx.fillText(lbl, cx + (cx > ax.ox + ax.plotW - 60 ? -6 : 6), Math.max(ax.oy + 14, cy - 6));
            lastLabelX = cx;
          }
          ctx.restore();
        });

        const pathSeq = envPts.reduce((acc, p) => {
          const s = OCC_SHORT[p.dom];
          if (!acc.length || acc[acc.length - 1] !== s) acc.push(s);
          return acc;
        }, []).join(' → ');

        let infoText = `Upper Envelope em EG (Na=400, z${state.iz + 1}=${fmt(zVals[state.iz], 3)}, d⁻=${occNames[state.dPrev]}): o algoritmo escolhe d*(a) = argmax_d v_d(a) em cada trecho (<strong>${pathSeq || '—'}</strong>) e descarta os ramos dominados além dos ${crossings.length} cruzamento(s).`;
        if (hoverState.active && hoverState.px >= ax.ox && hoverState.px <= ax.ox + ax.plotW) {
          const targetX = ((hoverState.px - ax.ox) / ax.plotW) * maxX;
          const pEnv = nearestPoint(envPts.map(p => ({ x: p.a, y: p.vEnv, raw: p })), targetX);
          if (pEnv) {
            const r = pEnv.raw, cx = ax.tx(r.a);
            ctx.save();
            ctx.strokeStyle = pal.muted; ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(cx, ax.oy); ctx.lineTo(cx, ax.oy + ax.plotH); ctx.stroke();
            ctx.fillStyle = occColors[r.dom]; ctx.beginPath(); ctx.arc(cx, ax.ty(r.vEnv), 5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            infoText = `<strong>a = ${fmt(r.a, 2)}</strong> &middot; Ocupação escolhida: <strong style="color:${occColors[r.dom]}">${occNames[r.dom]}</strong> (V=${fmt(r.vEnv, 3)}) | ` +
              `<span style="color:${pal.slate}">v_N:${r.vals[0] !== null ? fmt(r.vals[0], 2) : 'inviáv.'}</span> · ` +
              `<span style="color:${pal.green}">v_I:${r.vals[1] !== null ? fmt(r.vals[1], 2) : '—'}</span> · ` +
              `<span style="color:${pal.dc}">v_F:${r.vals[2] !== null ? fmt(r.vals[2], 2) : '—'}</span>`;
          }
        }
        readoutEl.innerHTML = infoText;
        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>Trecho Formal (F)</span>
          <span class="dcegm-leg-item"><i style="background:${pal.green}"></i>Trecho Informal (I)</span>
          <span class="dcegm-leg-item"><i class="dashed" style="border-color:${pal.slate}"></i>Ramo Inativo (v_N)</span>
          <span class="dcegm-leg-item"><i class="dot" style="background:${pal.crimson}"></i>Ponto de cruzamento (quina)</span>
        `;
        kpiEl.innerHTML = `
          <div class="dcegm-kpi dcegm-kpi-primary"><span>Sequência Dominante (EG)</span><strong>${pathSeq || '—'}</strong><small>Na = 400 · ${crossings.length} cruzamento(s)</small></div>
          <div class="dcegm-kpi"><span>Regime da Vista</span><strong>EG (Na = 400)</strong><small>r* = ${fmt(eq.dc.resumo.r, 2)}%</small></div>
          <div class="dcegm-kpi"><span>Dobras Grade EG (Na=400)</span><strong>${eq.dobras_eg} (monotônica)</strong><small>sem inversão da/da'</small></div>
          <div class="dcegm-kpi"><span>Dobras EP (Na=1600)</span><strong>${DATA.dobras_ep.total_dobras} dobras</strong><small>no experimento EP</small></div>
        `;
      }
    }

    // --------------------------------------------------------
    // TAB 3: STATIONARY DISTRIBUTION & GENERAL EQUILIBRIUM
    // --------------------------------------------------------
    else if (state.tab === 'dist') {
      const dcSol = eq.dc;
      const vfiSol = eq.vfi;
      const aFull = DATA.meta.a_full;
      const cdfDc = computeCdf(dcSol.mu_a);
      const cdfVfi = computeCdf(vfiSol.mu_a);

      if (state.distView === 'mu') {
        const maxX = state.zoomLow ? 25 : 80;
        const sDc = pairSeries(aFull, dcSol.mu_a, maxX);
        const sVfi = pairSeries(aFull, vfiSol.mu_a, maxX);
        const [, yMax] = niceBounds([...sDc.map(p => p.y), ...sVfi.map(p => p.y), 0], 0.08);
        const ax = drawAxesInBox(ctx, 0, 0, w, h, pad, 0, maxX, 0, yMax, pal, {
          xLabel: 'Ativos a',
          yLabel: 'Massa estacionária μ(a)',
          xFormatter: (v) => v.toFixed(0),
          yFormatter: (v) => (v * 100).toFixed(1) + '%'
        });

        drawLineSeries(ctx, sDc, ax.tx, ax.ty, pal.dc, { width: 2.5, fillAlpha: 0.14, baseline: 0 });
        drawLineSeries(ctx, sVfi, ax.tx, ax.ty, pal.vfi, { width: 2.2, dashed: true });

        // Distinct point-mass markers at a=0 constraint
        [ { y: dcSol.mu_a[0], c: pal.dc }, { y: vfiSol.mu_a[0], c: pal.vfi } ].forEach(({ y, c }) => {
          ctx.save();
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ax.tx(0), ax.ty(y), 5.2, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = pal.bg; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.restore();
        });

        // Embedded Zoom Inset near a = [0, 3]
        if (maxX > 6 && ax.plotW >= 230) {
          const insetW = Math.max(122, Math.min(240, Math.floor(ax.plotW * 0.46)));
          const insetH = Math.min(160, Math.floor(ax.plotH * 0.48));
          drawDistributionInset(ctx, { x: ax.ox + ax.plotW - insetW - 8, y: ax.oy + 10, w: insetW, h: insetH }, aFull, dcSol.mu_a, vfiSol.mu_a, pal);
        }

        let infoText = `EG (Na=400, Young 2010) &middot; Massa em a=0: DC ${fmt(dcSol.resumo.frac_a_min, 2)}% vs VFI ${fmt(vfiSol.resumo.frac_a_min, 2)}% | Média: ${fmt(dcSol.resumo.media_a, 2)} vs ${fmt(vfiSol.resumo.media_a, 2)} | P25: ${fmt(dcSol.resumo.P25, 2)} &middot; P50: ${fmt(dcSol.resumo.P50, 2)} vs ${fmt(vfiSol.resumo.P50, 2)} &middot; P75: ${fmt(dcSol.resumo.P75, 2)} &middot; P90: ${fmt(dcSol.resumo.P90, 2)} vs ${fmt(vfiSol.resumo.P90, 2)}.<br>Nota numérica: a discrepância distributiva reflete tanto diferenças entre políticas e preços (r*) quanto a projeção em Young (2010) (nós discretos &omega;=1 na VFI vs. interpolação contínua no DC-EGM), não cabendo atribuir toda a diferença apenas à interpolação.`;
        if (hoverState.active && hoverState.px >= ax.ox && hoverState.px <= ax.ox + ax.plotW) {
          const targetX = ((hoverState.px - ax.ox) / ax.plotW) * maxX;
          const idx = nearestIndex(aFull, targetX, maxX);
          if (idx >= 0) {
            const cx = ax.tx(aFull[idx]);
            ctx.save(); ctx.strokeStyle = pal.muted; ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(cx, ax.oy); ctx.lineTo(cx, ax.oy + ax.plotH); ctx.stroke(); ctx.restore();
            infoText = `<strong>a = ${fmt(aFull[idx], 2)}</strong> &middot; <span style="color:${pal.dc}">DC-EGM: &mu;=${(dcSol.mu_a[idx] * 100).toFixed(2)}%, F(a)=${(cdfDc[idx] * 100).toFixed(1)}%</span> &middot; <span style="color:${pal.vfi}">VFI: &mu;=${(vfiSol.mu_a[idx] * 100).toFixed(2)}%, F(a)=${(cdfVfi[idx] * 100).toFixed(1)}%</span>`;
          }
        }
        readoutEl.innerHTML = infoText;
        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>DC-EGM (a=0: ${fmt(dcSol.resumo.frac_a_min, 2)}%)</span>
          <span class="dcegm-leg-item"><i class="dashed" style="border-color:${pal.vfi}"></i>VFI Vetorizada (a=0: ${fmt(vfiSol.resumo.frac_a_min, 2)}%)</span>
        `;
      } else if (state.distView === 'cdf') {
        const maxX = state.zoomLow ? 25 : 80;
        const sDc = pairSeries(aFull, cdfDc, maxX);
        const sVfi = pairSeries(aFull, cdfVfi, maxX);
        const ax = drawAxesInBox(ctx, 0, 0, w, h, pad, 0, maxX, 0, 1.04, pal, {
          xLabel: 'Ativos a',
          yLabel: 'Distribuição Acumulada F(a)',
          xFormatter: (v) => v.toFixed(0),
          yFormatter: (v) => (v * 100).toFixed(0) + '%'
        });

        // Reference quartile & P90 horizontal guides
        [0.25, 0.50, 0.75, 0.90].forEach((q) => {
          drawLineSeries(ctx, [{ x: 0, y: q }, { x: maxX, y: q }], ax.tx, ax.ty, pal.muted, { width: 1, dashed: true, alpha: 0.45 });
        });

        drawLineSeries(ctx, sDc, ax.tx, ax.ty, pal.dc, { width: 2.6 });
        drawLineSeries(ctx, sVfi, ax.tx, ax.ty, pal.vfi, { width: 2.2, dashed: true });

        // Origin jump highlight (5.03% vs 14.09%)
        ctx.save();
        [ { y: cdfDc[0], c: pal.dc, dy: 12 }, { y: cdfVfi[0], c: pal.vfi, dy: -10 } ].forEach(({ y, c, dy }) => {
          const px = ax.tx(0), py = ax.ty(y);
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = pal.bg; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.font = '600 10.5px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(`F(0)=${(y * 100).toFixed(2)}%`, px + 8, py + dy);
        });
        ctx.restore();

        let infoText = `CDF Acumulada F(a) em EG (Na=400) &middot; Salto inicial na restrição a = 0: <strong>DC-EGM ${fmt(dcSol.resumo.frac_a_min, 2)}%</strong> vs. <strong>VFI ${fmt(vfiSol.resumo.frac_a_min, 2)}%</strong> &middot; Mediana (F=50%): DC = ${fmt(dcSol.resumo.P50, 2)} vs VFI = ${fmt(vfiSol.resumo.P50, 2)}.`;
        if (hoverState.active && hoverState.px >= ax.ox && hoverState.px <= ax.ox + ax.plotW) {
          const targetX = ((hoverState.px - ax.ox) / ax.plotW) * maxX;
          const idx = nearestIndex(aFull, targetX, maxX);
          if (idx >= 0) {
            const cx = ax.tx(aFull[idx]);
            ctx.save(); ctx.strokeStyle = pal.muted; ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(cx, ax.oy); ctx.lineTo(cx, ax.oy + ax.plotH); ctx.stroke(); ctx.restore();
            infoText = `<strong>a &le; ${fmt(aFull[idx], 2)}</strong> &middot; <span style="color:${pal.dc}">DC-EGM F(a) = ${(cdfDc[idx] * 100).toFixed(2)}%</span> &middot; <span style="color:${pal.vfi}">VFI F(a) = ${(cdfVfi[idx] * 100).toFixed(2)}%</span>`;
          }
        }
        readoutEl.innerHTML = infoText;
        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>F(a) DC-EGM (P50 = ${fmt(dcSol.resumo.P50, 2)})</span>
          <span class="dcegm-leg-item"><i class="dashed" style="border-color:${pal.vfi}"></i>F(a) VFI (P50 = ${fmt(vfiSol.resumo.P50, 2)})</span>
        `;
      } else {
        const rDc = dcSol.historico.r.map((val, idx) => ({ x: idx + 1, y: val }));
        const rVfi = vfiSol.historico.r.map((val, idx) => ({ x: idx + 1, y: val }));
        const maxIt = Math.max(rDc.length, rVfi.length);
        const [yMin, yMax] = niceBounds([...rDc.map(p => p.y), ...rVfi.map(p => p.y)], 0.1);
        const ax = drawAxesInBox(ctx, 0, 0, w, h, pad, 1, maxIt, yMin, yMax, pal, {
          xLabel: 'Iteração da Bisseção',
          yLabel: 'Taxa Real r (%)',
          xFormatter: (v) => v.toFixed(0),
          yFormatter: (v) => v.toFixed(2) + '%'
        });

        drawLineSeries(ctx, rDc, ax.tx, ax.ty, pal.dc, { width: 2.6 });
        drawLineSeries(ctx, rVfi, ax.tx, ax.ty, pal.vfi, { width: 2.2, dashed: true });
        [ { s: rDc, c: pal.dc }, { s: rVfi, c: pal.vfi } ].forEach(({ s, c }) => {
          ctx.fillStyle = c;
          s.forEach(p => { ctx.beginPath(); ctx.arc(ax.tx(p.x), ax.ty(p.y), 3.8, 0, Math.PI * 2); ctx.fill(); });
        });

        let infoText = `Procedimento de bisseção encerrado após <strong>${dcSol.resumo.iter} iterações (${dcSol.resumo.tempo}s)</strong> no DC-EGM e <strong>${vfiSol.resumo.iter} iterações (${vfiSol.resumo.tempo}s)</strong> na VFI.<br>Resíduo relativo de mercado |f(k)|/k (tol. 10<sup>-4</sup>): DC-EGM = <strong>${fmtSci(dcSol.resumo.erro_rel_mercado)}</strong> (atendida) &middot; VFI = <strong>${fmtSci(vfiSol.resumo.erro_rel_mercado)}</strong> (acima; encerrou por largura do intervalo).`;
        if (hoverState.active && hoverState.px >= ax.ox && hoverState.px <= ax.ox + ax.plotW) {
          const itHit = Math.max(1, Math.min(maxIt, Math.round(1 + ((hoverState.px - ax.ox) / ax.plotW) * (maxIt - 1))));
          const dStr = itHit <= rDc.length ? `r=${fmt(dcSol.historico.r[itHit - 1], 4)}%, f(k)=${fmt(dcSol.historico.fk[itHit - 1], 4)}` : 'encerrado (11 it.)';
          const vStr = itHit <= rVfi.length ? `r=${fmt(vfiSol.historico.r[itHit - 1], 4)}%, f(k)=${fmt(vfiSol.historico.fk[itHit - 1], 4)}` : 'encerrado';
          infoText = `<strong>Iteração ${itHit}</strong> &middot; <span style="color:${pal.dc}">DC-EGM: ${dStr}</span> &middot; <span style="color:${pal.vfi}">VFI: ${vStr}</span>`;
        }
        readoutEl.innerHTML = infoText;
        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>DC-EGM (${dcSol.resumo.iter} it. bisseção)</span>
          <span class="dcegm-leg-item"><i class="dashed" style="border-color:${pal.vfi}"></i>VFI (${vfiSol.resumo.iter} it. bisseção)</span>
        `;
      }

      const giniDiff = Math.abs(vfiSol.resumo.gini - dcSol.resumo.gini);
      kpiEl.innerHTML = `
        <div class="dcegm-kpi-group">
          <div class="dcegm-group-title">Resultados distributivos (EG, Na=400)</div>
          <div class="dcegm-group-pair">
            <div class="dcegm-kpi dcegm-kpi-primary kpi-dc"><span>Gini (DC vs VFI)</span><strong>${nw(fmt(dcSol.resumo.gini, 4))} / ${nw(fmt(vfiSol.resumo.gini, 4))}</strong><small>Dif.: ${fmt(giniDiff, 4)} &middot; P50: ${fmt(dcSol.resumo.P50, 2)}</small></div>
            <div class="dcegm-kpi kpi-vfi"><span>Restrição a = 0 (DC / VFI)</span><strong>${nw(`${fmt(dcSol.resumo.frac_a_min, 2)}%`)} / ${nw(`${fmt(vfiSol.resumo.frac_a_min, 2)}%`)}</strong><small>Massa pontual na base</small></div>
          </div>
        </div>
        <div class="dcegm-kpi-group">
          <div class="dcegm-group-title">Diagnósticos de fechamento</div>
          <div class="dcegm-group-pair">
            <div class="dcegm-kpi"><span>Resíduo Mercado |f(k)|/k</span><strong>${fmtSci(dcSol.resumo.erro_rel_mercado)} vs ${fmtSci(vfiSol.resumo.erro_rel_mercado)}</strong><small>Tol. 10⁻⁴: Sim (DC) / Não (VFI)</small></div>
            <div class="dcegm-kpi"><span>Resíduo Walras (Contábil)</span><strong>${fmtSci(dcSol.resumo.walras)} vs ${fmtSci(vfiSol.resumo.walras)}</strong><small>Consistência Y−C−I−G</small></div>
          </div>
        </div>
      `;
    }

    // --------------------------------------------------------
    // TAB 4: SCALABILITY & BENCHMARKS
    // --------------------------------------------------------
    else if (state.tab === 'bench') {
      if (state.benchView === 'multigrade') {
        const rows = DATA.benchmarks.multigrade;
        const maxT = Math.max(...rows.map(r => Math.max(parseFloat(r.Tempo_VFI_s), parseFloat(r.Tempo_DCEGM_s))));
        const ax = drawAxesInBox(ctx, 0, 0, w, h, pad, 0, rows.length, 0, maxT * 1.18, pal, {
          xLabel: 'Resolução da Malha (N_a, EP χ̄=0,05)',
          yLabel: 'Tempo de Política EP (s)',
          yFormatter: (v) => v.toFixed(0) + 's'
        });

        const groupW = ax.plotW / rows.length;
        const barW = Math.min(48, groupW * 0.28);

        let hoveredIdx = -1;
        if (hoverState.active && hoverState.px >= ax.ox && hoverState.px <= ax.ox + ax.plotW) {
          hoveredIdx = Math.max(0, Math.min(rows.length - 1, Math.floor((hoverState.px - ax.ox) / groupW)));
        }

        rows.forEach((r, idx) => {
          const cx = ax.ox + groupW * (idx + 0.5);
          if (idx === hoveredIdx) {
            ctx.fillStyle = pal.bgSubtle;
            ctx.fillRect(ax.ox + idx * groupW + 2, ax.oy + 1, groupW - 4, ax.plotH - 2);
          }

          const tDc = parseFloat(r.Tempo_DCEGM_s), tVfi = parseFloat(r.Tempo_VFI_s);
          const hDc = ax.plotH - (ax.ty(tDc) - ax.oy), hVfi = ax.plotH - (ax.ty(tVfi) - ax.oy);

          ctx.fillStyle = pal.dc; ctx.fillRect(cx - barW - 3, ax.ty(tDc), barW, hDc);
          ctx.fillStyle = pal.vfi; ctx.fillRect(cx + 3, ax.ty(tVfi), barW, hVfi);

          ctx.fillStyle = pal.ink; ctx.font = '600 11.5px Inter, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(`${tDc.toFixed(2)}s`, cx - barW / 2 - 3, ax.ty(tDc) - 6);
          ctx.fillText(`${tVfi.toFixed(2)}s`, cx + barW / 2 + 3, ax.ty(tVfi) - 6);

          // Speedup highlight badge above each pair
          const sp = parseFloat(r.Speedup);
          ctx.fillStyle = sp >= 1 ? pal.green : pal.crimson;
          ctx.font = '700 11.5px Inter, sans-serif';
          ctx.fillText(`${r.Speedup.replace('.', ',')}x`, cx, Math.min(ax.ty(tDc), ax.ty(tVfi)) - 22);

          ctx.fillStyle = pal.muted; ctx.font = '600 11.5px Inter, sans-serif';
          ctx.fillText(`Na=${r.Na}`, cx, ax.oy + ax.plotH + 14);
        });

        const rSel = hoveredIdx >= 0 ? rows[hoveredIdx] : rows[rows.length - 1];
        const convNote = String(rSel.Convergencia_DCEGM).toLowerCase() === 'nao'
          ? `Não atingiu 10⁻⁷ em ${rSel.Iter_DCEGM} it. (resíduo Cauchy V = ${fmtSci(DATA.dobras_ep.na400_erro_V)})`
          : `Convergiu em ${rSel.Iter_DCEGM} iterações (tol. 10⁻⁷)`;
        readoutEl.innerHTML = `<strong>Malha N_a = ${rSel.Na} (EP, χ̄=0,05)</strong> &middot; Tempo: <strong>${rSel.Tempo_DCEGM_s}s vs ${rSel.Tempo_VFI_s}s</strong> (${rSel.Speedup}x) &middot; Convergência DC: ${convNote}<br>Discrepância entre métodos (VFI vs DC): ||ΔV||<sub>∞</sub> = <strong>${rSel.dif_sup_V}</strong> &middot; ||Δc||<sub>∞</sub> = <strong>${rSel.dif_sup_c}</strong> &middot; Conc. d* = <strong>${rSel.Concordancia_Ocup_pct}%</strong>.`;

        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>DC-EGM com Upper Envelope (EP)</span>
          <span class="dcegm-leg-item"><i style="background:${pal.vfi}"></i>VFI Vetorizada (EP)</span>
        `;

        const r16 = rows[rows.length - 1], r4 = rows[0];
        kpiEl.innerHTML = `
          <div class="dcegm-kpi dcegm-kpi-primary kpi-dc"><span>Speedup Máximo (Na=1600, EP)</span><strong>${nw(`${r16.Speedup.replace('.', ',')}x mais rápido`)}</strong><small>${r16.Tempo_DCEGM_s}s (DC) vs ${r16.Tempo_VFI_s}s (VFI)</small></div>
          <div class="dcegm-kpi"><span>Conv. DC (400 / ≥800)</span><strong>Não (${r4.Iter_DCEGM}) / Sim (${r16.Iter_DCEGM})</strong><small>tol. 10⁻⁷ em equilíbrio parcial</small></div>
          <div class="dcegm-kpi"><span>Discrep. Soluções (1600)</span><strong>||ΔV||∞=${r16.dif_sup_V}</strong><small>||Δc||∞=${r16.dif_sup_c} · d*=${r16.Concordancia_Ocup_pct}%</small></div>
          <div class="dcegm-kpi kpi-vfi"><span>Speedup em EG (Na=400)</span><strong>${nw(`${fmt(eq.discrepancias.speedup_eg, 2)}x`)}</strong><small>${eq.dc.resumo.tempo}s vs ${eq.vfi.resumo.tempo}s</small></div>
        `;
      } else {
        const rows = DATA.benchmarks.historico9.map(r => ({
          name: r.Implementacao,
          x: parseFloat(r.Mediana_s),
          y: parseFloat(r.Euler_Erro_Consumo),
          bellmanMae: parseFloat(r.Bellman_MAE),
          speedup: r.Speedup_vs_VFI_Vet
        }));
        const ax = drawAxesInBox(ctx, 0, 0, w, h, pad, 1, 120, 1e-7, 2e-2, pal, {
          xLabel: 'Tempo Mediano (s, escala log — χ̄=0)',
          yLabel: 'Erro Médio de Euler (log)',
          xFormatter: (v) => v.toFixed(0) + 's',
          yFormatter: (v) => v.toExponential(0),
          xLog: true,
          yLog: true
        });

        let hoveredPt = null, minPxDist = 28;
        rows.forEach((pt) => {
          const px = ax.tx(pt.x), py = ax.ty(pt.y);
          const isBest = pt.name.includes('DC-EGM Otimizado'), isDc = pt.name.includes('DC-EGM');
          ctx.fillStyle = isDc ? pal.dc : pal.vfi;
          ctx.beginPath(); ctx.arc(px, py, isBest ? 7.5 : 5.2, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = isBest ? pal.green : pal.bg; ctx.lineWidth = isBest ? 2.4 : 1.6; ctx.stroke();

          if (hoverState.active) {
            const d = Math.hypot(hoverState.px - px, hoverState.py - py);
            if (d < minPxDist) { minPxDist = d; hoveredPt = pt; }
          }
        });

        const bestRow = rows.find(r => r.name.includes('DC-EGM Otimizado')) || rows[0];
        const vfi3200 = rows.find(r => r.name.includes('3200')) || rows[rows.length - 1];

        if (hoveredPt) {
          readoutEl.innerHTML = `<strong>${hoveredPt.name} (χ̄=0)</strong> &middot; Mediana: <strong>${fmt(hoveredPt.x, 3)}s</strong> &middot; Erro Euler: <strong>${fmtSci(hoveredPt.y)}</strong> &middot; Bellman MAE: <strong>${fmtSci(hoveredPt.bellmanMae)}</strong> (${hoveredPt.speedup})`;
        } else {
          readoutEl.innerHTML = `<strong>Benchmark histórico preliminar (χ̄=0, sem custos de transição — 9 implementações)</strong>. Não equivale à acurácia em quinas do modelo canônico (χ̄=0,05).<br>Passe sobre um ponto: DC-EGM Otimizado combina <strong>${fmt(bestRow.x, 2)}s</strong> com erro médio de Euler <strong>${fmtSci(bestRow.y)}</strong>.`;
        }
        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i class="dot" style="background:${pal.dc};border:2px solid ${pal.green}"></i>DC-EGM Otimizado (χ̄=0, destaque Pareto)</span>
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>DC-EGM Padrão (χ̄=0)</span>
          <span class="dcegm-leg-item"><i style="background:${pal.vfi}"></i>Variantes VFI (400–3200, χ̄=0)</span>
        `;

        kpiEl.innerHTML = `
          <div class="dcegm-kpi dcegm-kpi-primary kpi-dc"><span>Euler DC-EGM Otimizado (χ̄=0)</span><strong>${fmtSci(bestRow.y)}</strong><small>Mediana ${fmt(bestRow.x, 2)}s (${bestRow.speedup})</small></div>
          <div class="dcegm-kpi kpi-vfi"><span>Euler VFI-3200 (χ̄=0)</span><strong>${fmtSci(vfi3200.y)}</strong><small>Mediana ${fmt(vfi3200.x, 2)}s</small></div>
          <div class="dcegm-kpi"><span>Ganho em Precisão (Euler)</span><strong>~2.600x menor</strong><small>em modelo sem custos (χ̄=0)</small></div>
          <div class="dcegm-kpi"><span>Escopo do Benchmark</span><strong>Histórico (χ̄ = 0)</strong><small>Separado do modelo χ̄ = 0,05</small></div>
        `;
      }
    }
  }

  function resetTabDefaults() {
    if (state.tab === 'policies') {
      state.policyVar = DEFAULTS.policyVar;
      state.iz = DEFAULTS.iz;
      state.dPrev = DEFAULTS.dPrev;
      state.compareVfi = DEFAULTS.compareVfi;
      state.zoomLow = DEFAULTS.zoomLow;
    } else if (state.tab === 'folds') {
      state.foldMode = DEFAULTS.foldMode;
      state.foldIdx = DEFAULTS.foldIdx;
      state.iz = DEFAULTS.iz;
      state.dPrev = DEFAULTS.dPrev;
      state.foldZoomLow = DEFAULTS.foldZoomLow;
    } else if (state.tab === 'dist') {
      state.distView = DEFAULTS.distView;
      state.zoomLow = DEFAULTS.zoomLow;
    } else {
      state.benchView = DEFAULTS.benchView;
    }
    hoverState.active = false;
    buildUI();
    renderChart();
  }

  function buildUI() {
    const zOpts = DATA.meta.z.map((v, i) => `<option value="${i}"${i === state.iz ? ' selected' : ''}>z${i + 1} (${v.toFixed(3)})</option>`).join('');
    const dOpts = DATA.meta.occupations.map((n, i) => `<option value="${i}"${i === state.dPrev ? ' selected' : ''}>${n}</option>`).join('');
    const foldOpts = DATA.dobras_ep.folds.map((f, i) => `<option value="${i}"${i === state.foldIdx ? ' selected' : ''}>${f.label}</option>`).join('');

    let controlsHtml = '';
    if (state.tab === 'policies') {
      controlsHtml = `
        <div class="dcegm-ctrl-grid">
          <label class="dcegm-field"><span>Variável</span>
            <select id="ctrl-pvar">
              <option value="ap"${state.policyVar === 'ap' ? ' selected' : ''}>Poupança a'(a)</option>
              <option value="c"${state.policyVar === 'c' ? ' selected' : ''}>Consumo c*(a)</option>
              <option value="V"${state.policyVar === 'V' ? ' selected' : ''}>Função Valor V(a)</option>
              <option value="net"${state.policyVar === 'net' ? ' selected' : ''}>Poupança Líquida a' − a</option>
              <option value="d_star"${state.policyVar === 'd_star' ? ' selected' : ''}>Ocupação Ótima d*(a)</option>
            </select>
          </label>
          <label class="dcegm-field"><span>Produtividade z</span><select id="ctrl-iz">${zOpts}</select></label>
          <label class="dcegm-field"><span>Ocupação ant. d⁻</span><select id="ctrl-dp">${dOpts}</select></label>
        </div>
        <div class="dcegm-ctrl-row">
          <label class="dcegm-check"><input type="checkbox" id="ctrl-vfi"${state.compareVfi ? ' checked' : ''}> Comparar VFI</label>
          <label class="dcegm-check"><input type="checkbox" id="ctrl-zoom"${state.zoomLow ? ' checked' : ''}> Zoom a &le; 20</label>
          <button type="button" class="dcegm-reset-btn" id="ctrl-reset">Restaurar</button>
        </div>`;
    } else if (state.tab === 'folds') {
      controlsHtml = state.foldMode === 'endo'
        ? `
        <div class="dcegm-ctrl-row">
          <label class="dcegm-field"><span>Diagnóstico</span>
            <select id="ctrl-fmode">
              <option value="endo" selected>Dobras Grade Endógena &amp; Poda (EP Na=1600)</option>
              <option value="vcond">Ramos v_d(a) e Envelope (EG Na=400)</option>
            </select>
          </label>
          <label class="dcegm-field"><span>Estado com dobra</span><select id="ctrl-fidx">${foldOpts}</select></label>
          <button type="button" class="dcegm-reset-btn" id="ctrl-reset">Restaurar</button>
        </div>`
        : `
        <div class="dcegm-ctrl-grid">
          <label class="dcegm-field"><span>Diagnóstico</span>
            <select id="ctrl-fmode">
              <option value="endo">Dobras Grade Endógena &amp; Poda (EP Na=1600)</option>
              <option value="vcond" selected>Ramos v_d(a) e Envelope (EG Na=400)</option>
            </select>
          </label>
          <label class="dcegm-field"><span>Produtividade z</span><select id="ctrl-iz">${zOpts}</select></label>
          <label class="dcegm-field"><span>Ocupação ant. d⁻</span><select id="ctrl-dp">${dOpts}</select></label>
        </div>
        <div class="dcegm-ctrl-row">
          <label class="dcegm-check"><input type="checkbox" id="ctrl-fzoom"${state.foldZoomLow ? ' checked' : ''}> Zoom a &le; 25</label>
          <button type="button" class="dcegm-reset-btn" id="ctrl-reset">Restaurar</button>
        </div>`;
    } else if (state.tab === 'dist') {
      controlsHtml = `
        <div class="dcegm-ctrl-row">
          <label class="dcegm-field"><span>Gráfico (EG Na=400)</span>
            <select id="ctrl-dview">
              <option value="mu"${state.distView === 'mu' ? ' selected' : ''}>Densidade Estacionária μ(a)</option>
              <option value="cdf"${state.distView === 'cdf' ? ' selected' : ''}>Distribuição Acumulada CDF F(a)</option>
              <option value="bisection"${state.distView === 'bisection' ? ' selected' : ''}>Procedimento de Bisseção (r*)</option>
            </select>
          </label>
          ${state.distView !== 'bisection' ? `<label class="dcegm-check"><input type="checkbox" id="ctrl-zoom"${state.zoomLow ? ' checked' : ''}> Zoom a &le; 25</label>` : ''}
          <button type="button" class="dcegm-reset-btn" id="ctrl-reset">Restaurar</button>
        </div>`;
    } else {
      controlsHtml = `
        <div class="dcegm-ctrl-row">
          <label class="dcegm-field"><span>Experimento</span>
            <select id="ctrl-bview">
              <option value="multigrade"${state.benchView === 'multigrade' ? ' selected' : ''}>Refinamento Multigrade (EP, χ̄=0,05)</option>
              <option value="euler"${state.benchView === 'euler' ? ' selected' : ''}>Benchmark Histórico Euler (χ̄=0, 9 impl.)</option>
            </select>
          </label>
          <button type="button" class="dcegm-reset-btn" id="ctrl-reset">Restaurar</button>
        </div>`;
    }

    container.innerHTML = `
      <div class="dcegm-header">
        <div>
          <span class="dcegm-badge notranslate" translate="no">MATLAB &rarr; JSON · Laboratório Interativo</span>
          <h3 class="dcegm-title">Explorador Numérico: VFI vs. DC-EGM</h3>
        </div>
        <div class="dcegm-tabs" role="tablist">
          <button type="button" class="dcegm-tab-btn${state.tab === 'policies' ? ' active' : ''}" data-tab="policies">Políticas (EG)</button>
          <button type="button" class="dcegm-tab-btn${state.tab === 'folds' ? ' active' : ''}" data-tab="folds">Upper Envelope</button>
          <button type="button" class="dcegm-tab-btn${state.tab === 'dist' ? ' active' : ''}" data-tab="dist">Distribuição &amp; EG</button>
          <button type="button" class="dcegm-tab-btn${state.tab === 'bench' ? ' active' : ''}" data-tab="bench">Escalabilidade</button>
        </div>
      </div>

      <div class="dcegm-controls">${controlsHtml}</div>

      <div class="dcegm-chart-bar">
        <div class="dcegm-chart-heading" id="dcegm-chart-heading"></div>
        <div class="dcegm-regime-pill" id="dcegm-regime"></div>
      </div>

      <div class="dcegm-canvas-wrap">
        <canvas id="dcegm-canvas"></canvas>
      </div>
      <div class="dcegm-legend" id="dcegm-legend"></div>
      <div class="dcegm-readout" id="dcegm-readout">Carregando dados numéricos...</div>
      <div class="dcegm-kpis" id="dcegm-kpis"></div>
    `;

    container.querySelectorAll('.dcegm-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.tab = btn.getAttribute('data-tab');
        hoverState.active = false;
        buildUI();
        renderChart();
      });
    });

    const resetBtn = container.querySelector('#ctrl-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetTabDefaults);

    const bindVal = (sel, key, isInt = false) => {
      const el = container.querySelector(sel);
      if (el) el.addEventListener('change', () => { state[key] = isInt ? parseInt(el.value, 10) : el.value; buildUI(); renderChart(); });
    };
    const bindChk = (sel, key) => {
      const el = container.querySelector(sel);
      if (el) el.addEventListener('change', () => { state[key] = el.checked; renderChart(); });
    };

    bindVal('#ctrl-pvar', 'policyVar');
    bindVal('#ctrl-iz', 'iz', true);
    bindVal('#ctrl-dp', 'dPrev', true);
    bindVal('#ctrl-fmode', 'foldMode');
    bindVal('#ctrl-fidx', 'foldIdx', true);
    bindVal('#ctrl-dview', 'distView');
    bindVal('#ctrl-bview', 'benchView');
    bindChk('#ctrl-vfi', 'compareVfi');
    bindChk('#ctrl-zoom', 'zoomLow');
    bindChk('#ctrl-fzoom', 'foldZoomLow');

    const canvas = container.querySelector('#dcegm-canvas');
    const updateHover = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      hoverState = { active: true, px: clientX - r.left, py: clientY - r.top };
      renderChart();
    };
    canvas.addEventListener('mousemove', (e) => updateHover(e.clientX, e.clientY));
    canvas.addEventListener('mouseleave', () => { hoverState.active = false; renderChart(); });
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches[0]) updateHover(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches[0]) updateHover(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
  }

  function scheduleRender() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      renderChart();
    });
  }

  async function init() {
    container.innerHTML = '<div class="dcegm-loading">Carregando dados numéricos do modelo MATLAB...</div>';
    try {
      const res = await fetch(JSON_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      DATA = await res.json();
      buildUI();
      renderChart();

      if (typeof ResizeObserver === 'function') {
        new ResizeObserver(() => scheduleRender()).observe(container);
      } else {
        window.addEventListener('resize', scheduleRender);
      }

      new MutationObserver(() => scheduleRender()).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (err) {
      container.innerHTML = `<div class="dcegm-loading">Não foi possível carregar os dados interativos (${err.message}).</div>`;
    }
  }

  init();
})();
