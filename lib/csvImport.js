// Parses a CSV export into the Employee -> Project -> monthly-revenue shape the
// app stores. Pure functions only: no database access, so the route can reuse
// the same plan for both the dry-run preview and the real import.

const LIMITS = {
  records: 20000,
  employees: 500,
  projects: 3000,
  monthEntries: 60000,
  reportedErrors: 50,
};

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

// Columns a spreadsheet usually carries that this importer has no home for.
// Recognised by name so they can be reported as ignored rather than guessed at.
const IGNORED_HEADERS = new Set([
  'total',
  'totals',
  'sum',
  'ytd',
  'ytdtotal',
  'grandtotal',
  'notes',
  'note',
  'comment',
  'comments',
  'id',
]);

const FIELD_ALIASES = {
  employee: [
    'employee',
    'employeename',
    'employeefullname',
    'staff',
    'staffmember',
    'teammember',
    'person',
    'rep',
    'salesrep',
    'salesperson',
    'accountmanager',
    'owner',
  ],
  project: ['project', 'projectname', 'projecttitle', 'job', 'jobname', 'engagement'],
  clientName: [
    'client',
    'clientname',
    'clientcompany',
    'company',
    'customer',
    'customername',
    'account',
    'accountname',
  ],
  year: ['year', 'yr'],
  month: ['month', 'mo'],
  period: ['period', 'monthyear', 'date'],
  amount: ['amount', 'revenue', 'money', 'value', 'sales', 'rev'],
  monthlyRevenue: [
    'monthlyrevenue',
    'mrr',
    'monthlyrecurringrevenue',
    'recurring',
    'recurringrevenue',
  ],
  active: ['active', 'isactive', 'status'],
  dialMin: ['dialmin', 'min', 'minvalue', 'goalmin', 'mingoal'],
  dialMax: ['dialmax', 'max', 'maxvalue', 'goalmax', 'maxgoal'],
  thresholdPct: ['thresholdpct', 'threshold', 'thresholdpercent', 'bonusthreshold'],
  bonusRate: ['bonusrate', 'rate', 'bonuspct', 'bonuspercent'],
  hireDate: ['hiredate', 'hired', 'startdate', 'datehired'],
};

function normalizeHeader(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Collapses internal whitespace so "Acme  Corp" and "Acme Corp" are one entity.
function displayName(value) {
  return String(value).trim().replace(/\s+/g, ' ');
}

function matchKey(value) {
  return displayName(value).toLowerCase();
}

// ---------- CSV text -> records ----------

function detectDelimiter(text) {
  const firstLine = text.split('\n', 1)[0] || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (Object.prototype.hasOwnProperty.call(counts, ch) && !inQuotes) counts[ch] += 1;
  }
  let best = ',';
  for (const ch of Object.keys(counts)) {
    if (counts[ch] > counts[best]) best = ch;
  }
  return counts[best] > 0 ? best : ',';
}

// RFC 4180: double quotes escape quotes, quoted fields may span lines. Each
// record keeps the 1-based line it started on so errors can point at it.
function parseCsvText(text, delimiter) {
  const records = [];
  let field = '';
  let cells = [];
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let quotedCell = false;

  const pushRecord = () => {
    cells.push(field);
    records.push({ line: recordLine, cells });
    cells = [];
    field = '';
    quotedCell = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line += 1;
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field.trim() === '') {
      inQuotes = true;
      quotedCell = true;
      field = '';
      continue;
    }
    if (ch === delimiter) {
      cells.push(field);
      field = '';
      quotedCell = false;
      continue;
    }
    if (ch === '\r') continue;
    if (ch === '\n') {
      pushRecord();
      line += 1;
      recordLine = line;
      continue;
    }
    field += ch;
  }

  if (field !== '' || cells.length > 0 || quotedCell) pushRecord();

  return { records, unterminatedQuote: inQuotes };
}

// ---------- Value parsers ----------

function monthIndexFromName(token) {
  const lower = token.toLowerCase();
  if (lower === 'sept') return 9;
  const index = MONTH_NAMES.findIndex((name) => name.startsWith(lower));
  if (index === -1 || lower.length < 3) return null;
  return index + 1;
}

