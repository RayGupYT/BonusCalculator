(() => {
  const TOKEN_KEY = 'bc_token';

  const els = {
    viewAuth: document.getElementById('view-auth'),
    viewApp: document.getElementById('view-app'),
    tabLogin: document.getElementById('tab-login'),
    tabSignup: document.getElementById('tab-signup'),
    form: document.getElementById('auth-form'),
    fieldName: document.getElementById('field-name'),
    inputName: document.getElementById('input-name'),
    inputEmail: document.getElementById('input-email'),
    inputPassword: document.getElementById('input-password'),
    error: document.getElementById('auth-error'),
    submit: document.getElementById('auth-submit'),
    userEmail: document.getElementById('user-email'),
    logout: document.getElementById('btn-logout'),
    btnPassword: document.getElementById('btn-password'),
    pwDialog: document.getElementById('pw-dialog'),
    pwForm: document.getElementById('pw-form'),
    pwCurrent: document.getElementById('pw-current'),
    pwNew: document.getElementById('pw-new'),
    pwConfirm: document.getElementById('pw-confirm'),
    pwError: document.getElementById('pw-error'),
    pwSuccess: document.getElementById('pw-success'),
    pwCancel: document.getElementById('pw-cancel'),
    pageEmployees: document.getElementById('page-employees'),
    employeeForm: document.getElementById('employee-form'),
    employeeName: document.getElementById('employee-name'),
    employeeList: document.getElementById('employee-list'),
    emptyState: document.getElementById('empty-state'),
    homeError: document.getElementById('home-error'),
    pageProject: document.getElementById('page-project'),
    backBtn: document.getElementById('btn-back'),
    projectError: document.getElementById('project-error'),
    projectEmployee: document.getElementById('project-employee'),
    projectTitle: document.getElementById('project-title'),
    clientForm: document.getElementById('client-form'),
    clientName: document.getElementById('client-name'),
    projectMrr: document.getElementById('project-mrr'),
    projectActive: document.getElementById('project-active'),
    saveNote: document.getElementById('save-note'),
    addMonthBtn: document.getElementById('btn-add-month'),
    nextMonthBtn: document.getElementById('btn-next-month'),
    addMonthForm: document.getElementById('add-month-form'),
    monthPicker: document.getElementById('month-picker'),
    cancelMonthBtn: document.getElementById('btn-cancel-month'),
    monthGrid: document.getElementById('month-grid'),
    monthsEmpty: document.getElementById('months-empty'),
    pageEmployee: document.getElementById('page-employee'),
    backEmployeeBtn: document.getElementById('btn-back-employee'),
    employeeError: document.getElementById('employee-error'),
    employeeTitle: document.getElementById('employee-title'),
    yearSelect: document.getElementById('year-select'),
    dial: document.getElementById('dial'),
    dialStatus: document.getElementById('dial-status'),
    prorationNote: document.getElementById('proration-note'),
    dialForm: document.getElementById('dial-form'),
    dialMin: document.getElementById('dial-min'),
    dialMax: document.getElementById('dial-max'),
    dialPct: document.getElementById('dial-pct'),
    dialRate: document.getElementById('dial-rate'),
    dialHire: document.getElementById('dial-hire'),
    dialHint: document.getElementById('dial-hint'),
    dialSaveNote: document.getElementById('dial-save-note'),
    employeeMonths: document.getElementById('employee-months'),
    employeeMonthsEmpty: document.getElementById('employee-months-empty'),
    employeeProjects: document.getElementById('employee-projects'),
    employeeProjectsEmpty: document.getElementById('employee-projects-empty'),
  };

  let mode = 'login'; // 'login' | 'signup'
  let currentProject = null; // { employeeId, projectId, revenue: [{year, month, amount}] }
  let currentEmployeeId = null;
  let currentUser = null;

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

  // ---------- API helper ----------

  async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';

    let res;
    try {
      res = await fetch(path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('Network error — check your connection and try again.');
    }

    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON response */
    }

    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Prompt the browser's password manager (e.g. Google Passwords in Chrome)
  // to save the credentials. Safari/Firefox fall back to their own heuristics.
  function offerCredentialSave(email, password) {
    try {
      if (window.PasswordCredential && navigator.credentials) {
        const credential = new PasswordCredential({
          id: email,
          password,
          name: email,
        });
        navigator.credentials.store(credential).catch(() => {});
      }
    } catch {
      /* unsupported browser */
    }
  }

  // Expired/invalid session anywhere in the app → back to the login view.
  function handleSessionExpiry(err) {
    if (err.status !== 401) return false;
    localStorage.removeItem(TOKEN_KEY);
    setMode('login');
    showAuth();
    showError('Your session expired — please log in again.');
    return true;
  }

  // ---------- Views ----------

  function showAuth() {
    els.viewApp.hidden = true;
    els.viewAuth.hidden = false;
    els.inputEmail.focus();
  }

  function showApp(user) {
    currentUser = user;
    els.viewAuth.hidden = true;
    els.viewApp.hidden = false;
    els.userEmail.textContent = user.email;
    showEmployeesPage();
  }

  function showEmployeesPage() {
    currentProject = null;
    currentEmployeeId = null;
    els.pageProject.hidden = true;
    els.pageEmployee.hidden = true;
    els.pageEmployees.hidden = false;
    loadEmployees();
  }

  async function openProject(employeeId, projectId) {
    try {
      const data = await api(`/api/employees/${employeeId}/projects/${projectId}`);
      const project = data.project;

      currentProject = { employeeId, projectId, revenue: project.revenue };
      els.projectEmployee.textContent = `Under ${project.employee.name}`;
      els.projectTitle.textContent = project.name;
      els.clientName.value = project.clientName;
      els.projectMrr.value = project.monthlyRevenue ? String(project.monthlyRevenue) : '';
      els.projectActive.checked = project.active !== false;
      els.saveNote.hidden = true;
      els.projectError.hidden = true;
      els.addMonthForm.hidden = true;
      renderMonths();

      els.pageEmployees.hidden = true;
      els.pageEmployee.hidden = true;
      els.pageProject.hidden = false;
    } catch (err) {
      if (!handleSessionExpiry(err)) showHomeError(err.message);
    }
  }

  async function openEmployee(employeeId, year) {
    const alreadyOpen = !els.pageEmployee.hidden;
    try {
      const query = year ? `?year=${year}` : '';
      const data = await api(`/api/employees/${employeeId}/summary${query}`);

      currentEmployeeId = employeeId;
      renderEmployeeDash(data);

      els.employeeError.hidden = true;
      els.pageEmployees.hidden = true;
      els.pageProject.hidden = true;
      els.pageEmployee.hidden = false;
    } catch (err) {
      if (handleSessionExpiry(err)) return;
      if (alreadyOpen) showEmployeeError(err.message);
      else showHomeError(err.message);
    }
  }

  function renderEmployeeDash(data) {
    els.employeeTitle.textContent = data.employee.name;

    els.yearSelect.replaceChildren(
      ...data.availableYears.map((y) => {
        const option = document.createElement('option');
        option.value = String(y);
        option.textContent = String(y);
        option.selected = y === data.year;
        return option;
      })
    );

    renderDial(data);
    renderDialStatus(data.computed);
    renderProration(data);

    els.dialMin.value = String(data.settings.dialMin);
    els.dialMax.value = String(data.settings.dialMax);
    els.dialPct.value = String(data.settings.thresholdPct);
    els.dialRate.value = String(data.settings.bonusRate);
    els.dialHire.value = data.settings.hireDate || '';
    els.dialSaveNote.hidden = true;
    updateDialHint();

    els.employeeMonths.replaceChildren(
      ...data.monthlyTotals.map((m) =>
        summaryRow(monthLabel(m.year, m.month), money.format(m.total))
      )
    );
    els.employeeMonthsEmpty.hidden = data.monthlyTotals.length > 0;

    els.employeeProjects.replaceChildren(
      ...data.projects.map((p) =>
        summaryRow(p.name, money.format(p.total), p.active ? null : 'inactive')
      )
    );
    els.employeeProjectsEmpty.hidden = data.projects.length > 0;
  }

  function renderProration(data) {
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
    return [
      DIAL.cx + radius * Math.sin(rad),
      DIAL.cy - radius * Math.cos(rad),
    ];
  }

  function arcPath(a0, a1) {
    const [x0, y0] = dialPoint(a0);
    const [x1, y1] = dialPoint(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${DIAL.r} ${DIAL.r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  function renderDial(data) {
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

  function renderDialStatus(computed) {
    els.dialStatus.classList.toggle('is-bonus', computed.bonusStarted);
    if (computed.bonusStarted) {
      els.dialStatus.textContent = `Bonus value: ${money.format(computed.bonus)} — earning ${computed.bonusRatePct}¢ per $1 above ${moneyCompact.format(computed.thresholdValue)}`;
    } else {
      els.dialStatus.textContent = `Bonus starts at ${money.format(computed.thresholdValue)} — ${money.format(computed.remainingToBonus)} to go`;
    }
  }

  function readDialInputs() {
    const min = Number(els.dialMin.value);
    const max = Number(els.dialMax.value);
    const pct = Number(els.dialPct.value);
    const rate = Number(els.dialRate.value);
    if (
      els.dialMin.value.trim() === '' ||
      els.dialMax.value.trim() === '' ||
      els.dialPct.value.trim() === '' ||
      els.dialRate.value.trim() === '' ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      !Number.isFinite(pct) ||
      !Number.isFinite(rate)
    ) {
      return null;
    }
    if (min < 0 || max <= min || pct < 0 || pct > 100 || rate < 0 || rate > 100) {
      return null;
    }
    return { dialMin: min, dialMax: max, thresholdPct: pct, bonusRate: rate };
  }

  function updateDialHint() {
    const values = readDialInputs();
    if (!values) {
      els.dialHint.textContent =
        'Bonus starts at min + (max − min) × threshold%. Max must be greater than min.';
      return;
    }
    const threshold =
      values.dialMin + (values.dialMax - values.dialMin) * (values.thresholdPct / 100);
    const suffix = els.dialHire.value ? ' Min and max prorate for the hire year.' : '';
    els.dialHint.textContent = `Bonus will start at ${money.format(threshold)} and earn ${values.bonusRate}¢ per $1 above it.${suffix}`;
  }

  function showEmployeeError(message) {
    els.employeeError.textContent = message;
    els.employeeError.hidden = false;
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

  function setMode(next) {
    mode = next;
    const signup = mode === 'signup';
    els.tabLogin.setAttribute('aria-selected', String(!signup));
    els.tabSignup.setAttribute('aria-selected', String(signup));
    els.fieldName.hidden = !signup;
    els.inputName.required = signup;
    els.inputPassword.autocomplete = signup ? 'new-password' : 'current-password';
    els.submit.textContent = signup ? 'Create account' : 'Log in';
    hideError();
  }

  function showError(message) {
    els.error.textContent = message;
    els.error.hidden = false;
  }

  function hideError() {
    els.error.hidden = true;
  }

  function showHomeError(message) {
    els.homeError.textContent = message;
    els.homeError.hidden = false;
  }

  function hideHomeError() {
    els.homeError.hidden = true;
  }

  function showProjectError(message) {
    els.projectError.textContent = message;
    els.projectError.hidden = false;
  }

  // ---------- Employees list page ----------

  async function loadEmployees() {
    try {
      const data = await api('/api/employees');
      hideHomeError();
      renderEmployees(data.employees);
    } catch (err) {
      if (!handleSessionExpiry(err)) showHomeError(err.message);
    }
  }

  function renderEmployees(employees) {
    els.employeeList.replaceChildren(...employees.map(employeeCard));
    els.emptyState.hidden = employees.length > 0;
  }

  function employeeCard(employee) {
    const card = document.createElement('section');
    card.className = 'card employee-card';

    const head = document.createElement('div');
    head.className = 'employee-head';

    const title = document.createElement('h3');
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'employee-link';
    open.textContent = employee.name;
    open.setAttribute('aria-label', `Open dashboard for ${employee.name}`);
    open.addEventListener('click', () => openEmployee(employee.id));
    title.append(open);

    const remove = iconButton(`Delete employee ${employee.name}`, async () => {
      const label =
        employee.projects.length > 0
          ? `Delete ${employee.name} and their ${employee.projects.length} project(s)?`
          : `Delete ${employee.name}?`;
      if (!window.confirm(label)) return;
      try {
        await api(`/api/employees/${employee.id}`, { method: 'DELETE' });
        hideHomeError();
        loadEmployees();
      } catch (err) {
        if (!handleSessionExpiry(err)) showHomeError(err.message);
      }
    });

    head.append(title, remove);
    card.append(head);

    const list = document.createElement('ul');
    list.className = 'project-list';

    if (employee.projects.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-note';
      empty.textContent = 'No projects yet';
      list.append(empty);
    } else {
      for (const project of employee.projects) {
        list.append(projectRow(employee, project));
      }
    }
    card.append(list);

    card.append(addProjectForm(employee));
    return card;
  }

  function projectRow(employee, project) {
    const row = document.createElement('li');
    row.className = 'project-row';

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'project-link';
    open.textContent = project.name;
    open.setAttribute('aria-label', `Open project ${project.name}`);
    open.addEventListener('click', () => openProject(employee.id, project.id));

    const meta = document.createElement('span');
    meta.className = 'project-meta';
    const parts = [];
    if (project.monthlyRevenue > 0) parts.push(`${moneyCompact.format(project.monthlyRevenue)}/mo`);
    if (project.active === false) {
      parts.push('Inactive');
      row.classList.add('is-inactive');
    }
    meta.textContent = parts.join(' · ');

    const remove = iconButton(`Delete project ${project.name}`, async () => {
      if (!window.confirm(`Delete project ${project.name}?`)) return;
      try {
        await api(`/api/employees/${employee.id}/projects/${project.id}`, {
          method: 'DELETE',
        });
        hideHomeError();
        loadEmployees();
      } catch (err) {
        if (!handleSessionExpiry(err)) showHomeError(err.message);
      }
    });

    row.append(open, meta, remove);
    return row;
  }

  function addProjectForm(employee) {
    const form = document.createElement('form');
    form.className = 'add-project-form';
    form.noValidate = true;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 120;
    input.placeholder = 'New project name';
    input.setAttribute('aria-label', `New project for ${employee.name}`);

    const button = document.createElement('button');
    button.type = 'submit';
    button.className = 'btn btn-ghost btn-compact';
    button.textContent = 'Add project';

    form.append(input, button);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      button.disabled = true;
      try {
        await api(`/api/employees/${employee.id}/projects`, {
          method: 'POST',
          body: { name },
        });
        hideHomeError();
        await loadEmployees();
      } catch (err) {
        if (!handleSessionExpiry(err)) showHomeError(err.message);
      } finally {
        button.disabled = false;
      }
    });

    return form;
  }

  function iconButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-icon';
    button.textContent = '✕';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.addEventListener('click', onClick);
    return button;
  }

  els.employeeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = els.employeeName.value.trim();
    if (!name) return showHomeError('Please enter an employee name.');

    const button = els.employeeForm.querySelector('button');
    button.disabled = true;
    try {
      await api('/api/employees', { method: 'POST', body: { name } });
      els.employeeName.value = '';
      hideHomeError();
      await loadEmployees();
    } catch (err) {
      if (!handleSessionExpiry(err)) showHomeError(err.message);
    } finally {
      button.disabled = false;
    }
  });

  // ---------- Project dashboard: client name ----------

  els.backBtn.addEventListener('click', showEmployeesPage);
  els.backEmployeeBtn.addEventListener('click', showEmployeesPage);

  els.clientForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentProject) return;

    const mrrRaw = els.projectMrr.value.trim();
    const monthlyRevenue = mrrRaw === '' ? 0 : Number(mrrRaw);
    if (!Number.isFinite(monthlyRevenue) || monthlyRevenue < 0) {
      return showProjectError('Monthly recurring revenue must be 0 or more.');
    }

    const button = els.clientForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api(
        `/api/employees/${currentProject.employeeId}/projects/${currentProject.projectId}`,
        {
          method: 'PATCH',
          body: {
            clientName: els.clientName.value.trim(),
            monthlyRevenue,
            active: els.projectActive.checked,
          },
        }
      );
      els.projectError.hidden = true;
      els.saveNote.hidden = false;
    } catch (err) {
      if (!handleSessionExpiry(err)) showProjectError(err.message);
    } finally {
      button.disabled = false;
    }
  });

  els.clientName.addEventListener('input', () => {
    els.saveNote.hidden = true;
  });
  els.projectMrr.addEventListener('input', () => {
    els.saveNote.hidden = true;
  });
  els.projectActive.addEventListener('change', () => {
    els.saveNote.hidden = true;
  });

  // ---------- Employee dashboard: dial settings ----------

  for (const input of [els.dialMin, els.dialMax, els.dialPct, els.dialRate, els.dialHire]) {
    input.addEventListener('input', () => {
      els.dialSaveNote.hidden = true;
      updateDialHint();
    });
  }

  els.yearSelect.addEventListener('change', () => {
    if (currentEmployeeId) {
      openEmployee(currentEmployeeId, Number(els.yearSelect.value));
    }
  });

  els.dialForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentEmployeeId) return;

    const values = readDialInputs();
    if (!values) {
      return showEmployeeError(
        'Check the dial settings: min ≥ 0, max greater than min, threshold and rate between 0 and 100.'
      );
    }

    const button = els.dialForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api(`/api/employees/${currentEmployeeId}`, {
        method: 'PATCH',
        body: { ...values, hireDate: els.dialHire.value || null },
      });
      els.employeeError.hidden = true;
      await openEmployee(currentEmployeeId, Number(els.yearSelect.value));
      els.dialSaveNote.hidden = false;
    } catch (err) {
      if (!handleSessionExpiry(err)) showEmployeeError(err.message);
    } finally {
      button.disabled = false;
    }
  });

  // ---------- Project dashboard: monthly revenue ----------

  function revenueBase() {
    return `/api/employees/${currentProject.employeeId}/projects/${currentProject.projectId}/revenue`;
  }

  function renderMonths() {
    const entries = [...currentProject.revenue].sort(
      (a, b) => a.year - b.year || a.month - b.month
    );
    els.monthGrid.replaceChildren(...entries.map(monthBox));
    els.monthsEmpty.hidden = entries.length > 0;
  }

  function monthBox(entry) {
    const label = monthLabel(entry.year, entry.month);

    const box = document.createElement('div');
    box.className = 'month-box';

    const head = document.createElement('div');
    head.className = 'month-box-head';

    const title = document.createElement('span');
    title.className = 'month-label';
    title.textContent = label;

    const remove = iconButton(`Remove ${label}`, async () => {
      if (!window.confirm(`Remove ${label} and its value?`)) return;
      try {
        await api(`${revenueBase()}/${entry.year}/${entry.month}`, {
          method: 'DELETE',
        });
        currentProject.revenue = currentProject.revenue.filter(
          (r) => !(r.year === entry.year && r.month === entry.month)
        );
        els.projectError.hidden = true;
        renderMonths();
      } catch (err) {
        if (!handleSessionExpiry(err)) showProjectError(err.message);
      }
    });

    head.append(title, remove);

    const wrap = document.createElement('div');
    wrap.className = 'money-input';

    const currency = document.createElement('span');
    currency.textContent = '$';
    currency.setAttribute('aria-hidden', 'true');

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '0.01';
    input.placeholder = '0.00';
    input.value = entry.amount === 0 ? '' : String(entry.amount);
    input.setAttribute('aria-label', `Revenue for ${label} in dollars`);

    const note = document.createElement('span');
    note.className = 'box-note';
    note.textContent = 'Saved';
    note.hidden = true;

    async function save() {
      const raw = input.value.trim();
      const value = raw === '' ? 0 : Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        showProjectError(`Enter a valid amount for ${label} (0 or more).`);
        return;
      }
      if (value === entry.amount) return;
      try {
        const data = await api(`${revenueBase()}/${entry.year}/${entry.month}`, {
          method: 'PUT',
          body: { amount: value },
        });
        entry.amount = data.entry.amount;
        els.projectError.hidden = true;
        note.hidden = false;
      } catch (err) {
        if (!handleSessionExpiry(err)) showProjectError(err.message);
      }
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    });
    input.addEventListener('input', () => {
      note.hidden = true;
    });

    wrap.append(currency, input);
    box.append(head, wrap, note);
    return box;
  }

  async function createMonth(year, month) {
    try {
      const data = await api(revenueBase(), {
        method: 'POST',
        body: { year, month },
      });
      currentProject.revenue.push(data.entry);
      els.projectError.hidden = true;
      renderMonths();
      return true;
    } catch (err) {
      if (!handleSessionExpiry(err)) showProjectError(err.message);
      return false;
    }
  }

  els.nextMonthBtn.addEventListener('click', async () => {
    if (!currentProject) return;
    const entries = currentProject.revenue;

    let year;
    let month;
    if (entries.length === 0) {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    } else {
      const latest = entries.reduce((a, b) =>
        b.year * 12 + b.month > a.year * 12 + a.month ? b : a
      );
      year = latest.year;
      month = latest.month + 1;
      if (month === 13) {
        month = 1;
        year += 1;
      }
    }

    els.nextMonthBtn.disabled = true;
    await createMonth(year, month);
    els.nextMonthBtn.disabled = false;
  });

  els.addMonthBtn.addEventListener('click', () => {
    els.addMonthForm.hidden = !els.addMonthForm.hidden;
    if (!els.addMonthForm.hidden) {
      if (!els.monthPicker.value) {
        const now = new Date();
        els.monthPicker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
      els.monthPicker.focus();
    }
  });

  els.cancelMonthBtn.addEventListener('click', () => {
    els.addMonthForm.hidden = true;
  });

  els.addMonthForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(els.monthPicker.value.trim());
    if (!match) {
      return showProjectError('Pick a month and year (format: YYYY-MM).');
    }
    const ok = await createMonth(Number(match[1]), Number(match[2]));
    if (ok) els.addMonthForm.hidden = true;
  });

  // ---------- Auth events ----------

  els.tabLogin.addEventListener('click', () => setMode('login'));
  els.tabSignup.addEventListener('click', () => setMode('signup'));

  els.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();

    const email = els.inputEmail.value.trim();
    const password = els.inputPassword.value;
    const name = els.inputName.value.trim();

    if (mode === 'signup' && !name) return showError('Please enter your name.');
    if (!email) return showError('Please enter your email.');
    if (password.length < 8)
      return showError('Password must be at least 8 characters.');

    els.submit.disabled = true;
    try {
      const path = mode === 'signup' ? '/api/auth/register' : '/api/auth/login';
      const body =
        mode === 'signup' ? { name, email, password } : { email, password };
      const data = await api(path, { method: 'POST', body });

      offerCredentialSave(email, password);
      localStorage.setItem(TOKEN_KEY, data.token);
      els.form.reset();
      showApp(data.user);
    } catch (err) {
      showError(err.message);
    } finally {
      els.submit.disabled = false;
    }
  });

  els.logout.addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    currentUser = null;
    setMode('login');
    showAuth();
  });

  // ---------- Change password dialog ----------

  els.btnPassword.addEventListener('click', () => {
    els.pwForm.reset();
    els.pwError.hidden = true;
    els.pwSuccess.hidden = true;
    els.pwDialog.showModal();
    els.pwCurrent.focus();
  });

  els.pwCancel.addEventListener('click', () => {
    els.pwDialog.close();
  });

  els.pwForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    els.pwError.hidden = true;
    els.pwSuccess.hidden = true;

    const currentPassword = els.pwCurrent.value;
    const newPassword = els.pwNew.value;

    function showPwError(message) {
      els.pwError.textContent = message;
      els.pwError.hidden = false;
    }

    if (!currentPassword) return showPwError('Enter your current password.');
    if (newPassword.length < 8)
      return showPwError('New password must be at least 8 characters.');
    if (newPassword !== els.pwConfirm.value)
      return showPwError('New passwords do not match.');

    const button = els.pwForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      if (currentUser) offerCredentialSave(currentUser.email, newPassword);
      els.pwForm.reset();
      els.pwSuccess.hidden = false;
      setTimeout(() => els.pwDialog.close(), 1200);
    } catch (err) {
      if (handleSessionExpiry(err)) {
        els.pwDialog.close();
        return;
      }
      showPwError(err.message);
    } finally {
      button.disabled = false;
    }
  });

  // ---------- Init ----------

  async function init() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return showAuth();

    try {
      const data = await api('/api/auth/me');
      showApp(data.user);
    } catch (err) {
      if (err.status === 401) localStorage.removeItem(TOKEN_KEY);
      showAuth();
      if (err.status && err.status !== 401) showError(err.message);
    }
  }

  init();
})();
