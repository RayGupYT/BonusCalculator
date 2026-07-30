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
    employeeTotal: document.getElementById('employee-total'),
    employeeMonths: document.getElementById('employee-months'),
    employeeMonthsEmpty: document.getElementById('employee-months-empty'),
    employeeProjects: document.getElementById('employee-projects'),
    employeeProjectsEmpty: document.getElementById('employee-projects-empty'),
  };

  let mode = 'login'; // 'login' | 'signup'
  let currentProject = null; // { employeeId, projectId, revenue: [{year, month, amount}] }

  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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
    els.viewAuth.hidden = true;
    els.viewApp.hidden = false;
    els.userEmail.textContent = user.email;
    showEmployeesPage();
  }

  function showEmployeesPage() {
    currentProject = null;
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

  async function openEmployee(employeeId) {
    try {
      const data = await api(`/api/employees/${employeeId}/summary`);

      els.employeeTitle.textContent = data.employee.name;
      els.employeeTotal.textContent = money.format(data.totalRevenue);

      els.employeeMonths.replaceChildren(
        ...data.monthlyTotals.map((m) =>
          summaryRow(monthLabel(m.year, m.month), money.format(m.total))
        )
      );
      els.employeeMonthsEmpty.hidden = data.monthlyTotals.length > 0;

      els.employeeProjects.replaceChildren(
        ...data.projects.map((p) => summaryRow(p.name, money.format(p.total)))
      );
      els.employeeProjectsEmpty.hidden = data.projects.length > 0;

      els.employeeError.hidden = true;
      els.pageEmployees.hidden = true;
      els.pageProject.hidden = true;
      els.pageEmployee.hidden = false;
    } catch (err) {
      if (!handleSessionExpiry(err)) showHomeError(err.message);
    }
  }

  function summaryRow(label, value) {
    const row = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'summary-label';
    name.textContent = label;
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

    row.append(open, remove);
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

    const button = els.clientForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api(
        `/api/employees/${currentProject.employeeId}/projects/${currentProject.projectId}`,
        { method: 'PATCH', body: { clientName: els.clientName.value.trim() } }
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
    setMode('login');
    showAuth();
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
