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
    btnImport: document.getElementById('btn-import'),
    importDialog: document.getElementById('import-dialog'),
    importForm: document.getElementById('import-form'),
    importFile: document.getElementById('import-file'),
    importPaste: document.getElementById('import-paste'),
    importConflict: document.getElementById('import-conflict'),
    importPartial: document.getElementById('import-partial'),
    importPartialRow: document.getElementById('import-partial-row'),
    importTemplate: document.getElementById('import-template'),
    importError: document.getElementById('import-error'),
    importSuccess: document.getElementById('import-success'),
    importReport: document.getElementById('import-report'),
    importStats: document.getElementById('import-stats'),
    importTree: document.getElementById('import-tree'),
    importIssues: document.getElementById('import-issues'),
    importPreview: document.getElementById('import-preview'),
    importCommit: document.getElementById('import-commit'),
    importCancel: document.getElementById('import-cancel'),
    employeeForm: document.getElementById('employee-form'),
    employeeName: document.getElementById('employee-name'),
    employeeList: document.getElementById('employee-list'),
    overviewCard: document.getElementById('overview-card'),
    overviewYear: document.getElementById('overview-year'),
    overviewCount: document.getElementById('overview-count'),
    overviewRevenueLabel: document.getElementById('overview-revenue-label'),
    overviewRevenue: document.getElementById('overview-revenue'),
    overviewBonus: document.getElementById('overview-bonus'),
    overviewInBonus: document.getElementById('overview-inbonus'),
    overviewRows: document.getElementById('overview-rows'),
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
    dialForm: document.getElementById('dial-form'),
    dialMin: document.getElementById('dial-min'),
    dialMax: document.getElementById('dial-max'),
    dialPct: document.getElementById('dial-pct'),
    dialRate: document.getElementById('dial-rate'),
    dialHire: document.getElementById('dial-hire'),
    dialHint: document.getElementById('dial-hint'),
    dialSaveNote: document.getElementById('dial-save-note'),
    btnShare: document.getElementById('btn-share'),
    shareDialog: document.getElementById('share-dialog'),
    shareForm: document.getElementById('share-form'),
    shareWho: document.getElementById('share-who'),
    shareYear: document.getElementById('share-year'),
    shareExpiry: document.getElementById('share-expiry'),
    shareLabel: document.getElementById('share-label'),
    shareError: document.getElementById('share-error'),
    shareNote: document.getElementById('share-note'),
    shareCreate: document.getElementById('share-create'),
    shareList: document.getElementById('share-list'),
    shareEmpty: document.getElementById('share-empty'),
    shareClose: document.getElementById('share-close'),
    employeeMonths: document.getElementById('employee-months'),
    employeeMonthsEmpty: document.getElementById('employee-months-empty'),
    employeeProjects: document.getElementById('employee-projects'),
    employeeProjectsEmpty: document.getElementById('employee-projects-empty'),
  };

  let mode = 'login'; // 'login' | 'signup'
  let currentProject = null; // { employeeId, projectId, revenue: [{year, month, amount}] }
  let currentEmployeeId = null;
  let currentEmployeeSummary = null; // last summary rendered, for the share dialog
  let currentUser = null;

  const { money, moneyCompact, monthLabel } = window.BonusReportView;

  // The dial, pacing bar and breakdown lists are drawn by the same code that
  // renders a shared read-only report.
  const employeeReport = window.BonusReportView.create({
    dial: els.dial,
    dialStatus: els.dialStatus,
    prorationNote: els.prorationNote,
    progressBar: els.progressBar,
    progressFill: els.progressFill,
    progressOver: els.progressOver,
    progressTickGoal: els.progressTickGoal,
    progressTickPace: els.progressTickPace,
    progressEndLabel: els.progressEndLabel,
    kpiGoal: els.kpiGoal,
    kpiCurrentLabel: els.kpiCurrentLabel,
    kpiCurrent: els.kpiCurrent,
    kpiPace: els.kpiPace,
    kpiPct: els.kpiPct,
    monthsList: els.employeeMonths,
    monthsEmpty: els.employeeMonthsEmpty,
    projectsList: els.employeeProjects,
    projectsEmpty: els.employeeProjectsEmpty,
  });

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
    currentEmployeeSummary = data;
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

    employeeReport.render(data);

    els.dialMin.value = String(data.settings.dialMin);
    els.dialMax.value = String(data.settings.dialMax);
    els.dialPct.value = String(data.settings.thresholdPct);
    els.dialRate.value = String(data.settings.bonusRate);
    els.dialHire.value = data.settings.hireDate || '';
    els.dialSaveNote.hidden = true;
    updateDialHint();
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
      loadOverview();
    } catch (err) {
      if (!handleSessionExpiry(err)) showHomeError(err.message);
    }
  }

  function renderEmployees(employees) {
    els.employeeList.replaceChildren(...employees.map(employeeCard));
    els.emptyState.hidden = employees.length > 0;
  }

  // ---------- Home overview: everyone's headline numbers in one table ----------

  let overviewYear = null; // sticks across reloads of the employees page

  function paceCell(row, year) {
    const cell = document.createElement('td');
    if (row.goal <= 0) {
      cell.textContent = '—';
      return cell;
    }
    const elapsed = window.BonusReportView.elapsedFraction({
      year,
      settings: { hireDate: row.hireDate },
    });
    const delta = row.totalRevenue - row.goal * elapsed;
    if (elapsed === 0) {
      cell.textContent = `Starts in ${year}`;
    } else if (elapsed === 1) {
      cell.textContent = row.bonusStarted
        ? 'Goal met'
        : `${moneyCompact.format(row.remainingToBonus)} short`;
      cell.className = row.bonusStarted ? 'is-good' : 'is-bad';
    } else if (Math.abs(delta) < 0.5) {
      cell.textContent = 'On pace';
    } else if (delta > 0) {
      cell.textContent = `${moneyCompact.format(delta)} ahead`;
      cell.className = 'is-good';
    } else {
      cell.textContent = `${moneyCompact.format(-delta)} behind`;
      cell.className = 'is-bad';
    }
    return cell;
  }

  function overviewRow(row, year) {
    const tr = document.createElement('tr');

    const nameCell = document.createElement('td');
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'employee-link';
    open.textContent = row.name;
    open.setAttribute('aria-label', `Open dashboard for ${row.name}`);
    open.addEventListener('click', () => openEmployee(row.id, year));
    nameCell.append(open);

    const projects = document.createElement('td');
    projects.className = 'num';
    projects.textContent =
      row.projectCount === row.activeCount
        ? String(row.projectCount)
        : `${row.activeCount} of ${row.projectCount}`;

    const revenue = document.createElement('td');
    revenue.className = 'num';
    revenue.textContent = money.format(row.totalRevenue);

    const goal = document.createElement('td');
    goal.className = 'num';
    goal.textContent = row.goal > 0 ? money.format(row.goal) : '—';

    const pct = document.createElement('td');
    pct.className = 'num';
    pct.textContent =
      row.goal > 0 ? `${Math.round((row.totalRevenue / row.goal) * 100)}%` : '—';

    const bonus = document.createElement('td');
    bonus.className = row.bonusStarted ? 'num is-good' : 'num';
    bonus.textContent = row.bonusStarted ? money.format(row.bonus) : '—';

    tr.append(nameCell, projects, revenue, goal, pct, paceCell(row, year), bonus);
    return tr;
  }

  function renderOverview(data) {
    els.overviewYear.replaceChildren(
      ...data.availableYears.map((year) => {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        option.selected = year === data.year;
        return option;
      })
    );

    els.overviewCount.textContent = String(data.totals.employees);
    els.overviewRevenueLabel.textContent = `${data.year} revenue`;
    els.overviewRevenue.textContent = money.format(data.totals.revenue);
    els.overviewBonus.textContent = money.format(data.totals.bonus);
    const inBonus = data.employees.filter((row) => row.bonusStarted).length;
    els.overviewInBonus.textContent = `${inBonus} of ${data.totals.employees}`;

    els.overviewRows.replaceChildren(
      ...data.employees.map((row) => overviewRow(row, data.year))
    );
    els.overviewCard.hidden = data.employees.length === 0;
  }

  async function loadOverview() {
    try {
      const query = overviewYear ? `?year=${overviewYear}` : '';
      const data = await api(`/api/employees/overview${query}`);
      overviewYear = data.year;
      renderOverview(data);
    } catch (err) {
      if (!handleSessionExpiry(err)) showHomeError(err.message);
    }
  }

  els.overviewYear.addEventListener('change', () => {
    overviewYear = Number(els.overviewYear.value);
    loadOverview();
  });

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

  // ---------- Share read-only reports ----------

  function showShareError(message) {
    els.shareError.textContent = message;
    els.shareError.hidden = false;
  }

  function shareDateLabel(iso) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function fullShareUrl(share) {
    return `${window.location.origin}${share.url}`;
  }

  function shareRow(share) {
    const row = document.createElement('div');
    row.className = share.expired ? 'share-row is-expired' : 'share-row';

    const head = document.createElement('div');
    head.className = 'share-row-head';

    const title = document.createElement('span');
    title.className = 'share-row-title';
    title.textContent = share.label || `${share.year} report`;
    if (share.label) {
      const year = document.createElement('span');
      year.className = 'share-row-year';
      year.textContent = String(share.year);
      title.append(year);
    }

    const revoke = document.createElement('button');
    revoke.type = 'button';
    revoke.className = 'btn-icon';
    revoke.textContent = '✕';
    revoke.title = 'Revoke this link';
    revoke.setAttribute('aria-label', `Revoke the link for ${share.label || share.year}`);
    revoke.addEventListener('click', async () => {
      if (!window.confirm('Revoke this link? Anyone holding it will lose access.')) return;
      revoke.disabled = true;
      try {
        await api(`/api/shares/${share.id}`, { method: 'DELETE' });
        els.shareError.hidden = true;
        els.shareNote.textContent = 'Link revoked.';
        els.shareNote.hidden = false;
        await loadShares();
      } catch (err) {
        if (!handleSessionExpiry(err)) showShareError(err.message);
        revoke.disabled = false;
      }
    });

    head.append(title, revoke);

    const urlRow = document.createElement('div');
    urlRow.className = 'share-url-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = fullShareUrl(share);
    input.setAttribute('aria-label', 'Report link');
    input.addEventListener('focus', () => input.select());

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn btn-ghost btn-compact';
    copy.textContent = 'Copy';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(input.value);
        copy.textContent = 'Copied';
        setTimeout(() => {
          copy.textContent = 'Copy';
        }, 1400);
      } catch {
        // Clipboard access can be refused; selecting the text is the fallback.
        input.focus();
        input.select();
        copy.textContent = 'Press Ctrl+C';
        setTimeout(() => {
          copy.textContent = 'Copy';
        }, 2200);
      }
    });

    urlRow.append(input, copy);

    const meta = document.createElement('p');
    meta.className = 'share-row-meta';
    const parts = [`Created ${shareDateLabel(share.createdAt)}`];
    if (share.expired) parts.push('expired');
    else if (share.expiresAt) parts.push(`expires ${shareDateLabel(share.expiresAt)}`);
    else parts.push('no expiry');
    parts.push(
      share.viewCount === 0
        ? 'not opened yet'
        : `${share.viewCount} view${share.viewCount === 1 ? '' : 's'}, last ${shareDateLabel(share.lastViewedAt)}`
    );
    meta.textContent = parts.join(' · ');

    row.append(head, urlRow, meta);
    return row;
  }

  async function loadShares() {
    if (!currentEmployeeId) return;
    try {
      const data = await api(`/api/shares?employeeId=${currentEmployeeId}`);
      els.shareList.replaceChildren(...data.shares.map(shareRow));
      els.shareEmpty.hidden = data.shares.length > 0;
    } catch (err) {
      if (!handleSessionExpiry(err)) showShareError(err.message);
    }
  }

  els.btnShare.addEventListener('click', () => {
    if (!currentEmployeeId || !currentEmployeeSummary) return;

    els.shareForm.reset();
    els.shareError.hidden = true;
    els.shareNote.hidden = true;
    els.shareWho.textContent = currentEmployeeSummary.employee.name;

    // Offer the same years the dashboard offers, defaulting to the one on screen.
    els.shareYear.replaceChildren(
      ...currentEmployeeSummary.availableYears.map((year) => {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        option.selected = year === currentEmployeeSummary.year;
        return option;
      })
    );

    els.shareList.replaceChildren();
    els.shareEmpty.hidden = true;
    els.shareDialog.showModal();
    loadShares();
  });

  els.shareClose.addEventListener('click', () => {
    els.shareDialog.close();
  });

  els.shareForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentEmployeeId) return;

    els.shareError.hidden = true;
    els.shareNote.hidden = true;
    els.shareCreate.disabled = true;
    try {
      const expiresInDays = Number(els.shareExpiry.value);
      await api('/api/shares', {
        method: 'POST',
        body: {
          employeeId: currentEmployeeId,
          year: Number(els.shareYear.value),
          label: els.shareLabel.value.trim(),
          expiresInDays: expiresInDays === 0 ? null : expiresInDays,
        },
      });
      els.shareLabel.value = '';
      els.shareNote.textContent = 'Link created — copy it below.';
      els.shareNote.hidden = false;
      await loadShares();
    } catch (err) {
      if (!handleSessionExpiry(err)) showShareError(err.message);
    } finally {
      els.shareCreate.disabled = false;
    }
  });

  // ---------- CSV import ----------

  const IMPORT_MAX_BYTES = 4 * 1024 * 1024;

  const IMPORT_TEMPLATE = [
    'Employee,Project,Client,Year,Month,Amount,MRR,Active,Min,Max,Threshold,Bonus Rate,Hire Date',
    'Alex Johnson,Acme Website,Acme Corporation,2026,Jan,12500,12500,yes,1000000,2000000,67,1.5,',
    'Alex Johnson,Acme Website,Acme Corporation,2026,Feb,12500,12500,yes,,,,,',
    'Alex Johnson,Bluebird App,Bluebird Ltd,2026,Jan,8000,8000,yes,,,,,',
    'Dana Smith,Northwind Retainer,Northwind Inc,2026,Jan,15000,15000,yes,800000,1600000,70,2,2026-04-01',
    'Dana Smith,Northwind Retainer,Northwind Inc,2026,Feb,15000,15000,yes,,,,,',
  ].join('\r\n');

  // The CSV goes up as a raw text/csv body, so it needs no JSON escaping and
  // is not held to the small JSON body limit.
  async function postCsv(csv, { dryRun, onConflict, allowPartial }) {
    const params = new URLSearchParams({ onConflict });
    if (dryRun) params.set('dryRun', '1');
    if (allowPartial) params.set('allowPartial', '1');

    const headers = { 'Content-Type': 'text/csv' };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(`/api/import/csv?${params}`, { method: 'POST', headers, body: csv });
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
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.report = data;
      throw err;
    }
    return data;
  }

  async function readCsvInput() {
    const file = els.importFile.files && els.importFile.files[0];
    if (file) {
      if (file.size > IMPORT_MAX_BYTES) {
        throw new Error('That file is larger than 4 MB — split it into smaller files.');
      }
      return file.text();
    }
    if (els.importPaste.value.trim() !== '') return els.importPaste.value;
    throw new Error('Choose a CSV file or paste some rows first.');
  }

  function showImportError(message) {
    els.importError.textContent = message;
    els.importError.hidden = false;
  }

  function resetImportReport() {
    els.importError.hidden = true;
    els.importSuccess.hidden = true;
    els.importReport.hidden = true;
    els.importStats.replaceChildren();
    els.importTree.replaceChildren();
    els.importIssues.replaceChildren();
    els.importCommit.disabled = true;
  }

  function statTile(label, value) {
    const tile = document.createElement('div');
    tile.className = 'import-stat';
    const labelEl = document.createElement('span');
    labelEl.className = 'import-stat-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'import-stat-value';
    valueEl.textContent = value;
    tile.append(labelEl, valueEl);
    return tile;
  }

  function importTag(text, existing) {
    const tag = document.createElement('span');
    tag.className = existing ? 'import-tag is-existing' : 'import-tag';
    tag.textContent = text;
    return tag;
  }

  function issueList(title, items, isError) {
    const fragment = document.createDocumentFragment();
    const head = document.createElement('p');
    head.className = isError ? 'import-issues-head is-error-head' : 'import-issues-head';
    head.textContent = title;
    const list = document.createElement('ul');
    for (const item of items) {
      const li = document.createElement('li');
      if (isError) li.className = 'is-error';
      li.textContent = item;
      list.append(li);
    }
    fragment.append(head, list);
    return fragment;
  }

  function changeCount(summary) {
    return (
      summary.employeesCreated +
      summary.projectsCreated +
      summary.projectsUpdated +
      summary.settingsChanged +
      summary.monthsCreated +
      summary.monthsUpdated
    );
  }

  function renderImportReport(report) {
    const summary = report.summary;

    els.importStats.replaceChildren(
      statTile('Rows read', String(summary.rows)),
      statTile('New employees', String(summary.employeesCreated)),
      statTile('New projects', String(summary.projectsCreated)),
      statTile('Months added', String(summary.monthsCreated)),
      statTile('Months changed', String(summary.monthsUpdated)),
      statTile('Revenue', money.format(summary.revenueTotal))
    );

    // One line for the things that are matched rather than created.
    const notes = [];
    if (summary.employeesMatched > 0) notes.push(`${summary.employeesMatched} existing employee(s) matched`);
    if (summary.projectsMatched > 0) notes.push(`${summary.projectsMatched} existing project(s) matched`);
    if (summary.settingsChanged > 0) notes.push(`${summary.settingsChanged} dial setting(s) updated`);
    if (summary.monthsUnchanged > 0) notes.push(`${summary.monthsUnchanged} month(s) already identical`);
    if (summary.monthsSkipped > 0) notes.push(`${summary.monthsSkipped} month(s) left as they are`);

    els.importTree.replaceChildren();
    if (notes.length > 0) {
      const note = document.createElement('p');
      note.className = 'import-intro';
      note.textContent = `${notes.join(' · ')}.`;
      els.importTree.append(note);
    }

    for (const employee of report.employees) {
      const block = document.createElement('div');
      block.className = 'import-tree-employee';

      const name = document.createElement('div');
      name.className = 'import-tree-name';
      name.textContent = employee.name;
      name.append(importTag(employee.created ? 'new' : 'existing', !employee.created));
      if (employee.settingsChanged.length > 0) {
        name.append(importTag('dial', true));
      }
      block.append(name);

      const list = document.createElement('ul');
      list.className = 'import-tree-projects';
      for (const project of employee.projects) {
        const row = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = project.name;
        if (project.created) label.append(importTag('new', false));

        const parts = [];
        if (project.monthsCreated > 0) parts.push(`+${project.monthsCreated} month(s)`);
        if (project.monthsUpdated > 0) parts.push(`${project.monthsUpdated} changed`);
        if (project.monthsSkipped > 0) parts.push(`${project.monthsSkipped} kept`);
        if (project.monthsUnchanged > 0 && parts.length === 0) parts.push('no change');
        if (project.attrChanges.length > 0) parts.push(project.attrChanges.join(', '));

        const detail = document.createElement('span');
        detail.textContent = parts.join(' · ') || '—';
        row.append(label, detail);
        list.append(row);
      }
      block.append(list);
      els.importTree.append(block);
    }

    els.importIssues.replaceChildren();
    if (report.errorCount > 0) {
      const messages = report.errors.map((e) =>
        e.line > 0 ? `Line ${e.line}: ${e.message}` : e.message
      );
      if (report.errorCount > report.errors.length) {
        messages.push(`…and ${report.errorCount - report.errors.length} more.`);
      }
      els.importIssues.append(
        issueList(`${report.errorCount} row problem(s)`, messages, true)
      );
    }
    if (report.warningCount > 0) {
      const messages = [...report.warnings];
      if (report.warningCount > report.warnings.length) {
        messages.push(`…and ${report.warningCount - report.warnings.length} more.`);
      }
      els.importIssues.append(issueList(`${report.warningCount} note(s)`, messages, false));
    }

    els.importPartialRow.hidden = report.errorCount === 0;
    if (report.errorCount === 0) els.importPartial.checked = false;

    els.importReport.hidden = false;

    const changes = changeCount(summary);
    els.importCommit.disabled = !report.canImport || changes === 0;
    if (changes === 0 && report.errorCount === 0) {
      showImportError('Nothing to import — the file matches what is already stored.');
    } else if (!report.canImport) {
      showImportError(
        'Some rows could not be read. Fix them, or tick the box above to import the rest.'
      );
    }
  }

  async function runImport(dryRun) {
    resetImportReport();

    let csv;
    try {
      csv = await readCsvInput();
    } catch (err) {
      return showImportError(err.message);
    }

    const options = {
      dryRun,
      onConflict: els.importConflict.value === 'skip' ? 'skip' : 'overwrite',
      allowPartial: els.importPartial.checked,
    };

    els.importPreview.disabled = true;
    els.importCommit.disabled = true;
    try {
      const report = await postCsv(csv, options);
      renderImportReport(report);

      if (report.imported) {
        const summary = report.summary;
        els.importSuccess.textContent = `Imported — ${summary.employeesCreated} new employee(s), ${summary.projectsCreated} new project(s), ${summary.monthsCreated + summary.monthsUpdated} month value(s).`;
        els.importSuccess.hidden = false;
        els.importError.hidden = true;
        els.importCommit.disabled = true;
        await loadEmployees();
      }
    } catch (err) {
      if (handleSessionExpiry(err)) {
        els.importDialog.close();
        return;
      }
      // A rejected import still carries the full report, so show it.
      if (err.report && err.report.summary) renderImportReport(err.report);
      else if (err.report && Array.isArray(err.report.errors)) {
        els.importIssues.replaceChildren(
          issueList(
            `${err.report.errors.length} problem(s)`,
            err.report.errors.map((e) => (e.line > 0 ? `Line ${e.line}: ${e.message}` : e.message)),
            true
          )
        );
        els.importReport.hidden = false;
      }
      showImportError(err.message);
    } finally {
      els.importPreview.disabled = false;
    }
  }

  els.btnImport.addEventListener('click', () => {
    els.importForm.reset();
    els.importPartialRow.hidden = true;
    resetImportReport();
    els.importDialog.showModal();
    els.importFile.focus();
  });

  els.importCancel.addEventListener('click', () => {
    els.importDialog.close();
  });

  // Picking a file is the clearest moment to show what the import would do.
  els.importFile.addEventListener('change', () => {
    if (els.importFile.files && els.importFile.files.length > 0) runImport(true);
  });

  els.importPaste.addEventListener('input', resetImportReport);
  els.importConflict.addEventListener('change', resetImportReport);
  els.importPartial.addEventListener('change', () => {
    els.importError.hidden = true;
    runImport(true);
  });

  els.importPreview.addEventListener('click', () => runImport(true));

  els.importForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runImport(false);
  });

  els.importTemplate.addEventListener('click', () => {
    const blob = new Blob([IMPORT_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bonus-calculator-template.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
