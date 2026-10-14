// The public read-only report at /r/<token>. No authentication, no editing:
// it fetches one report payload and draws it with the shared renderer.
(() => {
  const { money, summaryRow } = window.BonusReportView;

  const els = {
    loading: document.getElementById('report-loading'),
    error: document.getElementById('report-error'),
    errorTitle: document.getElementById('report-error-title'),
    errorText: document.getElementById('report-error-text'),
    card: document.getElementById('report-card'),
    crumb: document.getElementById('report-crumb'),
    title: document.getElementById('report-title'),
    year: document.getElementById('report-year'),
    termsList: document.getElementById('report-terms-list'),
    foot: document.getElementById('report-foot'),
  };

  const view = window.BonusReportView.create({
    dial: document.getElementById('dial'),
    dialStatus: document.getElementById('dial-status'),
    prorationNote: document.getElementById('proration-note'),
    progressBar: document.getElementById('progress-bar'),
    progressFill: document.getElementById('progress-fill'),
    progressOver: document.getElementById('progress-over'),
    progressTickGoal: document.getElementById('progress-tick-goal'),
    progressTickPace: document.getElementById('progress-tick-pace'),
    progressEndLabel: document.getElementById('progress-end-label'),
    kpiGoal: document.getElementById('kpi-goal'),
    kpiCurrentLabel: document.getElementById('kpi-current-label'),
    kpiCurrent: document.getElementById('kpi-current'),
    kpiPace: document.getElementById('kpi-pace'),
    kpiPct: document.getElementById('kpi-pct'),
    monthsList: document.getElementById('report-months'),
    monthsEmpty: document.getElementById('report-months-empty'),
    projectsList: document.getElementById('report-projects'),
    projectsEmpty: document.getElementById('report-projects-empty'),
  });

  function showError(title, text) {
    els.loading.hidden = true;
    els.card.hidden = true;
    els.errorTitle.textContent = title;
    els.errorText.textContent = text;
    els.error.hidden = false;
  }

  function dateLabel(iso) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function timeLabel(iso) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function tokenFromPath() {
    const match = /^\/r\/([A-Za-z0-9_-]{43})\/?$/.exec(window.location.pathname);
    return match ? match[1] : null;
  }

  function renderTerms(report) {
    const settings = report.settings;
    const computed = report.computed;
    const rows = [
      summaryRow('Revenue scale', `${money.format(computed.effectiveMin)} – ${money.format(computed.effectiveMax)}`),
      summaryRow('Bonus starts at', money.format(computed.thresholdValue)),
      summaryRow('Bonus rate', `${settings.bonusRate}¢ per $1 above the threshold`),
      summaryRow(
        'Bonus so far',
        computed.bonusStarted ? money.format(computed.bonus) : 'Not started'
      ),
    ];
    if (settings.hireDate) {
      rows.push(summaryRow('Hire date', dateLabel(`${settings.hireDate}T00:00:00`)));
    }
    els.termsList.replaceChildren(...rows);
  }

  async function load() {
    const token = tokenFromPath();
    if (!token) {
      return showError(
        'This report link is not valid',
        'Check that you copied the whole link, including the part after /r/.'
      );
    }

    let res;
    try {
      res = await fetch(`/api/public/reports/${token}`);
    } catch {
      return showError(
        'Could not load the report',
        'Check your connection and reload the page.'
      );
    }

    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON response */
    }

    if (!res.ok) {
      const message = (data && data.error) || `Could not load the report (${res.status}).`;
      return showError(
        res.status === 410 ? 'This report link has expired' : 'This report is not available',
        message
      );
    }

    const report = data.report;
    document.title = `${report.employee.name} — ${report.year} bonus report`;

    els.title.textContent = report.employee.name;
    els.crumb.textContent = report.label || 'Bonus report';
    els.year.textContent = String(report.year);

    view.render({
      year: report.year,
      totalRevenue: report.totalRevenue,
      settings: report.settings,
      computed: report.computed,
      monthlyTotals: report.monthlyTotals,
      projects: report.projects,
    });
    renderTerms(report);

    const parts = [`Figures as of ${timeLabel(report.generatedAt)}`];
    if (report.sharedBy) parts.push(`shared by ${report.sharedBy}`);
    if (report.expiresAt) parts.push(`link expires ${dateLabel(report.expiresAt)}`);
    els.foot.textContent = `${parts.join(' · ')}.`;

    els.loading.hidden = true;
    els.error.hidden = true;
    els.card.hidden = false;
  }

  load();
})();
