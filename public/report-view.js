// The employee bonus report: dial, pacing bar, and the by-month / by-project
// breakdown. Shared by the signed-in dashboard and by public shared reports, so
// a viewer of a shared link sees exactly what the owner sees.
//
// Call BonusReportView.create(els) with the elements to draw into; the returned
// object's render(data) takes an employee summary payload.
(() => {
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const moneyCompact = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  });

  function monthLabel(year, month) {
    return new Date(year, month - 1, 1).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  function summaryRow(label, value, note) {
    const row = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'summary-label';
    name.textContent = label;
    if (note) {
      const noteEl = document.createElement('span');
      noteEl.className = 'summary-note';
      noteEl.textContent = note;
      name.append(noteEl);
    }
    const val = document.createElement('span');
    val.className = 'summary-value';
    val.textContent = value;
    row.append(name, val);
    return row;
  }

  // ---------- Progress bar (goal pacing; percent may exceed 100) ----------

  // Fraction of the earning window elapsed "today" for the viewed year.
  // The window starts at the hire date when hired during that year.
  function elapsedFraction(data) {
    const now = new Date();
    const year = data.year;
    if (year < now.getFullYear()) return 1;
    if (year > now.getFullYear()) return 0;

    let windowStart = new Date(year, 0, 1);
    const hire = data.settings.hireDate
      ? new Date(`${data.settings.hireDate}T00:00:00`)
      : null;
    if (hire && hire.getFullYear() === year && hire > windowStart) {
      windowStart = hire;
    }
    const windowEnd = new Date(year + 1, 0, 1);
    const span = windowEnd - windowStart;
    if (span <= 0) return 1;
    return Math.min(1, Math.max(0, (now - windowStart) / span));
  }

  function renderProgress(els, data) {
    const total = data.totalRevenue;
    const goal = data.computed.thresholdValue;
    const year = data.year;

    els.kpiGoal.textContent = goal > 0 ? money.format(goal) : '—';
    els.kpiCurrentLabel.textContent = `${year} revenue`;
    els.kpiCurrent.textContent = money.format(total);

    // Percent of goal — may exceed 100.
    const pct = goal > 0 ? (total / goal) * 100 : null;
    els.kpiPct.textContent = pct === null ? '—' : `${Math.round(pct)}%`;

    // Pace: where they should be today to stay on track for Dec 31.
    const elapsed = elapsedFraction(data);
    const paceTarget = goal * elapsed;
    const delta = total - paceTarget;
    els.kpiPace.classList.remove('is-good', 'is-bad');
    if (goal <= 0) {
      els.kpiPace.textContent = '—';
    } else if (elapsed === 0) {
      els.kpiPace.textContent = `Starts in ${year}`;
    } else if (elapsed === 1) {
      if (total >= goal) {
        els.kpiPace.textContent = 'Goal met';
        els.kpiPace.classList.add('is-good');
      } else {
        els.kpiPace.textContent = `${money.format(goal - total)} short`;
        els.kpiPace.classList.add('is-bad');
      }
    } else if (Math.abs(delta) < 0.5) {
      els.kpiPace.textContent = 'On pace';
    } else if (delta > 0) {
      els.kpiPace.textContent = `${money.format(delta)} ahead`;
      els.kpiPace.classList.add('is-good');
    } else {
      els.kpiPace.textContent = `${money.format(-delta)} behind`;
      els.kpiPace.classList.add('is-bad');
    }

    // Bar domain stretches to cover overshoot: [0, max(goal, total)].
    const domain = Math.max(goal, total, 1);
    const fillPct = (Math.min(total, goal) / domain) * 100;
    const overPct = total > goal ? ((total - goal) / domain) * 100 : 0;
    const goalPct = (goal / domain) * 100;

    els.progressFill.style.width = `${fillPct}%`;
    els.progressOver.style.left = `${fillPct}%`;
    els.progressOver.style.width = `${overPct}%`;

    els.progressTickGoal.hidden = goal <= 0;
    els.progressTickGoal.style.left = `${goalPct}%`;
    els.progressTickGoal.title = `Bonus goal: ${money.format(goal)}`;

    const showPace = goal > 0 && elapsed > 0 && elapsed < 1;
    els.progressTickPace.hidden = !showPace;
    if (showPace) {
      els.progressTickPace.style.left = `${(paceTarget / domain) * 100}%`;
      els.progressTickPace.title = `On-track target today: ${money.format(paceTarget)}`;
    }

    els.progressEndLabel.textContent = moneyCompact.format(domain);
    els.progressBar.setAttribute(
      'aria-label',
      goal > 0
        ? `${year} revenue ${money.format(total)} of ${money.format(goal)} bonus goal (${Math.round(pct)}%); ${els.kpiPace.textContent} versus today's on-track target`
        : `${year} revenue ${money.format(total)}; no bonus goal configured`
    );
  }

  function renderProration(els, data) {
    const factor = data.computed.prorationFactor;
    if (factor < 1 && data.settings.hireDate) {
      const hired = new Date(`${data.settings.hireDate}T00:00:00`);
      const hiredLabel = hired.toLocaleString('en-US', { month: 'long' });
      els.prorationNote.textContent = `Goal prorated to ${Math.round(factor * 100)}% — hired ${hiredLabel} ${data.year}.`;
      els.prorationNote.hidden = false;
    } else {
      els.prorationNote.hidden = true;
    }
  }

  // ---------- Bonus dial (SVG gauge) ----------

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DIAL = { cx: 110, cy: 96, r: 78, start: -120, sweep: 240 };

  function svgEl(name, attrs = {}) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) {
      node.setAttribute(key, value);
    }
    return node;
  }

  function dialPoint(angle, radius = DIAL.r) {
    const rad = (angle * Math.PI) / 180;
    return [DIAL.cx + radius * Math.sin(rad), DIAL.cy - radius * Math.cos(rad)];
  }

  function arcPath(a0, a1) {
    const [x0, y0] = dialPoint(a0);
    const [x1, y1] = dialPoint(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${DIAL.r} ${DIAL.r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  function renderDial(els, data) {
    const { effectiveMin, effectiveMax } = data.computed;
    const { thresholdPct } = data.settings;
    const total = data.totalRevenue;
    const span = effectiveMax - effectiveMin;
    const pct = span > 0 ? Math.min(1, Math.max(0, (total - effectiveMin) / span)) : 0;
    const tpct = Math.min(1, Math.max(0, thresholdPct / 100));
    const angleAt = (p) => DIAL.start + DIAL.sweep * p;

    const svg = els.dial;
    svg.replaceChildren();
    svg.setAttribute(
      'aria-label',
      `${data.year} revenue ${money.format(total)} on a scale from ${money.format(effectiveMin)} to ${money.format(effectiveMax)}; bonus threshold at ${money.format(data.computed.thresholdValue)}`
    );

    svg.append(svgEl('path', { d: arcPath(angleAt(0), angleAt(1)), class: 'dial-track' }));

    if (pct > 0.002) {
      svg.append(
        svgEl('path', {
          d: arcPath(angleAt(0), angleAt(Math.min(pct, tpct))),
          class: 'dial-fill',
        })
      );
    }
    if (pct > tpct + 0.002) {
      svg.append(
        svgEl('path', { d: arcPath(angleAt(tpct), angleAt(pct)), class: 'dial-bonus' })
      );
    }

    const [tx0, ty0] = dialPoint(angleAt(tpct), DIAL.r - 12);
    const [tx1, ty1] = dialPoint(angleAt(tpct), DIAL.r + 12);
    svg.append(
      svgEl('line', {
        x1: tx0.toFixed(2),
        y1: ty0.toFixed(2),
        x2: tx1.toFixed(2),
        y2: ty1.toFixed(2),
        class: 'dial-tick',
      })
    );

    const value = svgEl('text', {
      x: DIAL.cx,
      y: 94,
      'text-anchor': 'middle',
      class: 'dial-value',
    });
    value.textContent = moneyCompact.format(total);
    svg.append(value);

    const sub = svgEl('text', {
      x: DIAL.cx,
      y: 114,
      'text-anchor': 'middle',
      class: 'dial-sub',
    });
    sub.textContent = `${data.year} revenue`;
    svg.append(sub);

    const [minX] = dialPoint(angleAt(0));
    const [maxX] = dialPoint(angleAt(1));
    const minLabel = svgEl('text', {
      x: minX.toFixed(2),
      y: 154,
      'text-anchor': 'middle',
      class: 'dial-minmax',
    });
    minLabel.textContent = moneyCompact.format(effectiveMin);
    const maxLabel = svgEl('text', {
      x: maxX.toFixed(2),
      y: 154,
      'text-anchor': 'middle',
      class: 'dial-minmax',
    });
    maxLabel.textContent = moneyCompact.format(effectiveMax);
    svg.append(minLabel, maxLabel);
  }

  function renderDialStatus(els, computed) {
    els.dialStatus.classList.toggle('is-bonus', computed.bonusStarted);
    if (computed.bonusStarted) {
      els.dialStatus.textContent = `Bonus value: ${money.format(computed.bonus)} — earning ${computed.bonusRatePct}¢ per $1 above ${moneyCompact.format(computed.thresholdValue)}`;
    } else {
      els.dialStatus.textContent = `Bonus starts at ${money.format(computed.thresholdValue)} — ${money.format(computed.remainingToBonus)} to go`;
    }
  }

  // ---------- Breakdown lists ----------

  function renderBreakdown(els, data) {
    els.monthsList.replaceChildren(
      ...data.monthlyTotals.map((m) =>
        summaryRow(monthLabel(m.year, m.month), money.format(m.total))
      )
    );
    els.monthsEmpty.hidden = data.monthlyTotals.length > 0;

    els.projectsList.replaceChildren(
      ...data.projects.map((p) =>
        summaryRow(p.name, money.format(p.total), p.active ? null : 'inactive')
      )
    );
    els.projectsEmpty.hidden = data.projects.length > 0;
  }

  window.BonusReportView = {
    money,
    moneyCompact,
    monthLabel,
    summaryRow,
    elapsedFraction,
    create(els) {
      return {
        render(data) {
          renderDial(els, data);
          renderDialStatus(els, data.computed);
          renderProration(els, data);
          renderProgress(els, data);
          renderBreakdown(els, data);
        },
      };
    },
  };
})();
