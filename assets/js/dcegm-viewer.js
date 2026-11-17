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

  let DATA = null;
  let state = {
    tab: 'policies',       // policies | folds | dist | bench
    iz: 2,                 // 0..4 (z3 = 0.901 default)
    dPrev: 2,              // 0=N, 1=I, 2=F
    policyVar: 'ap',       // V | c | ap | net | d_star
    compareVfi: true,
    zoomLow: true,
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

  // Filter paired (x, y) arrays where both are finite numbers
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

  // Generic crisp HiDPI Canvas Line/Scatter/Bar helper
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

    // Horizontal grid & Y ticks
    const yTicks = 5;
    for (let t = 0; t <= yTicks; t++) {
      const frac = t / yTicks;
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

    // Vertical grid & X ticks
    const xTicks = 5;
    for (let t = 0; t <= xTicks; t++) {
      const frac = t / xTicks;
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

    // Border box
    ctx.strokeStyle = pal.grid;
    ctx.strokeRect(pad.l, pad.t, plotW, plotH);

    // Axis titles
    ctx.fillStyle = pal.ink;
    ctx.font = '600 11.5px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(xLabel, pad.l + plotW / 2, pad.t + plotH + pad.b - 2);

    ctx.save();
    ctx.translate(13, pad.t + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'top';
    ctx.fillText(yLabel, 0, -4);
    ctx.restore();

    return { tx, ty };
  }

  function drawLineSeries(ctx, pts, tx, ty, color, opts = {}) {
    if (!pts.length) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = opts.width || 2.2;
    if (opts.dashed) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    pts.forEach((p, idx) => {
      const x = tx(p.x), y = ty(p.y);
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        if (opts.step) {
          ctx.lineTo(x, ty(pts[idx - 1].y));
        }
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

  function nearestPoint(pts, targetX) {
    if (!pts.length) return null;
    let best = pts[0], bestDist = Math.abs(pts[0].x - targetX);
    for (let i = 1; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - targetX);
      if (d < bestDist) {
        best = pts[i];
        bestDist = d;
      }
    }
    return best;
  }

  function renderChart() {
    const canvas = container.querySelector('#dcegm-canvas');
    const readoutEl = container.querySelector('#dcegm-readout');
    const legendEl = container.querySelector('#dcegm-legend');
    const kpiEl = container.querySelector('#dcegm-kpis');
    if (!canvas || !DATA) return;

    const pal = getPalette();
    const { ctx, w, h } = setupCanvas(canvas);
    const pad = { l: w < 460 ? 52 : 62, r: 16, t: 16, b: 36 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    const eq = DATA.equilibrio_geral;
    const aGrid = DATA.meta.a_sampled;
    const zVals = DATA.meta.z;
    const occNames = DATA.meta.occupations;

    // --------------------------------------------------------
    // TAB 1: POLICIES & VALUE FUNCTION (EG)
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

      // Reference line (y=0 for net saving, 45-deg for a')
      if (state.policyVar === 'net') {
        drawLineSeries(ctx, [{ x: 0, y: 0 }, { x: maxX, y: 0 }], tx, ty, pal.muted, { width: 1, dashed: true });
      } else if (state.policyVar === 'ap') {
        drawLineSeries(ctx, [{ x: 0, y: 0 }, { x: Math.min(maxX, yMax), y: Math.min(maxX, yMax) }], tx, ty, pal.muted, { width: 1, dashed: true });
      }

      drawLineSeries(ctx, ptsDc, tx, ty, pal.dc, { width: 2.3, step: isStep });
      if (state.compareVfi) {
        drawLineSeries(ctx, ptsVfi, tx, ty, pal.vfi, { width: 2.0, dashed: true, step: isStep });
      }

      // Hover readout
      let infoText = `Passe o mouse ou toque no gráfico (z${state.iz + 1}=${fmt(zVals[state.iz], 3)}, d⁻=${occNames[state.dPrev]}).`;
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
        (state.compareVfi ? `<span class="dcegm-leg-item"><i class="dashed" style="border-color:${pal.vfi}"></i>VFI Vetorizada</span>` : '');
      kpiEl.innerHTML = `
        <div class="dcegm-kpi"><span>r* (DC-EGM)</span><strong>${fmt(dcSol.resumo.r, 4)}%</strong></div>
        <div class="dcegm-kpi"><span>w* (DC-EGM)</span><strong>${fmt(dcSol.resumo.w, 4)}</strong></div>
        <div class="dcegm-kpi"><span>||&Delta;V||<sub>&infin;</sub> EG</span><strong>${fmt(eq.discrepancias.dif_sup_V, 4)}</strong></div>
        <div class="dcegm-kpi"><span>||&Delta;c||<sub>&infin;</sub> EG</span><strong>${fmt(eq.discrepancias.dif_sup_c, 4)}</strong></div>
      `;
    }

    // --------------------------------------------------------
    // TAB 2: UPPER ENVELOPE & DOBRAS (EP)
    // --------------------------------------------------------
    else if (state.tab === 'folds') {
      if (state.foldMode === 'vcond') {
        const maxX = state.zoomLow ? 16 : 80;
        const dcVc = eq.dc.v_cond[state.dPrev]; // [3][5][173]
        const sN = pairSeries(aGrid, dcVc[0][state.iz], maxX);
        const sI = pairSeries(aGrid, dcVc[1][state.iz], maxX);
        const sF = pairSeries(aGrid, dcVc[2][state.iz], maxX);
        const sEnv = pairSeries(aGrid, eq.dc.V[state.dPrev][state.iz], maxX);

        const allY = [...sN, ...sI, ...sF, ...sEnv].map(p => p.y);
        const [yMin, yMax] = niceBounds(allY);
        const { tx, ty } = drawAxes(ctx, pad, plotW, plotH, 0, maxX, yMin, yMax, pal, 'Ativos a', 'v(a, z, d, d⁻)', (v) => v.toFixed(0), (v) => v.toFixed(1));

        drawLineSeries(ctx, sN, tx, ty, pal.slate, { width: 1.8, dashed: true });
        drawLineSeries(ctx, sI, tx, ty, pal.green, { width: 2.0 });
        drawLineSeries(ctx, sF, tx, ty, pal.dc, { width: 2.0 });
        drawLineSeries(ctx, sEnv, tx, ty, pal.ink, { width: 2.6 });

        let infoText = `Cruzamento das funções valor condicionais (z${state.iz + 1}=${fmt(zVals[state.iz], 3)}, d⁻=${occNames[state.dPrev]}).`;
        if (hoverState.active && hoverState.px >= pad.l && hoverState.px <= pad.l + plotW) {
          const targetX = ((hoverState.px - pad.l) / plotW) * maxX;
          const pEnv = nearestPoint(sEnv, targetX);
          const pN = nearestPoint(sN, targetX);
          const pI = nearestPoint(sI, targetX);
          const pF = nearestPoint(sF, targetX);
          if (pEnv) {
            const cx = tx(pEnv.x);
            ctx.save();
            ctx.strokeStyle = pal.muted; ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(cx, pad.t); ctx.lineTo(cx, pad.t + plotH); ctx.stroke();
            ctx.fillStyle = pal.ink; ctx.beginPath(); ctx.arc(cx, ty(pEnv.y), 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            infoText = `<strong>a=${fmt(pEnv.x, 2)}</strong> &middot; V=${fmt(pEnv.y, 3)} | ` +
              `<span style="color:${pal.slate}">v_N:${pN ? fmt(pN.y, 2) : '—'}</span> · ` +
              `<span style="color:${pal.green}">v_I:${pI ? fmt(pI.y, 2) : '—'}</span> · ` +
              `<span style="color:${pal.dc}">v_F:${pF ? fmt(pF.y, 2) : '—'}</span>`;
          }
        }
        readoutEl.innerHTML = infoText;
        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.ink}"></i>Envelope V(a)</span>
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>v_F (Formal)</span>
          <span class="dcegm-leg-item"><i style="background:${pal.green}"></i>v_I (Informal)</span>
          <span class="dcegm-leg-item"><i class="dashed" style="border-color:${pal.slate}"></i>v_N (Inativo)</span>
        `;
      } else {
        // Endogenous Grid Folds from Na=1600
        const folds = DATA.dobras_ep.folds;
        const fItem = folds[state.foldIdx] || folds[0];
        const pts = fItem.fold_a_prime.map((ap, i) => ({ x: ap, y: fItem.fold_a_endo[i], neg: fItem.neg_rel_indices.includes(i) }));
        const xMin = pts[0].x, xMax = pts[pts.length - 1].x;
        const [yMin, yMax] = niceBounds(pts.map(p => p.y), 0.12);
        const { tx, ty } = drawAxes(ctx, pad, plotW, plotH, xMin, xMax, yMin, yMax, pal, "Poupança a'", "Grade Endógena a_endog(a')", (v) => v.toFixed(2), (v) => v.toFixed(2));

        drawLineSeries(ctx, pts, tx, ty, pal.dc, { width: 2.2 });
        // Highlight points & negative-slope fold segment(s) in crimson
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

        let infoText = `Dobra na grade endógena em ${fItem.label} (N_a = 1.600). Em vermelho: inversão da_endog/da' &lt; 0.`;
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
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>a_endog(a') monótona</span>
          <span class="dcegm-leg-item"><i style="background:${pal.crimson}"></i>Dobra (da_endog / da' &lt; 0)</span>
        `;
      }
      kpiEl.innerHTML = `
        <div class="dcegm-kpi"><span>Dobras (N_a=1600)</span><strong>${DATA.dobras_ep.total_dobras}</strong></div>
        <div class="dcegm-kpi"><span>Limiar &chi;&#772;</span><strong>${DATA.meta.params.chi_bar}</strong></div>
        <div class="dcegm-kpi"><span>Concordância d*</span><strong>99,97%</strong></div>
        <div class="dcegm-kpi"><span>Violação Orç.</span><strong>&lt; 10<sup>-12</sup></strong></div>
      `;
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
        const sDc = pairSeries(aFull, dcSol.mu_a, maxX);
        const sVfi = pairSeries(aFull, vfiSol.mu_a, maxX);
        const [yMin, yMax] = niceBounds([...sDc.map(p => p.y), ...sVfi.map(p => p.y), 0], 0.08);
        const { tx, ty } = drawAxes(ctx, pad, plotW, plotH, 0, maxX, 0, yMax, pal, 'Ativos a', 'Massa estacionária μ(a)', (v) => v.toFixed(0), (v) => (v * 100).toFixed(1) + '%');

        drawLineSeries(ctx, sDc, tx, ty, pal.dc, { width: 2.2, fillAlpha: 0.12, baseline: 0 });
        drawLineSeries(ctx, sVfi, tx, ty, pal.vfi, { width: 1.9, dashed: true });

        let infoText = `Distribuição estacionária de riqueza em Equilíbrio Geral (Young, 2010). Massa em a=0: DC-EGM ${dcSol.resumo.frac_a_min}% vs VFI ${vfiSol.resumo.frac_a_min}%.`;
        if (hoverState.active && hoverState.px >= pad.l && hoverState.px <= pad.l + plotW) {
          const targetX = ((hoverState.px - pad.l) / plotW) * maxX;
          const pDc = nearestPoint(sDc, targetX);
          const pVfi = nearestPoint(sVfi, targetX);
          if (pDc && pVfi) {
            const cx = tx(pDc.x);
            ctx.save(); ctx.strokeStyle = pal.muted; ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(cx, pad.t); ctx.lineTo(cx, pad.t + plotH); ctx.stroke(); ctx.restore();
            infoText = `<strong>a = ${fmt(pDc.x, 2)}</strong> &middot; <span style="color:${pal.dc}">DC-EGM: ${(pDc.y * 100).toFixed(2)}%</span> &middot; <span style="color:${pal.vfi}">VFI: ${(pVfi.y * 100).toFixed(2)}%</span>`;
          }
        }
        readoutEl.innerHTML = infoText;
        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>DC-EGM (Gini ${dcSol.resumo.gini})</span>
          <span class="dcegm-leg-item"><i class="dashed" style="border-color:${pal.vfi}"></i>VFI Vetorizada (Gini ${vfiSol.resumo.gini})</span>
        `;
      } else {
        // Bisection Price r convergence
        const rDc = dcSol.historico.r.map((val, idx) => ({ x: idx + 1, y: val }));
        const rVfi = vfiSol.historico.r.map((val, idx) => ({ x: idx + 1, y: val }));
        const maxIt = Math.max(rDc.length, rVfi.length);
        const [yMin, yMax] = niceBounds([...rDc.map(p => p.y), ...rVfi.map(p => p.y)], 0.1);
        const { tx, ty } = drawAxes(ctx, pad, plotW, plotH, 1, maxIt, yMin, yMax, pal, 'Iteração da Bisseção', 'Taxa Real de Juros r (%)', (v) => v.toFixed(0), (v) => v.toFixed(2) + '%');

        drawLineSeries(ctx, rDc, tx, ty, pal.dc, { width: 2.3 });
        drawLineSeries(ctx, rVfi, tx, ty, pal.vfi, { width: 2.0, dashed: true });
        [ { s: rDc, c: pal.dc }, { s: rVfi, c: pal.vfi } ].forEach(({ s, c }) => {
          ctx.fillStyle = c;
          s.forEach(p => { ctx.beginPath(); ctx.arc(tx(p.x), ty(p.y), 3.5, 0, Math.PI * 2); ctx.fill(); });
        });

        readoutEl.innerHTML = `Bisseção de equilíbrio geral: DC-EGM converge em <strong>${dcSol.resumo.iter} iterações (${dcSol.resumo.tempo}s)</strong> vs. VFI em <strong>${vfiSol.resumo.iter} iterações (${vfiSol.resumo.tempo}s)</strong>.`;
        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>DC-EGM (${dcSol.resumo.iter} it.)</span>
          <span class="dcegm-leg-item"><i class="dashed" style="border-color:${pal.vfi}"></i>VFI (${vfiSol.resumo.iter} it.)</span>
        `;
      }

      kpiEl.innerHTML = `
        <div class="dcegm-kpi"><span>Setor Formal M_F</span><strong>${dcSol.resumo.mu_d[2]}%</strong></div>
        <div class="dcegm-kpi"><span>Gini Riqueza</span><strong>${fmt(dcSol.resumo.gini, 4)}</strong></div>
        <div class="dcegm-kpi"><span>Resíduo Walras</span><strong>${fmtSci(dcSol.resumo.walras)}</strong></div>
        <div class="dcegm-kpi"><span>Speedup EG</span><strong>${eq.discrepancias.speedup_eg}x</strong></div>
      `;
    }

    // --------------------------------------------------------
    // TAB 4: SCALABILITY & BENCHMARKS
    // --------------------------------------------------------
    else if (state.tab === 'bench') {
      if (state.benchView === 'multigrade') {
        const rows = DATA.benchmarks.multigrade;
        const maxT = Math.max(...rows.map(r => Math.max(parseFloat(r.Tempo_VFI_s), parseFloat(r.Tempo_DCEGM_s))));
        const { tx, ty } = drawAxes(ctx, pad, plotW, plotH, 0, rows.length, 0, maxT * 1.15, pal, 'Resolução da Malha (N_a)', 'Tempo de Política EP (s)', () => '', (v) => v.toFixed(0) + 's');

        const groupW = plotW / rows.length;
        const barW = Math.min(44, groupW * 0.28);

        rows.forEach((r, idx) => {
          const cx = pad.l + groupW * (idx + 0.5);
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

        readoutEl.innerHTML = `Refinamento multigrade (Fase 1, EP): DC-EGM atinge <strong>7,65x</strong> de aceleração em N_a=1.600 (5,20s vs 39,75s).`;
        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>DC-EGM com Upper Envelope</span>
          <span class="dcegm-leg-item"><i style="background:${pal.vfi}"></i>VFI Vetorizada</span>
        `;
      } else {
        // Log-log frontier: Time (s) vs Euler Error (benchmark historico 9)
        const rows = DATA.benchmarks.historico9.map(r => ({
          name: r.Implementacao,
          x: parseFloat(r.Mediana_s),
          y: parseFloat(r.Euler_Erro_Consumo),
          speedup: r.Speedup_vs_VFI_Vet
        }));
        const { tx, ty } = drawAxes(ctx, pad, plotW, plotH, 1, 120, 1e-7, 2e-2, pal, 'Tempo Mediano (s, escala log)', 'Erro Médio de Euler (escala log)', (v) => v.toFixed(0) + 's', (v) => v.toExponential(0), true, true);

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

        if (hoveredPt) {
          readoutEl.innerHTML = `<strong>${hoveredPt.name}</strong> &middot; Mediana: <strong>${fmt(hoveredPt.x, 3)}s</strong> &middot; Erro Euler: <strong>${fmtSci(hoveredPt.y)}</strong> (${hoveredPt.speedup})`;
        } else {
          readoutEl.innerHTML = `Benchmark preliminar (&chi;&#772;=0, 9 implementações). Passe sobre um ponto: DC-EGM Otimizado combina <strong>1,66s</strong> com erro de Euler <strong>7,18e-07</strong>.`;
        }
        legendEl.innerHTML = `
          <span class="dcegm-leg-item"><i style="background:${pal.green}"></i>DC-EGM Otimizado (ótimo de Pareto)</span>
          <span class="dcegm-leg-item"><i style="background:${pal.dc}"></i>DC-EGM Padrão</span>
          <span class="dcegm-leg-item"><i style="background:${pal.vfi}"></i>Variantes VFI (400–3200)</span>
        `;
      }

      kpiEl.innerHTML = `
        <div class="dcegm-kpi"><span>Speedup Na=1600</span><strong>7,65x</strong></div>
        <div class="dcegm-kpi"><span>Euler DC-EGM (&chi;&#772;=0)</span><strong>7,18e-07</strong></div>
        <div class="dcegm-kpi"><span>Euler VFI-3200</span><strong>1,88e-03</strong></div>
        <div class="dcegm-kpi"><span>Speedup Bisseção</span><strong>3,49x</strong></div>
      `;
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
              <option value="endo"${state.foldMode === 'endo' ? ' selected' : ''}>Dobras na Grade Endógena (Na=1600)</option>
              <option value="vcond"${state.foldMode === 'vcond' ? ' selected' : ''}>Cruzamento v_d(a) e Quinas</option>
            </select>
          </label>
          ${state.foldMode === 'endo' ? `
            <label class="dcegm-field"><span>Estado com dobra</span><select id="ctrl-fidx">${foldOpts}</select></label>
          ` : `
            <label class="dcegm-field"><span>Produtividade z</span><select id="ctrl-iz">${zOpts}</select></label>
            <label class="dcegm-field"><span>Ocupação ant. d⁻</span><select id="ctrl-dp">${dOpts}</select></label>
            <label class="dcegm-check"><input type="checkbox" id="ctrl-zoom"${state.zoomLow ? ' checked' : ''}> Zoom a &le; 16</label>
          `}
        ` : ''}

        ${state.tab === 'dist' ? `
          <label class="dcegm-field"><span>Gráfico</span>
            <select id="ctrl-dview">
              <option value="mu"${state.distView === 'mu' ? ' selected' : ''}>Densidade Estacionária μ(a)</option>
              <option value="bisection"${state.distView === 'bisection' ? ' selected' : ''}>Convergência Bisseção (r*)</option>
            </select>
          </label>
          ${state.distView === 'mu' ? `
            <label class="dcegm-check"><input type="checkbox" id="ctrl-zoom"${state.zoomLow ? ' checked' : ''}> Zoom a &le; 25</label>
          ` : ''}
        ` : ''}

        ${state.tab === 'bench' ? `
          <label class="dcegm-field"><span>Comparação</span>
            <select id="ctrl-bview">
              <option value="multigrade"${state.benchView === 'multigrade' ? ' selected' : ''}>Refinamento Multigrade (400–1600)</option>
              <option value="euler"${state.benchView === 'euler' ? ' selected' : ''}>Fronteira Tempo vs. Euler (9 impl.)</option>
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

    // Wire events
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

  async function init() {
    container.innerHTML = '<div class="dcegm-loading">Carregando dados numéricos do modelo MATLAB...</div>';
    try {
      const res = await fetch(JSON_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      DATA = await res.json();
      buildUI();
      renderChart();

      if (typeof ResizeObserver === 'function') {
        new ResizeObserver(() => renderChart()).observe(container);
      } else {
        window.addEventListener('resize', renderChart);
      }

      new MutationObserver(() => renderChart()).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (err) {
      container.innerHTML = `<div class="dcegm-loading">Não foi possível carregar os dados interativos (${err.message}).</div>`;
    }
  }

  init();
})();
