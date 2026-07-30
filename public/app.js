(() => {
  const TOKEN_KEY = 'bc_token';

  const els = {
    viewAuth: document.getElementById('view-auth'),
    viewHome: document.getElementById('view-home'),
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
    employeeForm: document.getElementById('employee-form'),
    employeeName: document.getElementById('employee-name'),
    employeeList: document.getElementById('employee-list'),
    emptyState: document.getElementById('empty-state'),
    homeError: document.getElementById('home-error'),
  };

  let mode = 'login'; // 'login' | 'signup'

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
    els.viewHome.hidden = true;
    els.viewAuth.hidden = false;
    els.inputEmail.focus();
  }

  function showHome(user) {
    els.viewAuth.hidden = true;
    els.viewHome.hidden = false;
    els.userEmail.textContent = user.email;
    loadEmployees();
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

  // ---------- Employees & projects ----------

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
    title.textContent = employee.name;

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

    const name = document.createElement('span');
    name.className = 'project-name';
    name.textContent = project.name;

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

    row.append(name, remove);
    return row;
  }

  function addProjectForm(employee) {
    const form = document.createElement('form');
    form.className = 'add-project-form';
    form.noValidate = true;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 120;
    input.placeholder = 'New project (client) name';
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
      showHome(data.user);
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
      showHome(data.user);
    } catch (err) {
      if (err.status === 401) localStorage.removeItem(TOKEN_KEY);
      showAuth();
      if (err.status && err.status !== 401) showError(err.message);
    }
  }

  init();
})();