function expandYear(raw) {
  const year = Number(raw);
  if (!Number.isInteger(year)) return null;
  return String(raw).trim().length <= 2 ? 2000 + year : year;
}

function validYearMonth(year, month) {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    year >= 2000 &&
    year <= 2100 &&
    month >= 1 &&
    month <= 12
  );
}

// Accepts "2026-01", "Jan 2026", "January-26", "01/2026" and bare "Jan"/"1"
// (bare forms return { month, year: null } and need a Year column to resolve).
function parseMonthToken(raw) {
  const token = String(raw).trim();
  if (token === '') return null;

  let match = /^(\d{4})\s*[-/\s]\s*(\d{1,2})$/.exec(token);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    return validYearMonth(year, month) ? { year, month } : null;
  }

  match = /^(\d{1,2})\s*[-/\s]\s*(\d{2}|\d{4})$/.exec(token);
  if (match) {
    const month = Number(match[1]);
    const year = expandYear(match[2]);
    return validYearMonth(year, month) ? { year, month } : null;
  }

  match = /^([A-Za-z]{3,9})\.?\s*[-/\s]?\s*(\d{2}|\d{4})$/.exec(token);
  if (match) {
    const month = monthIndexFromName(match[1]);
    const year = expandYear(match[2]);
    return month && validYearMonth(year, month) ? { year, month } : null;
  }

  match = /^([A-Za-z]{3,9})\.?$/.exec(token);
  if (match) {
    const month = monthIndexFromName(match[1]);
    return month ? { year: null, month } : null;
  }

  match = /^(\d{1,2})$/.exec(token);
  if (match) {
    const month = Number(match[1]);
    return month >= 1 && month <= 12 ? { year: null, month } : null;
  }

  return null;
}

// Money as spreadsheets write it: "$1,234.56", "1 234.56", "(500)" for negative.
function parseAmount(raw) {
  const original = String(raw).trim();
  if (original === '' || original === '-' || original === '—') {
    return { blank: true };
  }

  let text = original;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.trim().endsWith('%')) {
    return { error: `"${original}" looks like a percentage, not an amount` };
  }
  text = text.replace(/[$£€¥]/g, '').replace(/[\s,_]/g, '');
  if (text.startsWith('-')) {
    negative = true;
    text = text.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return { error: `"${original}" is not a number` };
  }

  const value = Number(text);
  if (!Number.isFinite(value)) return { error: `"${original}" is not a number` };
  if (negative && value !== 0) {
    return { error: `"${original}" is negative — revenue must be 0 or more` };
  }
  if (value > 1e12) return { error: `"${original}" is too large` };
  return { value: Math.round(value * 100) / 100 };
}

function parseNumber(raw) {
  return parseAmount(raw);
}

function parseBoolean(raw) {
  const text = String(raw).trim().toLowerCase();
  if (text === '') return { blank: true };
  if (['true', 'yes', 'y', '1', 'active'].includes(text)) return { value: true };
  if (['false', 'no', 'n', '0', 'inactive'].includes(text)) return { value: false };
  return { error: `"${raw}" is not yes/no` };
}

function parseDate(raw) {
  const text = String(raw).trim();
  if (text === '') return { blank: true };

  let year;
  let month;
  let day;

  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text);
    if (!match) return { error: `"${raw}" is not a date (use YYYY-MM-DD)` };
    month = Number(match[1]);
    day = Number(match[2]);
    year = expandYear(match[3]);
  }

  if (year < 1950 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return { error: `"${raw}" is out of range` };
  }
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCDate() !== day) {
    return { error: `"${raw}" is not a real date` };
  }
  return { value: iso };
}

// ---------- Header analysis ----------

function analyzeHeader(cells) {
  const fields = {}; // field name -> column index
  const monthColumns = []; // { index, year, month, label }
  const ignored = [];
  const unknown = [];
  const duplicates = [];

  const aliasToField = new Map();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) aliasToField.set(alias, field);
  }

  cells.forEach((cell, index) => {
    const label = displayName(cell);
    if (label === '') return;
    const key = normalizeHeader(label);

    const field = aliasToField.get(key);
    if (field) {
      if (fields[field] !== undefined) duplicates.push(label);
      else fields[field] = index;
      return;
    }
    if (IGNORED_HEADERS.has(key)) {
      ignored.push(label);
      return;
    }
    const period = parseMonthToken(label);
    if (period) {
      monthColumns.push({ index, year: period.year, month: period.month, label });
      return;
    }
    unknown.push(label);
  });

  return { fields, monthColumns, ignored, unknown, duplicates };
}

