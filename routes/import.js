const express = require('express');
const rateLimit = require('express-rate-limit');

const Employee = require('../models/Employee');
const Project = require('../models/Project');
const requireAuth = require('../middleware/auth');
const { parseImportCsv, LIMITS } = require('../lib/csvImport');

const router = express.Router();

router.use(requireAuth);

// The CSV arrives as a raw text/csv body rather than inside JSON: the global
// express.json() limit stays at its small default, and the file needs no escaping.
router.use(
  express.text({
    type: ['text/csv', 'text/plain'],
    limit: '4mb',
  })
);

const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many imports — please try again in a few minutes.' },
});

function round2(value) {
  return Math.round(value * 100) / 100;
}

function matchKey(value) {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

// Builds "what would change" for one parsed CSV against what the user already
// has. The same plan drives the preview and the write, so they cannot disagree.
function reconcile(parsed, existingEmployees, existingProjects, onConflict) {
  const warnings = [...parsed.warnings];

  const employeeByKey = new Map();
  for (const employee of existingEmployees) {
    const key = matchKey(employee.name);
    if (employeeByKey.has(key)) {
      warnings.push(
        `You already have more than one employee named "${employee.name}" — rows will go to the oldest.`
      );
      continue;
    }
    employeeByKey.set(key, employee);
  }

  const projectsByEmployee = new Map(); // employee id -> Map(projectKey -> doc)
  for (const project of existingProjects) {
    const ownerId = project.employeeId.toString();
    if (!projectsByEmployee.has(ownerId)) projectsByEmployee.set(ownerId, new Map());
    const byKey = projectsByEmployee.get(ownerId);
    const key = matchKey(project.name);
    if (byKey.has(key)) {
      warnings.push(
        `More than one existing project is named "${project.name}" — rows will go to the oldest.`
      );
      continue;
    }
    byKey.set(key, project);
  }

  const summary = {
    rows: parsed.dataRows,
    employeesCreated: 0,
    employeesMatched: 0,
    settingsChanged: 0,
    projectsCreated: 0,
    projectsMatched: 0,
    projectsUpdated: 0,
    monthsCreated: 0,
    monthsUpdated: 0,
    monthsUnchanged: 0,
    monthsSkipped: 0,
    revenueTotal: 0,
  };

  const employeeReports = [];
  const writes = { newEmployees: [], employeeUpdates: [], newProjects: [], projectUpdates: [] };

  for (const planned of parsed.employees) {
    const existing = employeeByKey.get(planned.key) || null;
    if (existing) summary.employeesMatched += 1;
    else summary.employeesCreated += 1;

    // Only the dial fields the CSV actually supplied, and only where they differ.
    const settingChanges = {};
    if (planned.settings) {
      for (const [field, value] of Object.entries(planned.settings)) {
        if (!existing) {
          settingChanges[field] = value;
          continue;
        }
        if (field === 'hireDate') {
          const current = existing.hireDate
            ? existing.hireDate.toISOString().slice(0, 10)
            : null;
          if (current !== value) settingChanges[field] = value;
        } else if (round2(existing[field] ?? 0) !== round2(value)) {
          settingChanges[field] = value;
        }
      }
    }
    const hasSettingChanges = Object.keys(settingChanges).length > 0;
    if (hasSettingChanges && existing) summary.settingsChanged += 1;

    const projectReports = [];

    for (const plannedProject of planned.projects) {
      const existingProject = existing
        ? (projectsByEmployee.get(existing._id.toString()) || new Map()).get(plannedProject.key) ||
          null
        : null;

      if (existingProject) summary.projectsMatched += 1;
      else summary.projectsCreated += 1;

      // Project attributes: only those the CSV supplied, only where they differ.
      const attrChanges = {};
      if (plannedProject.clientName !== null) {
        if (!existingProject || (existingProject.clientName || '') !== plannedProject.clientName) {
          attrChanges.clientName = plannedProject.clientName;
        }
      }
      if (plannedProject.monthlyRevenue !== null) {
        const current = existingProject ? existingProject.monthlyRevenue ?? 0 : 0;
        if (!existingProject || round2(current) !== round2(plannedProject.monthlyRevenue)) {
          attrChanges.monthlyRevenue = round2(plannedProject.monthlyRevenue);
        }
      }
      if (plannedProject.active !== null) {
        const current = existingProject ? existingProject.active !== false : true;
        if (!existingProject || current !== plannedProject.active) {
          attrChanges.active = plannedProject.active;
        }
      }
      if (existingProject && Object.keys(attrChanges).length > 0) summary.projectsUpdated += 1;

      // Monthly revenue: compare against what the project already holds.
      const currentMonths = new Map(
        (existingProject ? existingProject.revenue : []).map((entry) => [
          `${entry.year}-${entry.month}`,
          entry.amount,
        ])
      );
      const merged = new Map(currentMonths);
      let created = 0;
      let updated = 0;
      let unchanged = 0;
      let skipped = 0;
      let importedTotal = 0;

      for (const month of plannedProject.months) {
        const key = `${month.year}-${month.month}`;
        if (!currentMonths.has(key)) {
          merged.set(key, month.amount);
          created += 1;
          importedTotal += month.amount;
        } else if (currentMonths.get(key) === month.amount) {
          unchanged += 1;
        } else if (onConflict === 'skip') {
          skipped += 1;
        } else {
          merged.set(key, month.amount);
          updated += 1;
          importedTotal += month.amount;
        }
      }

      summary.monthsCreated += created;
      summary.monthsUpdated += updated;
      summary.monthsUnchanged += unchanged;
      summary.monthsSkipped += skipped;
      summary.revenueTotal = round2(summary.revenueTotal + importedTotal);

      const monthsChanged = created + updated > 0;

      projectReports.push({
        name: plannedProject.name,
        created: !existingProject,
        monthsCreated: created,
        monthsUpdated: updated,
        monthsUnchanged: unchanged,
        monthsSkipped: skipped,
        attrChanges: Object.keys(attrChanges),
        total: round2(importedTotal),
      });

      if (!existingProject) {
        writes.newProjects.push({
          // Projects under an existing employee already know their owner; the
          // rest are resolved by key once their employee has been inserted.
          employeeId: existing ? existing._id : null,
          employeeKey: planned.key,
          name: plannedProject.name,
          clientName: attrChanges.clientName ?? '',
          monthlyRevenue: attrChanges.monthlyRevenue ?? 0,
          active: attrChanges.active ?? true,
          revenue: [...merged.entries()]
            .map(([key, amount]) => {
              const [year, month] = key.split('-').map(Number);
              return { year, month, amount };
            })
            .sort((a, b) => a.year - b.year || a.month - b.month),
        });
      } else if (monthsChanged || Object.keys(attrChanges).length > 0) {
        const update = { ...attrChanges };
        if (monthsChanged) {
          update.revenue = [...merged.entries()]
            .map(([key, amount]) => {
              const [year, month] = key.split('-').map(Number);
              return { year, month, amount };
            })
            .sort((a, b) => a.year - b.year || a.month - b.month);
        }
        writes.projectUpdates.push({ id: existingProject._id, update });
      }
    }

    employeeReports.push({
      name: planned.name,
      created: !existing,
      settingsChanged: hasSettingChanges ? Object.keys(settingChanges) : [],
      projects: projectReports,
    });

    if (!existing) {
      writes.newEmployees.push({ key: planned.key, name: planned.name, settings: settingChanges });
    } else if (hasSettingChanges) {
      writes.employeeUpdates.push({ id: existing._id, update: settingChanges });
    }
  }

  return { summary, employeeReports, warnings, writes };
}

function settingsToDoc(settings) {
  const doc = {};
  for (const [field, value] of Object.entries(settings)) {
    if (field === 'hireDate') {
      doc.hireDate = value ? new Date(`${value}T00:00:00.000Z`) : null;
    } else {
      doc[field] = round2(value);
    }
  }
  return doc;
}

// Applies the reconciled plan in four round trips regardless of file size.
async function applyWrites(writes, userId) {
  const employeeIdByKey = new Map();

  if (writes.newEmployees.length > 0) {
    const created = await Employee.insertMany(
      writes.newEmployees.map((employee) => ({
        userId,
        name: employee.name,
        ...settingsToDoc(employee.settings),
      })),
      { ordered: true }
    );
    created.forEach((doc, index) => {
      employeeIdByKey.set(writes.newEmployees[index].key, doc._id);
    });
  }

  if (writes.employeeUpdates.length > 0) {
    await Employee.bulkWrite(
      writes.employeeUpdates.map(({ id, update }) => ({
        updateOne: {
          filter: { _id: id, userId },
          update: { $set: settingsToDoc(update) },
        },
      }))
    );
  }

  if (writes.newProjects.length > 0) {
    await Project.insertMany(
      writes.newProjects.map((project) => ({
        userId,
        employeeId: project.employeeId || employeeIdByKey.get(project.employeeKey),
        name: project.name,
        clientName: project.clientName,
        monthlyRevenue: project.monthlyRevenue,
        active: project.active,
        revenue: project.revenue,
      })),
      { ordered: true }
    );
  }

  if (writes.projectUpdates.length > 0) {
    await Project.bulkWrite(
      writes.projectUpdates.map(({ id, update }) => ({
        updateOne: {
          filter: { _id: id, userId },
          update: { $set: update },
        },
      }))
    );
  }
}

function boolParam(value) {
  return value === '1' || value === 'true' || value === 'yes';
}

// POST /api/import/csv  — body is the raw CSV
// ?dryRun=1       validate and report without writing (the preview)
// ?onConflict=    overwrite (default) | skip  — for months that already exist
// ?allowPartial=1 import the valid rows even though some rows failed
router.post('/csv', importLimiter, async (req, res, next) => {
  try {
    const csv = typeof req.body === 'string' ? req.body : '';
    if (csv.trim() === '') {
      return res
        .status(400)
        .json({ error: 'No CSV content received. Send the file as a text/csv body.' });
    }

    const dryRun = boolParam(req.query.dryRun);
    const allowPartial = boolParam(req.query.allowPartial);
    const onConflict = req.query.onConflict === 'skip' ? 'skip' : 'overwrite';

    const parsed = parseImportCsv(csv);
    if (!parsed.ok) {
      return res.status(400).json({
        error: parsed.errors[0].message,
        errors: parsed.errors,
        warnings: parsed.warnings,
      });
    }

    const [existingEmployees, existingProjects] = await Promise.all([
      Employee.find({ userId: req.user._id }).sort({ createdAt: 1 }),
      Project.find({ userId: req.user._id }).sort({ createdAt: 1 }),
    ]);

    const { summary, employeeReports, warnings, writes } = reconcile(
      parsed,
      existingEmployees,
      existingProjects,
      onConflict
    );

    const errors = parsed.errors;
    const canImport = errors.length === 0 || allowPartial;

    const report = {
      dryRun,
      imported: false,
      canImport,
      format: parsed.format,
      delimiter: parsed.delimiter === '\t' ? 'tab' : parsed.delimiter,
      onConflict,
      summary,
      employees: employeeReports,
      errors: errors.slice(0, LIMITS.reportedErrors),
      errorCount: errors.length,
      warnings: warnings.slice(0, LIMITS.reportedErrors),
      warningCount: warnings.length,
    };

    if (dryRun) return res.json(report);

    if (!canImport) {
      return res.status(400).json({
        ...report,
        error: `${errors.length} row(s) could not be read. Fix them, or choose to import the valid rows only.`,
      });
    }

    await applyWrites(writes, req.user._id);
    report.imported = true;
    res.json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
