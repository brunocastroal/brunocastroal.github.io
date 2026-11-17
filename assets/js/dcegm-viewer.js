/**
 * assets/js/dcegm-viewer.js
 * Visualizador Científico Interativo em HTML5 Canvas para DC-EGM vs. VFI
 * Lê dados pré-computados do modelo em materials/dc_egm_vfi/dc_egm_vfi_interactive.json
 */

(function () {
  'use strict';

  const container = document.getElementById('dcegm-explorer');
  if (!container) return;

  const isPost = window.location.pathname.includes('/posts/');
  const JSON_URL = (isPost ? '../' : '') + 'materials/dc_egm_vfi/dc_egm_vfi_interactive.json';
  const OCC_SHORT = ['N', 'I', 'F'];

  let DATA = null;
  let rafId = null;
  let state = {
    tab: 'policies',       // policies | folds | dist | bench
    iz: 2,                 // 0..4 (z3 = 0.901 default)
    dPrev: 2,              // 0=N, 1=I, 2=F
    policyVar: 'ap',       // V | c | ap | net | d_star
    compareVfi: true,
    zoomLow: true,
    foldZoomLow: false,
    foldMode: 'endo',      // endo | vcond
    foldIdx: 1,            // 0..3
    distView: 'mu',        // mu | bisection
    benchView: 'multigrade'// multigrade | euler
  };

  let hoverState = { active: false, px: 0, py: 0 };

  function getPalette() {
    const dark = document.body.classList.contains('dark');
    return {
      bg: dark ? '#161b24' : '#ffffff',
      bgSubtle: dark ? '#1a2230' : '#f8fafc',
      ink: dark ? '#f1f5f9' : '#1e293b',
      muted: dark ? '#94a3b8' : '#64748b',
      grid: dark ? '#242c3d' : '#e2e8f0',
      dc: dark ? '#58a6ff' : '#0969da',
      vfi: dark ? '#f59e0b' : '#d97706',
      green: dark ? '#34d399' : '#059669',
      slate: dark ? '#94a3b8' : '#475569',
      crimson: dark ? '#f87171' : '#dc2626'
    };
  }

  function fmt(v, d = 4) {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function fmtSci(v) {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    return Number(v).toExponential(2).replace('.', ',');
  }

  function getRegimeLabel() {
    if (state.tab === 'policies') return 'Regime ativo: Equilíbrio Geral (Na = 400, χ̄ = 0,05)';
    if (state.tab === 'folds') {
      return state.foldMode === 'vcond'
        ? 'Regime ativo: Equilíbrio Geral (Na = 400, χ̄ = 0,05, r* = 2,80% — sem dobras na grade endógena)'
        : 'Regime ativo: Equilíbrio Parcial (Na = 1600, χ̄ = 0,05, r = 4,17% — 4 dobras detectadas)';
    }
    if (state.tab === 'dist') return 'Regime ativo: Equilíbrio Geral Competitivo (Na = 400, χ̄ = 0,05, operador de Young 2010)';
    return state.benchView === 'multigrade'
      ? 'Regime ativo: Equilíbrio Parcial Multigrade (Na = 400, 800, 1600 · χ̄ = 0,05)'
      : 'Regime ativo: Benchmark Histórico Preliminar (Na = 400 · χ̄ = 0, sem custos de transição)';
  }

  function pairSeries(xs, ys, maxX = Infinity) {
    const out = [];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      const y = ys[i];
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

  function setupCanvas(canvas) {
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(280, Math.floor(rect.width));
    const h = w < 520 ? 275 : 340;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function niceBounds(values, padRatio = 0.06) {
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

  function drawAxes(ctx, pad, plotW, plotH, xMin, xMax, yMin, yMax, pal, xLabel, yLabel, xFormatter, yFormatter, xLog = false, yLog = false) {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, pad.l + plotW + pad.r, pad.t + plotH + pad.b);

    const tx = (x) => {
      const val = xLog ? Math.log10(Math.max(x, 1e-12)) : x;
      const mn = xLog ? Math.log10(Math.max(xMin, 1e-12)) : xMin;
      const mx = xLog ? Math.log10(Math.max(xMax, 1e-12)) : xMax;
      return pad.l + ((val - mn) / (mx - mn || 1)) * plotW;
    };
    const ty = (y) => {
      const val = yLog ? Math.log10(Math.max(y, 1e-12)) : y;
      const mn = yLog ? Math.log10(Math.max(yMin, 1e-12)) : yMin;
      const mx = yLog ? Math.log10(Math.max(yMax, 1e-12)) : yMax;
      return pad.t + plotH - ((val - mn) / (mx - mn || 1)) * plotH;
    };

    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    ctx.font = '11px Inter, -apple-system, sans-serif';
    ctx.fillStyle = pal.muted;

    for (let t = 0; t <= 5; t++) {
      const frac = t / 5;
      const py = pad.t + plotH - frac * plotH;
      ctx.beginPath();
      ctx.moveTo(pad.l, py);
      ctx.lineTo(pad.l + plotW, py);
      ctx.stroke();

      const yVal = yLog
        ? Math.pow(10, Math.log10(yMin) + frac * (Math.log10(yMax) - Math.log10(yMin)))
        : yMin + frac * (yMax - yMin);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(yFormatter(yVal), pad.l - 6, py);
    }

    for (let t = 0; t <= 5; t++) {
      const frac = t / 5;
      const px = pad.l + frac * plotW;
      ctx.beginPath();
      ctx.moveTo(px, pad.t);
      ctx.lineTo(px, pad.t + plotH);
      ctx.stroke();

      const xVal = xLog
        ? Math.pow(10, Math.log10(xMin) + frac * (Math.log10(xMax) - Math.log10(xMin)))
        : xMin + frac * (xMax - xMin);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(xFormatter(xVal), px, pad.t + plotH + 6);
    }

    ctx.strokeStyle = pal.grid;
    ctx.strokeRect(pad.l, pad.t, plotW, plotH);

    ctx.fillStyle = pal.ink;
    ctx.font = '600 11.5px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(xLabel, pad.l + plotW / 2, pad.t + plotH + pad.b - 2);

    ctx.save();
    ctx.translate(6, pad.t + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'top';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    return { tx, ty };
  }

  function drawLineSeries(ctx, pts, tx, ty, color, opts = {}) {
    if (!pts.length) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = opts.width || 2.2;
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
          const xCross = prevDom.a + t * (a - prevDom.a);
          const yCross = va0 + t * (va1 - va0);
          crossings.push({ x: xCross, y: yCross, from: dA, to: dB });
        } else {
          crossings.push({ x: a, y: bestV, from: dA, to: dB });
        }
      }
      pts.push({ a, vals, dom: bestD, vEnv: bestV });
      prevDom = { a, vals, dom: bestD, vEnv: bestV };
    }
    return { pts, crossings };
  }

  function renderChart() {
    const canvas = container.querySelector('#dcegm-canvas');
    const regimeEl = container.querySelector('#dcegm-regime');
    const readoutEl = container.querySelector('#dcegm-readout');
    const legendEl = container.querySelector('#dcegm-legend');
    const kpiEl = container.querySelector('#dcegm-kpis');
    if (!canvas || !DATA) return;

    if (regimeEl) regimeEl.textContent = getRegimeLabel();

    const pal = getPalette();
    const occColors = [pal.slate, pal.green, pal.dc];
    const { ctx, w, h } = setupCanvas(canvas);
    const pad = { l: w < 460 ? 60 : 66, r: 16, t: 18, b: 36 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    const eq = DATA.equilibrio_geral;
    const aGrid = DATA.meta.a_sampled;
    const zVals = DATA.meta.z;
    const occNames = DATA.meta.occupations;

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
        c: 'Consumo Ótimo c*(a)',
        ap: "Poupança a'(a)",
        net: "Poupança Líquida a'(a) - a",
        d_star: 'Ocupação: 1=N, 2=I, 3=F'
      };
      const yFmt = isStep
        ? (v) => (Math.abs(v - 1) < 0.2 ? '1 (N)' : Math.abs(v - 2) < 0.2 ? '2 (I)' : Math.abs(v - 3) < 0.2 ? '3 (F)' : '')
        : (v) => Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1);

      const { tx, ty } = drawAxes(ctx, pad, plotW, plotH, 0, maxX, yMin, yMax, pal, 'Ativos a', yLabels[state.policyVar], (v) => v.toFixed(0), yFmt);

      if (state.policyVar === 'net') {
        drawLineSeries(ctx, [{ x: 0, y: 0 }, { x: maxX, y: 0 }], tx, ty, pal.muted, { width: 1, dashed: true });
      } else if (state.policyVar === 'ap') {
        drawLineSeries(ctx, [{ x: 0, y: 0 }, { x: Math.min(maxX, yMax), y: Math.min(maxX, yMax) }], tx, ty, pal.muted, { width: 1, dashed: true });
      }

      drawLineSeries(ctx, ptsDc, tx, ty, pal.dc, { width: 2.3, step: isStep });
      if (state.compareVfi) {
        drawLineSeries(ctx, ptsVfi, tx, ty, pal.vfi, { width: 2.0, dashed: true, step: isStep });
      }

      let infoText = `Equilíbrio Geral (Na=400, z${state.iz + 1}=${fmt(zVals[state.iz], 3)}, d⁻=${occNames[state.dPrev]}): passe o cursor ou toque no gráfico.` +
        (isStep ? ' Códigos: <strong>1 = Inatividade (N)</strong> &middot; <strong>2 = Informalidade (I)</strong> &middot; <strong>3 = Formalidade (F)</strong>.' : '') +
        `<br>Nota: ||&Delta;V||<sub>&infin;</sub> e ||&Delta;c||<sub>&infin;</sub> medem discrepância máxima entre soluções finais DC-EGM e VFI (sob r* distintos por 1,8 pb), e não erro de convergência.`;
      if (hoverState.active && hoverState.px >= pad.l && hoverState.px <= pad.l + plotW) {
        const targetX = ((hoverState.px - pad.l) / plotW) * maxX;
        const pDc = nearestPoint(ptsDc, targetX);
        const pVfi = state.compareVfi ? nearestPoint(ptsVfi, targetX) : null;
        if (pDc) {
          const cx = tx(pDc.x);
          ctx.save();
          ctx.strokeStyle = pal.muted;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(cx, pad.t); ctx.lineTo(cx, pad.t + plotH); ctx.stroke();
          ctx.fillStyle = pal.dc;
          ctx.beginPath(); ctx.arc(cx, ty(pDc.y), 4.5, 0, Math.PI * 2); ctx.fill();
          if (pVfi) {
            ctx.fillStyle = pal.vfi;
            ctx.beginPath(); ctx.arc(tx(pVfi.x), ty(pVfi.y), 4, 0, Math.PI * 2); ctx.fill();
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
        <div class="dcegm-kpi"><span>r* (DC / VFI)</span><strong>${fmt(dcSol.resumo.r, 4)}% / ${fmt(vfiSol.resumo.r, 4)}%</strong></div>
        <div class="dcegm-kpi"><span>w* (DC-EGM)</span><strong>${fmt(dcSol.resumo.w, 4)}</strong></div>
        <div class="dcegm-kpi" title="Diferença máxima entre soluções DC-EGM e VFI no EG (Na=400, r* distintos em 1,8 pb); não é resíduo de convergência"><span>Discrep. ||&Delta;V||<sub>&infin;</sub> (DC vs VFI, EG)</span><strong>${fmt(eq.discrepancias.dif_sup_V, 4)}</strong></div>
        <div class="dcegm-kpi" title="Diferença máxima entre políticas de consumo DC-EGM e VFI no EG (Na=400, r* distintos em 1,8 pb); não é resíduo de convergência"><span>Discrep. ||&Delta;c||<sub>&infin;</sub> (DC vs VFI, EG)</span><strong>${fmt(eq.discrepancias.dif_sup_c, 4)}</strong></div>
      `;
    }

    // --------------------------------------------------------
    // TAB 2: UPPER ENVELOPE (v_d EG Na=400 vs Dobras EP Na=1600)
    // --------------------------------------------------------
    else if (state.tab === 'folds') {
      const row1600 = DATA.benchmarks.multigrade.find(r => String(r.Na) === '1600');
      const conc1600 = row1600 ? fmt(parseFloat(row1600.Concordancia_Ocup_pct), 2) + '%' : '—';

      if (state.foldMode === 'vcond') {
        const maxX = state.foldZoomLow ? 25 : 80;
        const dcVc = eq.dc.v_cond[state.dPrev];
        const branches = [dcVc[0][state.iz], dcVc[1][state.iz], dcVc[2][state.iz]];
        const sN = pairSeries(aGrid, branches[0], maxX);
        const sI = pairSeries(aGrid, branches[1], maxX);
        const sF = pairSeries(aGrid, branches[2], maxX);

        const { pts: envPts, crossings } = analyzeEnvelopeBranches(aGrid, branches, maxX);
        const allY = [...sN, ...sI, ...sF].map(p => p.y);
        const [yMin, yMax] = niceBounds(allY);
        const { tx, ty } = drawAxes(ctx, pad, plotW, plotH, 0, maxX, yMin, yMax, pal, 'Ativos a', 'v(a, z, d, d⁻)', (v) => v.toFixed(0), (v) => v.toFixed(1));

        // 1. Sub-optimal & conditional value branches (subtle)
        drawLineSeries(ctx, sN, tx, ty, pal.slate, { width: 1.5, dashed: true, alpha: 0.72 });
        drawLineSeries(ctx, sI, tx, ty, pal.green, { width: 1.5, alpha: 0.55 });
        drawLineSeries(ctx, sF, tx, ty, pal.dc, { width: 1.5, alpha: 0.55 });

        // 2. Active Upper Envelope segmented by dominant occupation
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
            drawLineSeries(ctx, seg, tx, ty, occColors[envPts[i].dom], { width: 3.3 });
            segStart = i + 1;
          }
        }

        // 3. Kink / crossing markers & non-overlapping labels
        let lastLabelX = -100;
        crossings.forEach((c) => {
          const cx = tx(c.x), cy = ty(c.y);
          ctx.save();
          ctx.fillStyle = pal.crimson;
          ctx.beginPath(); ctx.arc(cx, cy, 5.2, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = pal.bg; ctx.lineWidth = 1.6; ctx.stroke();
          if (cx - lastLabelX > 52) {
            const lbl = `${OCC_SHORT[c.from]}→${OCC_SHORT[c.to]} (${c.x.toFixed(1)})`;
            ctx.font = '600 10.5px Inter, sans-serif';
            ctx.fillStyle = pal.ink;
            ctx.textAlign = cx > pad.l + plotW - 60 ? 'right' : 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(lbl, cx + (cx > pad.l + plotW - 60 ? -6 : 6), Math.max(pad.t + 14, cy - 6));
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
        if (hoverState.active && hoverState.px >= pad.l && hoverState.px <= pad.l + plotW) {
          const targetX = ((hoverState.px - pad.l) / plotW) * maxX;
          const pEnv = nearestPoint(envPts.map(p => ({ x: p.a, y: p.vEnv, raw: p })), targetX);
          if (pEnv) {
            const r = pEnv.raw;
            const cx = tx(r.a);
            ctx.save();
            ctx.strokeStyle = pal.muted; ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(cx, pad.t); ctx.lineTo(cx, pad.t + plotH); ctx.stroke();
            ctx.fillStyle = occColors[r.dom];
            ctx.beginPath(); ctx.arc(cx, ty(r.vEnv), 5, 0, Math.PI * 2); ctx.fill();
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
          <div class="dcegm-kpi"><span>Regime da Vista</span><strong>EG (Na = 400)</strong></div>
          <div class="dcegm-kpi"><span>Regime Dominante</span><strong>${pathSeq || '—'}</strong></div>
          <div class="dcegm-kpi"><span>Quinas (a &le; ${maxX})</span><strong>${crossings.length} cruzamento(s)</strong></div>
          <div class="dcegm-kpi"><span>Dobras Grade EG (Na=400)</span><strong>${eq.dobras_eg} (monotônica)</strong></div>
        `;
      } else {
        const folds = DATA.dobras_ep.folds;
        const fItem = folds[state.foldIdx] || folds[0];
        const pts = fItem.fold_a_prime.map((ap, i) => ({ x: ap, y: fItem.fold_a_endo[i], neg: fItem.neg_rel_indices.includes(i) }));
        const xMin = pts[0].x, xMax = pts[pts.length - 1].x;
        const [yMin, yMax] = niceBounds(pts.map(p => p.y), 0.12);
        const { tx, ty } = drawAxes(ctx, pad, plotW, plotH, xMin, xMax, yMin, yMax, pal, "Poupança a'", "Grade Endógena a_endog(a')", (v) => v.toFixed(2), (v) => v.toFixed(2));

        drawLineSeries(ctx, pts, tx, ty, pal.dc, { width: 2.2 });
        ctx.save();
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (p.neg && i + 1 < pts.length) {
            ctx.strokeStyle = pal.crimson;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(tx(p.x), ty(p.y));
            ctx.lineTo(tx(pts[i + 1].x), ty(pts[i + 1].y));
            ctx.stroke();

            ctx.fillStyle = pal.crimson;
            ctx.beginPath(); ctx.arc(tx(p.x), ty(p.y), 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(tx(pts[i + 1].x), ty(pts[i + 1].y), 4.5, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore();

        let infoText = `Equilíbrio Parcial (Na = 1.600, r = ${fmt(DATA.dobras_ep.r_pct, 2)}%): dobra na grade endógena em ${fItem.label}. Em vermelho: trecho invertido da_endog/da' &lt; 0.`;
        if (hoverState.active && hoverState.px >= pad.l && hoverState.px <= pad.l + plotW) {
          const targetX = xMin + ((hoverState.px - pad.l) / plotW) * (xMax - xMin);
          const p = nearestPoint(pts, targetX);
          if (p) {
            ctx.save();
            ctx.fillStyle = p.neg ? pal.crimson : pal.dc;
            ctx.beginPath(); ctx.arc(tx(p.x), ty(p.y), 5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            infoText = `<strong>a' = ${fmt(p.x, 4)}</strong> &rarr; a_endog = <strong>${fmt(p.y, 4)}</strong>` +
              (p.neg ? ` <span style="color:${pal.crimson};font-weight:600">(Dobra: da_endog/da' &lt; 0)</span>` : '');
          }
        }
        readoutEl.innerHTML = infoText;
        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>a_endog(a') monótona (EP Na=1600)</span>
          <span class="dcegm-leg-item"><i style="background:${pal.crimson}"></i>Dobra (da_endog / da' &lt; 0)</span>
        `;
        kpiEl.innerHTML = `
          <div class="dcegm-kpi"><span>Regime da Vista</span><strong>EP (Na = 1600)</strong></div>
          <div class="dcegm-kpi"><span>Dobras EP (Na=1600)</span><strong>${DATA.dobras_ep.total_dobras} (3 int. + 1 front.)</strong></div>
          <div class="dcegm-kpi"><span>Dobras EG (Na=400)</span><strong>${eq.dobras_eg} (monotônica)</strong></div>
          <div class="dcegm-kpi"><span>Conc. d* (EP Na=1600)</span><strong>${conc1600}</strong></div>
        `;
      }
    }

    // --------------------------------------------------------
    // TAB 3: STATIONARY DISTRIBUTION & GENERAL EQUILIBRIUM
    // --------------------------------------------------------
    else if (state.tab === 'dist') {
      const dcSol = eq.dc;
      const vfiSol = eq.vfi;

      if (state.distView === 'mu') {
        const maxX = state.zoomLow ? 25 : 80;
        const aFull = DATA.meta.a_full;
        const cdfDc = computeCdf(dcSol.mu_a);
        const cdfVfi = computeCdf(vfiSol.mu_a);
        const sDc = pairSeries(aFull, dcSol.mu_a, maxX);
        const sVfi = pairSeries(aFull, vfiSol.mu_a, maxX);
        const [, yMax] = niceBounds([...sDc.map(p => p.y), ...sVfi.map(p => p.y), 0], 0.08);
        const { tx, ty } = drawAxes(ctx, pad, plotW, plotH, 0, maxX, 0, yMax, pal, 'Ativos a', 'Massa estacionária μ(a)', (v) => v.toFixed(0), (v) => (v * 100).toFixed(1) + '%');

        drawLineSeries(ctx, sDc, tx, ty, pal.dc, { width: 2.2, fillAlpha: 0.12, baseline: 0 });
        drawLineSeries(ctx, sVfi, tx, ty, pal.vfi, { width: 1.9, dashed: true });

        let infoText = `EG (Na=400, Young 2010) &middot; Massa em a=0: DC ${fmt(dcSol.resumo.frac_a_min, 2)}% vs VFI ${fmt(vfiSol.resumo.frac_a_min, 2)}% | Média: ${fmt(dcSol.resumo.media_a, 2)} vs ${fmt(vfiSol.resumo.media_a, 2)} | P25: ${fmt(dcSol.resumo.P25, 2)} · P50: ${fmt(dcSol.resumo.P50, 2)} vs ${fmt(vfiSol.resumo.P50, 2)} · P75: ${fmt(dcSol.resumo.P75, 2)} · P90: ${fmt(dcSol.resumo.P90, 2)} vs ${fmt(vfiSol.resumo.P90, 2)}.<br>Nota numérica: picos discretos da VFI em &mu;(a) decorrem da restrição de a'(a) aos nós da grade (&omega; = 1 na loteria de Young), enquanto o DC-EGM interpola a'(a) continuamente entre nós adjacentes.`;
        if (hoverState.active && hoverState.px >= pad.l && hoverState.px <= pad.l + plotW) {
          const targetX = ((hoverState.px - pad.l) / plotW) * maxX;
          const idx = nearestIndex(aFull, targetX, maxX);
          if (idx >= 0) {
            const cx = tx(aFull[idx]);
            ctx.save(); ctx.strokeStyle = pal.muted; ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(cx, pad.t); ctx.lineTo(cx, pad.t + plotH); ctx.stroke(); ctx.restore();
            infoText = `<strong>a = ${fmt(aFull[idx], 2)}</strong> &middot; <span style="color:${pal.dc}">DC-EGM: &mu;=${(dcSol.mu_a[idx] * 100).toFixed(2)}%, F(a)=${(cdfDc[idx] * 100).toFixed(1)}%</span> &middot; <span style="color:${pal.vfi}">VFI: &mu;=${(vfiSol.mu_a[idx] * 100).toFixed(2)}%, F(a)=${(cdfVfi[idx] * 100).toFixed(1)}%</span>`;
          }
        }
        readoutEl.innerHTML = infoText;
        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>DC-EGM (Gini ${fmt(dcSol.resumo.gini, 4)})</span>
          <span class="dcegm-leg-item"><i class="dashed" style="border-color:${pal.vfi}"></i>VFI Vetorizada (Gini ${fmt(vfiSol.resumo.gini, 4)})</span>
        `;
      } else {
        const rDc = dcSol.historico.r.map((val, idx) => ({ x: idx + 1, y: val }));
        const rVfi = vfiSol.historico.r.map((val, idx) => ({ x: idx + 1, y: val }));
        const maxIt = Math.max(rDc.length, rVfi.length);
        const [yMin, yMax] = niceBounds([...rDc.map(p => p.y), ...rVfi.map(p => p.y)], 0.1);
        const { tx, ty } = drawAxes(ctx, pad, plotW, plotH, 1, maxIt, yMin, yMax, pal, 'Iteração da Bisseção', 'Taxa Real r (%)', (v) => v.toFixed(0), (v) => v.toFixed(2) + '%');

        drawLineSeries(ctx, rDc, tx, ty, pal.dc, { width: 2.3 });
        drawLineSeries(ctx, rVfi, tx, ty, pal.vfi, { width: 2.0, dashed: true });
        [ { s: rDc, c: pal.dc }, { s: rVfi, c: pal.vfi } ].forEach(({ s, c }) => {
          ctx.fillStyle = c;
          s.forEach(p => { ctx.beginPath(); ctx.arc(tx(p.x), ty(p.y), 3.5, 0, Math.PI * 2); ctx.fill(); });
        });

        let infoText = `Procedimento de bisseção encerrado após <strong>${dcSol.resumo.iter} iterações (${dcSol.resumo.tempo}s)</strong> no DC-EGM e <strong>${vfiSol.resumo.iter} iterações (${vfiSol.resumo.tempo}s)</strong> na VFI.<br>Resíduo relativo de mercado |f(k)|/k (tol. 10<sup>-4</sup>): DC-EGM = <strong>${fmtSci(dcSol.resumo.erro_rel_mercado)}</strong> (atendida) · VFI = <strong>${fmtSci(vfiSol.resumo.erro_rel_mercado)}</strong> (acima; encerrou por largura do intervalo).`;
        if (hoverState.active && hoverState.px >= pad.l && hoverState.px <= pad.l + plotW) {
          const itHit = Math.max(1, Math.min(maxIt, Math.round(1 + ((hoverState.px - pad.l) / plotW) * (maxIt - 1))));
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

      kpiEl.innerHTML = `
        <div class="dcegm-kpi"><span>Gini (DC vs VFI)</span><strong>${fmt(dcSol.resumo.gini, 4)} vs ${fmt(vfiSol.resumo.gini, 4)}</strong></div>
        <div class="dcegm-kpi"><span>Mediana P50 (DC / VFI)</span><strong>${fmt(dcSol.resumo.P50, 2)} / ${fmt(vfiSol.resumo.P50, 2)}</strong></div>
        <div class="dcegm-kpi"><span>Resíduo Mercado |f(k)|/k</span><strong>${fmtSci(dcSol.resumo.erro_rel_mercado)} vs ${fmtSci(vfiSol.resumo.erro_rel_mercado)}</strong></div>
        <div class="dcegm-kpi"><span>Resíduo Walras (Contábil)</span><strong>${fmtSci(dcSol.resumo.walras)} vs ${fmtSci(vfiSol.resumo.walras)}</strong></div>
      `;
    }

    // --------------------------------------------------------
    // TAB 4: SCALABILITY & BENCHMARKS
    // --------------------------------------------------------
    else if (state.tab === 'bench') {
      if (state.benchView === 'multigrade') {
        const rows = DATA.benchmarks.multigrade;
        const maxT = Math.max(...rows.map(r => Math.max(parseFloat(r.Tempo_VFI_s), parseFloat(r.Tempo_DCEGM_s))));
        const { tx, ty } = drawAxes(ctx, pad, plotW, plotH, 0, rows.length, 0, maxT * 1.15, pal, 'Resolução da Malha (N_a, EP χ̄=0,05)', 'Tempo de Política EP (s)', () => '', (v) => v.toFixed(0) + 's');

        const groupW = plotW / rows.length;
        const barW = Math.min(44, groupW * 0.28);

        let hoveredIdx = -1;
        if (hoverState.active && hoverState.px >= pad.l && hoverState.px <= pad.l + plotW) {
          hoveredIdx = Math.max(0, Math.min(rows.length - 1, Math.floor((hoverState.px - pad.l) / groupW)));
        }

        rows.forEach((r, idx) => {
          const cx = pad.l + groupW * (idx + 0.5);
          if (idx === hoveredIdx) {
            ctx.fillStyle = pal.bgSubtle;
            ctx.fillRect(pad.l + idx * groupW + 2, pad.t + 1, groupW - 4, plotH - 2);
          }

          const tDc = parseFloat(r.Tempo_DCEGM_s);
          const tVfi = parseFloat(r.Tempo_VFI_s);
          const hDc = plotH - (ty(tDc) - pad.t);
          const hVfi = plotH - (ty(tVfi) - pad.t);

          ctx.fillStyle = pal.dc;
          ctx.fillRect(cx - barW - 3, ty(tDc), barW, hDc);
          ctx.fillStyle = pal.vfi;
          ctx.fillRect(cx + 3, ty(tVfi), barW, hVfi);

          ctx.fillStyle = pal.ink;
          ctx.font = '600 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${tDc.toFixed(2)}s`, cx - barW / 2 - 3, ty(tDc) - 5);
          ctx.fillText(`${tVfi.toFixed(2)}s`, cx + barW / 2 + 3, ty(tVfi) - 5);

          ctx.fillStyle = pal.muted;
          ctx.font = '600 11px Inter, sans-serif';
          ctx.fillText(`Na=${r.Na} (${r.Speedup}x)`, cx, pad.t + plotH + 10);
        });

        const rSel = hoveredIdx >= 0 ? rows[hoveredIdx] : rows[rows.length - 1];
        const convNote = String(rSel.Convergencia_DCEGM).toLowerCase() === 'nao'
          ? `Não atingiu 10⁻⁷ em ${rSel.Iter_DCEGM} it. (resíduo Cauchy V = ${fmtSci(DATA.dobras_ep.na400_erro_V)})`
          : `Convergiu em ${rSel.Iter_DCEGM} iterações (tol. 10⁻⁷)`;
        readoutEl.innerHTML = `<strong>Malha N_a = ${rSel.Na} (EP, χ̄=0,05)</strong> &middot; Tempo: <strong>${rSel.Tempo_DCEGM_s}s vs ${rSel.Tempo_VFI_s}s</strong> (${rSel.Speedup}x) · Convergência DC: ${convNote}<br>Discrepância entre métodos (VFI vs DC): ||ΔV||<sub>∞</sub> = <strong>${rSel.dif_sup_V}</strong> · ||Δc||<sub>∞</sub> = <strong>${rSel.dif_sup_c}</strong> · Conc. d* = <strong>${rSel.Concordancia_Ocup_pct}%</strong>.`;

        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>DC-EGM com Upper Envelope (EP)</span>
          <span class="dcegm-leg-item"><i style="background:${pal.vfi}"></i>VFI Vetorizada (EP)</span>
        `;

        const r16 = rows[rows.length - 1];
        const r4 = rows[0];
        kpiEl.innerHTML = `
          <div class="dcegm-kpi"><span>Regime da Vista</span><strong>EP Multigrade (χ̄=0,05)</strong></div>
          <div class="dcegm-kpi"><span>Tempo / Speedup (1600)</span><strong>${r16.Tempo_DCEGM_s}s vs ${r16.Tempo_VFI_s}s (${r16.Speedup}x)</strong></div>
          <div class="dcegm-kpi"><span>Conv. DC (400 / ≥800)</span><strong>Não (${r4.Iter_DCEGM}) / Sim (${r16.Iter_DCEGM})</strong></div>
          <div class="dcegm-kpi"><span>Discrep. VFI–DC (1600)</span><strong>||Δc||∞=${r16.dif_sup_c} · d*=${r16.Concordancia_Ocup_pct}%</strong></div>
        `;
      } else {
        const rows = DATA.benchmarks.historico9.map(r => ({
          name: r.Implementacao,
          x: parseFloat(r.Mediana_s),
          y: parseFloat(r.Euler_Erro_Consumo),
          bellmanMae: parseFloat(r.Bellman_MAE),
          speedup: r.Speedup_vs_VFI_Vet
        }));
        const { tx, ty } = drawAxes(ctx, pad, plotW, plotH, 1, 120, 1e-7, 2e-2, pal, 'Tempo Mediano (s, escala log — χ̄=0)', 'Erro Médio de Euler (log)', (v) => v.toFixed(0) + 's', (v) => v.toExponential(0), true, true);

        let hoveredPt = null;
        let minPxDist = 28;
        rows.forEach((pt) => {
          const px = tx(pt.x), py = ty(pt.y);
          const isBest = pt.name.includes('DC-EGM Otimizado');
          const isDc = pt.name.includes('DC-EGM');
          ctx.fillStyle = isBest ? pal.green : (isDc ? pal.dc : pal.vfi);
          ctx.beginPath(); ctx.arc(px, py, isBest ? 6.5 : 5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = pal.bg; ctx.lineWidth = 1.5; ctx.stroke();

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
          <span class="dcegm-leg-item"><i style="background:${pal.green}"></i>DC-EGM Otimizado (χ̄=0)</span>
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>DC-EGM Padrão (χ̄=0)</span>
          <span class="dcegm-leg-item"><i style="background:${pal.vfi}"></i>Variantes VFI (400–3200, χ̄=0)</span>
        `;

        kpiEl.innerHTML = `
          <div class="dcegm-kpi"><span>Regime da Vista</span><strong>Histórico (χ̄ = 0)</strong></div>
          <div class="dcegm-kpi"><span>Euler DC-EGM (χ̄=0)</span><strong>${fmtSci(bestRow.y)}</strong></div>
          <div class="dcegm-kpi"><span>Euler VFI-3200 (χ̄=0)</span><strong>${fmtSci(vfi3200.y)}</strong></div>
          <div class="dcegm-kpi"><span>Speedup vs VFI-Vet</span><strong>${bestRow.speedup} (${fmt(bestRow.x, 2)}s)</strong></div>
        `;
      }
    }
  }

  function buildUI() {
    const zOpts = DATA.meta.z.map((v, i) => `<option value="${i}"${i === state.iz ? ' selected' : ''}>z${i + 1} (${v.toFixed(3)})</option>`).join('');
    const dOpts = DATA.meta.occupations.map((n, i) => `<option value="${i}"${i === state.dPrev ? ' selected' : ''}>${n}</option>`).join('');
    const foldOpts = DATA.dobras_ep.folds.map((f, i) => `<option value="${i}"${i === state.foldIdx ? ' selected' : ''}>${f.label}</option>`).join('');

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

      <div class="dcegm-regime-pill" id="dcegm-regime"></div>

      <div class="dcegm-controls">
        ${state.tab === 'policies' ? `
          <label class="dcegm-field"><span>Variável</span>
            <select id="ctrl-pvar">
              <option value="ap"${state.policyVar === 'ap' ? ' selected' : ''}>Poupança a'(a)</option>
              <option value="c"${state.policyVar === 'c' ? ' selected' : ''}>Consumo c*(a)</option>
              <option value="V"${state.policyVar === 'V' ? ' selected' : ''}>Função Valor V(a)</option>
              <option value="net"${state.policyVar === 'net' ? ' selected' : ''}>Poupança Líquida a' - a</option>
              <option value="d_star"${state.policyVar === 'd_star' ? ' selected' : ''}>Ocupação Ótima d*(a)</option>
            </select>
          </label>
          <label class="dcegm-field"><span>Produtividade z</span><select id="ctrl-iz">${zOpts}</select></label>
          <label class="dcegm-field"><span>Ocupação ant. d⁻</span><select id="ctrl-dp">${dOpts}</select></label>
          <label class="dcegm-check"><input type="checkbox" id="ctrl-vfi"${state.compareVfi ? ' checked' : ''}> Comparar VFI</label>
          <label class="dcegm-check"><input type="checkbox" id="ctrl-zoom"${state.zoomLow ? ' checked' : ''}> Zoom a &le; 20</label>
        ` : ''}

        ${state.tab === 'folds' ? `
          <label class="dcegm-field"><span>Diagnóstico</span>
            <select id="ctrl-fmode">
              <option value="endo"${state.foldMode === 'endo' ? ' selected' : ''}>Dobras Grade Endógena (EP Na=1600)</option>
              <option value="vcond"${state.foldMode === 'vcond' ? ' selected' : ''}>Ramos v_d(a) e Envelope (EG Na=400)</option>
            </select>
          </label>
          ${state.foldMode === 'endo' ? `
            <label class="dcegm-field"><span>Estado com dobra</span><select id="ctrl-fidx">${foldOpts}</select></label>
          ` : `
            <label class="dcegm-field"><span>Produtividade z</span><select id="ctrl-iz">${zOpts}</select></label>
            <label class="dcegm-field"><span>Ocupação ant. d⁻</span><select id="ctrl-dp">${dOpts}</select></label>
            <label class="dcegm-check"><input type="checkbox" id="ctrl-fzoom"${state.foldZoomLow ? ' checked' : ''}> Zoom a &le; 25</label>
          `}
        ` : ''}

        ${state.tab === 'dist' ? `
          <label class="dcegm-field"><span>Gráfico (EG Na=400)</span>
            <select id="ctrl-dview">
              <option value="mu"${state.distView === 'mu' ? ' selected' : ''}>Densidade Estacionária μ(a)</option>
              <option value="bisection"${state.distView === 'bisection' ? ' selected' : ''}>Procedimento de Bisseção (r*)</option>
            </select>
          </label>
          ${state.distView === 'mu' ? `
            <label class="dcegm-check"><input type="checkbox" id="ctrl-zoom"${state.zoomLow ? ' checked' : ''}> Zoom a &le; 25</label>
          ` : ''}
        ` : ''}

        ${state.tab === 'bench' ? `
          <label class="dcegm-field"><span>Experimento</span>
            <select id="ctrl-bview">
              <option value="multigrade"${state.benchView === 'multigrade' ? ' selected' : ''}>Refinamento Multigrade (EP, χ̄=0,05)</option>
              <option value="euler"${state.benchView === 'euler' ? ' selected' : ''}>Benchmark Histórico Euler (χ̄=0, 9 impl.)</option>
            </select>
          </label>
        ` : ''}
      </div>

      <div class="dcegm-readout" id="dcegm-readout">Carregando dados numéricos...</div>
      <div class="dcegm-canvas-wrap">
        <canvas id="dcegm-canvas"></canvas>
      </div>
      <div class="dcegm-legend" id="dcegm-legend"></div>
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