// ---------- Plan accumulation ----------

function getEmployee(plan, name) {
  const key = matchKey(name);
  let employee = plan.byKey.get(key);
  if (!employee) {
    employee = {
      key,
      name: displayName(name),
      settings: null,
      settingsLine: null,
      projects: [],
      projectsByKey: new Map(),
    };
    plan.byKey.set(key, employee);
    plan.employees.push(employee);
  }
  return employee;
}

function getProject(employee, name) {
  const key = matchKey(name);
  let project = employee.projectsByKey.get(key);
  if (!project) {
    project = {
      key,
      name: displayName(name),
      clientName: null,
      monthlyRevenue: null,
      active: null,
      months: [],
      monthsByKey: new Map(),
    };
    employee.projectsByKey.set(key, project);
    employee.projects.push(project);
  }
  return project;
}

function setMonth(project, year, month, amount, line, warnings) {
  const key = `${year}-${month}`;
  const existing = project.monthsByKey.get(key);
  if (existing) {
    if (existing.amount !== amount) {
      warnings.push(
        `Line ${line}: ${project.name} ${year}-${String(month).padStart(2, '0')} appears more than once in the file — using the last value.`
      );
    }
    existing.amount = amount;
    existing.line = line;
    return false;
  }
  project.monthsByKey.set(key, { year, month, amount, line });
  project.months.push(project.monthsByKey.get(key));
  return true;
}

function fatal(message, line, warnings) {
  return { ok: false, errors: [{ line: line || 0, message }], warnings: warnings || [] };
}

// ---------- Main entry point ----------

function parseImportCsv(csvText) {
  const errors = [];
  const warnings = [];
  const text = String(csvText || '').replace(/^﻿/, '');

  if (text.trim() === '') return fatal('The file is empty.', 0, warnings);

  const delimiter = detectDelimiter(text);
  const { records: rawRecords, unterminatedQuote } = parseCsvText(text, delimiter);
  if (unterminatedQuote) {
    errors.push({
      line: 0,
      message: 'A quoted value is never closed — check for a stray double quote.',
    });
  }

  const records = rawRecords.filter((record) =>
    record.cells.some((cell) => String(cell).trim() !== '')
  );
  if (records.length === 0) return fatal('The file has no rows.', 0, warnings);
  if (records.length - 1 > LIMITS.records) {
    return fatal(
      `Too many rows (${records.length - 1}). Split the file into chunks of ${LIMITS.records} rows or fewer.`,
      0,
      warnings
    );
  }

  const header = analyzeHeader(records[0].cells);
  const { fields, monthColumns } = header;
  const headerLine = records[0].line;

  if (fields.employee === undefined) {
    return fatal(
      'No "Employee" column found. The first row must be a header row with at least Employee and Project columns.',
      headerLine,
      warnings
    );
  }
  if (fields.project === undefined) {
    return fatal('No "Project" column found.', headerLine, warnings);
  }

  const hasLongShape =
    fields.amount !== undefined &&
    (fields.month !== undefined || fields.period !== undefined);
  const format = hasLongShape ? 'long' : monthColumns.length > 0 ? 'wide' : null;

  if (!format) {
    return fatal(
      'No revenue columns found. Add Year/Month/Amount columns, or one column per month (e.g. "Jan 2026").',
      headerLine,
      warnings
    );
  }

  // Bare month headers ("Jan") only resolve when each row carries a year.
  if (format === 'wide' && fields.year === undefined) {
    const bare = monthColumns.filter((column) => column.year === null);
    if (bare.length > 0) {
      const names = bare
        .slice(0, 4)
        .map((c) => `"${c.label}"`)
        .join(', ');
      return fatal(
        `Month columns ${names} have no year. Either add a Year column or rename them like "Jan 2026".`,
        headerLine,
        warnings
      );
    }
  }

  if (header.duplicates.length > 0) {
    warnings.push(`Duplicate columns ignored after the first: ${header.duplicates.join(', ')}.`);
  }
  if (header.ignored.length > 0) {
    warnings.push(`Columns not imported: ${header.ignored.join(', ')}.`);
  }
  if (header.unknown.length > 0) {
    warnings.push(
      `Columns not recognised and skipped: ${header.unknown.join(', ')}. Rename them if they hold revenue.`
    );
  }

  const plan = { employees: [], byKey: new Map() };
  let monthEntries = 0;
  let dataRows = 0;

  const cellAt = (record, index) =>
    index === undefined || index === null ? '' : record.cells[index] ?? '';

  for (const record of records.slice(1)) {
    const line = record.line;
    const employeeName = displayName(cellAt(record, fields.employee));
    const projectName = displayName(cellAt(record, fields.project));

    if (employeeName === '') {
      errors.push({ line, message: 'Employee name is blank.' });
      continue;
    }
    if (employeeName.length > 80) {
      errors.push({ line, message: 'Employee name is longer than 80 characters.' });
      continue;
    }
    if (projectName === '') {
      errors.push({ line, message: `Project name is blank for ${employeeName}.` });
      continue;
    }
    if (projectName.length > 120) {
      errors.push({ line, message: 'Project name is longer than 120 characters.' });
      continue;
    }

    dataRows += 1;
    const employee = getEmployee(plan, employeeName);
    if (employee.name !== employeeName) {
      warnings.push(
        `Line ${line}: "${employeeName}" treated as "${employee.name}" (same name, different capitalisation).`
      );
    }
    const project = getProject(employee, projectName);

    // --- employee-level settings (optional columns) ---
    const settingSpecs = [
      ['dialMin', parseNumber],
      ['dialMax', parseNumber],
      ['thresholdPct', parseNumber],
      ['bonusRate', parseNumber],
      ['hireDate', parseDate],
    ];
    for (const [field, parser] of settingSpecs) {
      if (fields[field] === undefined) continue;
      const parsed = parser(cellAt(record, fields[field]));
      if (parsed.blank) continue;
      if (parsed.error) {
        errors.push({ line, message: `${field}: ${parsed.error}` });
        continue;
      }
      if (!employee.settings) employee.settings = {};
      if (employee.settings[field] !== undefined && employee.settings[field] !== parsed.value) {
        warnings.push(
          `Line ${line}: ${employee.name} has a different ${field} than an earlier row — using ${parsed.value}.`
        );
      }
      employee.settings[field] = parsed.value;
      employee.settingsLine = line;
    }

    // --- project-level attributes (optional columns) ---
    if (fields.clientName !== undefined) {
      const client = displayName(cellAt(record, fields.clientName));
      if (client !== '') {
        if (client.length > 120) {
          errors.push({ line, message: 'Client name is longer than 120 characters.' });
        } else {
          project.clientName = client;
        }
      }
    }
    if (fields.monthlyRevenue !== undefined) {
      const parsed = parseNumber(cellAt(record, fields.monthlyRevenue));
      if (parsed.error) {
        errors.push({ line, message: `Monthly recurring revenue: ${parsed.error}` });
      } else if (!parsed.blank) {
        project.monthlyRevenue = parsed.value;
      }
    }
    if (fields.active !== undefined) {
      const parsed = parseBoolean(cellAt(record, fields.active));
      if (parsed.error) errors.push({ line, message: `Active: ${parsed.error}` });
      else if (!parsed.blank) project.active = parsed.value;
    }

    // --- revenue ---
    let rowYear = null;
    if (fields.year !== undefined) {
      const raw = String(cellAt(record, fields.year)).trim();
      if (raw !== '') {
        const year = expandYear(raw);
        rowYear = Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : NaN;
      }
    }

    if (format === 'long') {
      const parsedAmount = parseAmount(cellAt(record, fields.amount));
      if (parsedAmount.error) {
        errors.push({ line, message: `Amount: ${parsedAmount.error}` });
        continue;
      }

      const monthIndex = fields.month !== undefined ? fields.month : fields.period;
      const monthToken = String(cellAt(record, monthIndex)).trim();
      let period = monthToken === '' ? null : parseMonthToken(monthToken);
      if (monthToken !== '' && !period) {
        errors.push({ line, message: `Month: "${monthToken}" is not a month.` });
        continue;
      }

      // A row with no month is still useful: it can carry only the
      // employee/project/settings columns.
      if (!period) {
        if (!parsedAmount.blank) {
          errors.push({ line, message: 'An amount is given but no month.' });
        }
        continue;
      }
      if (parsedAmount.blank) continue;

      let year = period.year;
      if (year === null) {
        if (rowYear === null || Number.isNaN(rowYear)) {
          errors.push({
            line,
            message: `Month "${monthToken}" has no year, and the Year column is blank or invalid.`,
          });
          continue;
        }
        year = rowYear;
      }
      if (!validYearMonth(year, period.month)) {
        errors.push({ line, message: `${year}-${period.month} is outside 2000-2100.` });
        continue;
      }
      if (setMonth(project, year, period.month, parsedAmount.value, line, warnings)) {
        monthEntries += 1;
      }
    } else {
      if (Number.isNaN(rowYear)) {
        const raw = String(cellAt(record, fields.year)).trim();
        errors.push({ line, message: `Year: "${raw}" is not a year between 2000 and 2100.` });
        continue;
      }

      for (const column of monthColumns) {
        const parsed = parseAmount(cellAt(record, column.index));
        if (parsed.blank) continue;
        if (parsed.error) {
          errors.push({ line, message: `${column.label}: ${parsed.error}` });
          continue;
        }
        const year = column.year === null ? rowYear : column.year;
        if (year === null) {
          errors.push({
            line,
            message: `${column.label} has no year and the Year column is blank.`,
          });
          continue;
        }
        if (!validYearMonth(year, column.month)) {
          errors.push({ line, message: `${year}-${column.month} is outside 2000-2100.` });
          continue;
        }
        if (setMonth(project, year, column.month, parsed.value, line, warnings)) {
          monthEntries += 1;
        }
      }
    }

    if (monthEntries > LIMITS.monthEntries) {
      return fatal(
        `Too many month values (over ${LIMITS.monthEntries}). Split the file up.`,
        line,
        warnings
      );
    }
  }

  // --- validate accumulated employee settings as a set ---
  for (const employee of plan.employees) {
    const settings = employee.settings;
    if (!settings) continue;
    const line = employee.settingsLine;

    const dialFields = ['dialMin', 'dialMax', 'thresholdPct', 'bonusRate'];
    if (!dialFields.some((field) => settings[field] !== undefined)) continue;

    const missing = dialFields.filter((field) => settings[field] === undefined);
    if (missing.length > 0) {
      warnings.push(
        `${employee.name}: ${missing.join(', ')} not given — the current value is kept for those.`
      );
    }
    if (
      settings.dialMin !== undefined &&
      settings.dialMax !== undefined &&
      settings.dialMax <= settings.dialMin
    ) {
      errors.push({
        line,
        message: `${employee.name}: max (${settings.dialMax}) must be greater than min (${settings.dialMin}).`,
      });
    }
    if (settings.thresholdPct !== undefined && settings.thresholdPct > 100) {
      errors.push({
        line,
        message: `${employee.name}: bonus threshold must be between 0 and 100 percent.`,
      });
    }
    if (settings.bonusRate !== undefined && settings.bonusRate > 100) {
      errors.push({
        line,
        message: `${employee.name}: bonus rate must be between 0 and 100 percent.`,
      });
    }
  }

  if (plan.employees.length > LIMITS.employees) {
    return fatal(
      `The file lists ${plan.employees.length} employees (limit ${LIMITS.employees}).`,
      0,
      warnings
    );
  }
  const projectCount = plan.employees.reduce((sum, e) => sum + e.projects.length, 0);
  if (projectCount > LIMITS.projects) {
    return fatal(
      `The file lists ${projectCount} projects (limit ${LIMITS.projects}).`,
      0,
      warnings
    );
  }

  return {
    ok: true,
    format,
    delimiter,
    dataRows,
    monthEntries,
    employees: plan.employees,
    errors,
    warnings,
  };
}

module.exports = {
  LIMITS,
  parseImportCsv,
  // exported for tests
  parseCsvText,
  detectDelimiter,
  parseMonthToken,
  parseAmount,
  parseDate,
  parseBoolean,
  analyzeHeader,
};
