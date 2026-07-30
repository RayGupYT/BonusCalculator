const express = require('express');
const mongoose = require('mongoose');

const Employee = require('../models/Employee');
const Project = require('../models/Project');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

function validName(value, maxLength) {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength
  );
}

async function findOwnedEmployee(req, res) {
  const { employeeId } = req.params;
  if (!mongoose.isValidObjectId(employeeId)) {
    res.status(404).json({ error: 'Employee not found' });
    return null;
  }
  const employee = await Employee.findOne({
    _id: employeeId,
    userId: req.user._id,
  });
  if (!employee) {
    res.status(404).json({ error: 'Employee not found' });
    return null;
  }
  return employee;
}

async function findOwnedProject(req, res) {
  const employee = await findOwnedEmployee(req, res);
  if (!employee) return null;

  const { projectId } = req.params;
  if (!mongoose.isValidObjectId(projectId)) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  const project = await Project.findOne({
    _id: projectId,
    employeeId: employee._id,
    userId: req.user._id,
  });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return { employee, project };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function sortedRevenue(project) {
  return [...project.revenue]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((r) => ({ year: r.year, month: r.month, amount: r.amount }));
}

function parseYearMonth(yearRaw, monthRaw) {
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }
  return { year, month };
}

// Full hierarchy: employees with their projects nested.
router.get('/', async (req, res, next) => {
  try {
    const [employees, projects] = await Promise.all([
      Employee.find({ userId: req.user._id }).sort({ createdAt: 1 }),
      Project.find({ userId: req.user._id }).sort({ createdAt: 1 }),
    ]);

    const byEmployee = new Map();
    for (const project of projects) {
      const key = project.employeeId.toString();
      if (!byEmployee.has(key)) byEmployee.set(key, []);
      byEmployee.get(key).push({
        id: project._id.toString(),
        name: project.name,
        active: project.active !== false,
        monthlyRevenue: project.monthlyRevenue ?? 0,
      });
    }

    res.json({
      employees: employees.map((employee) => ({
        id: employee._id.toString(),
        name: employee.name,
        projects: byEmployee.get(employee._id.toString()) || [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!validName(name, 80)) {
      return res.status(400).json({ error: 'Employee name is required (max 80 characters)' });
    }
    const employee = await Employee.create({
      userId: req.user._id,
      name: name.trim(),
    });
    res.status(201).json({
      employee: { id: employee._id.toString(), name: employee.name, projects: [] },
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:employeeId', async (req, res, next) => {
  try {
    const employee = await findOwnedEmployee(req, res);
    if (!employee) return;

    await Project.deleteMany({ employeeId: employee._id });
    await employee.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:employeeId/projects', async (req, res, next) => {
  try {
    const employee = await findOwnedEmployee(req, res);
    if (!employee) return;

    const { name } = req.body || {};
    if (!validName(name, 120)) {
      return res.status(400).json({ error: 'Project name is required (max 120 characters)' });
    }

    const project = await Project.create({
      userId: req.user._id,
      employeeId: employee._id,
      name: name.trim(),
    });
    res.status(201).json({
      project: { id: project._id.toString(), name: project.name },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:employeeId/projects/:projectId', async (req, res, next) => {
  try {
    const employee = await findOwnedEmployee(req, res);
    if (!employee) return;

    const { projectId } = req.params;
    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = await Project.findOne({
      _id: projectId,
      employeeId: employee._id,
      userId: req.user._id,
    });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      project: {
        id: project._id.toString(),
        name: project.name,
        clientName: project.clientName || '',
        active: project.active !== false,
        monthlyRevenue: project.monthlyRevenue ?? 0,
        revenue: sortedRevenue(project),
        employee: { id: employee._id.toString(), name: employee.name },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:employeeId/projects/:projectId', async (req, res, next) => {
  try {
    const employee = await findOwnedEmployee(req, res);
    if (!employee) return;

    const { projectId } = req.params;
    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { clientName, monthlyRevenue, active } = req.body || {};
    const updates = {};

    if (clientName !== undefined) {
      if (typeof clientName !== 'string' || clientName.trim().length > 120) {
        return res
          .status(400)
          .json({ error: 'Client name must be text (max 120 characters)' });
      }
      updates.clientName = clientName.trim();
    }
    if (monthlyRevenue !== undefined) {
      if (
        typeof monthlyRevenue !== 'number' ||
        !Number.isFinite(monthlyRevenue) ||
        monthlyRevenue < 0 ||
        monthlyRevenue > 1e12
      ) {
        return res
          .status(400)
          .json({ error: 'Monthly recurring revenue must be a number of 0 or more' });
      }
      updates.monthlyRevenue = round2(monthlyRevenue);
    }
    if (active !== undefined) {
      if (typeof active !== 'boolean') {
        return res.status(400).json({ error: 'Active must be true or false' });
      }
      updates.active = active;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const project = await Project.findOneAndUpdate(
      { _id: projectId, employeeId: employee._id, userId: req.user._id },
      updates,
      { new: true }
    );
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      project: {
        id: project._id.toString(),
        name: project.name,
        clientName: project.clientName || '',
        active: project.active !== false,
        monthlyRevenue: project.monthlyRevenue ?? 0,
        employee: { id: employee._id.toString(), name: employee.name },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:employeeId/projects/:projectId', async (req, res, next) => {
  try {
    const employee = await findOwnedEmployee(req, res);
    if (!employee) return;

    const { projectId } = req.params;
    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const deleted = await Project.findOneAndDelete({
      _id: projectId,
      employeeId: employee._id,
      userId: req.user._id,
    });
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Employee dashboard: revenue for one year combined across the employee's projects.
router.get('/:employeeId/summary', async (req, res, next) => {
  try {
    const employee = await findOwnedEmployee(req, res);
    if (!employee) return;

    const currentYear = new Date().getFullYear();
    let year = Number.parseInt(req.query.year, 10);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      year = currentYear;
    }

    const projects = await Project.find({
      employeeId: employee._id,
      userId: req.user._id,
    }).sort({ createdAt: 1 });

    const monthTotals = new Map(); // month (1-12) -> total, within the selected year
    const yearsSet = new Set([currentYear, year]);
    let totalRevenue = 0;

    const projectSummaries = projects.map((project) => {
      let projectTotal = 0;
      for (const entry of project.revenue) {
        yearsSet.add(entry.year);
        if (entry.year !== year) continue;
        projectTotal += entry.amount;
        monthTotals.set(entry.month, (monthTotals.get(entry.month) || 0) + entry.amount);
      }
      totalRevenue += projectTotal;
      return {
        id: project._id.toString(),
        name: project.name,
        active: project.active !== false,
        total: round2(projectTotal),
      };
    });

    const dialMin = employee.dialMin ?? 0;
    const dialMax = employee.dialMax ?? 1000000;
    const thresholdPct = employee.thresholdPct ?? 100;
    const bonusRate = employee.bonusRate ?? 1.5;
    const hireDate = employee.hireDate || null;

    // Prorate the dial when the employee was hired during the viewed year:
    // hired in July -> 6 of 12 months remain -> goals scale to 50%.
    let prorationFactor = 1;
    if (hireDate && hireDate.getUTCFullYear() === year) {
      prorationFactor = (12 - hireDate.getUTCMonth()) / 12;
    }

    const effectiveMin = round2(dialMin * prorationFactor);
    const effectiveMax = round2(dialMax * prorationFactor);

    const total = round2(totalRevenue);
    const thresholdValue = round2(
      effectiveMin + (effectiveMax - effectiveMin) * (thresholdPct / 100)
    );
    const bonus = round2(Math.max(0, total - thresholdValue) * (bonusRate / 100));

    res.json({
      employee: { id: employee._id.toString(), name: employee.name },
      year,
      availableYears: [...yearsSet].sort((a, b) => b - a),
      totalRevenue: total,
      settings: {
        dialMin,
        dialMax,
        thresholdPct,
        bonusRate,
        hireDate: hireDate ? hireDate.toISOString().slice(0, 10) : null,
      },
      computed: {
        prorationFactor,
        effectiveMin,
        effectiveMax,
        thresholdValue,
        bonusStarted: total >= thresholdValue,
        bonus,
        remainingToBonus: round2(Math.max(0, thresholdValue - total)),
        bonusRatePct: bonusRate,
      },
      monthlyTotals: [...monthTotals.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([month, monthTotal]) => ({
          year,
          month,
          total: round2(monthTotal),
        })),
      projects: projectSummaries,
    });
  } catch (err) {
    next(err);
  }
});

// Update the bonus dial settings for an employee.
router.patch('/:employeeId', async (req, res, next) => {
  try {
    const employee = await findOwnedEmployee(req, res);
    if (!employee) return;

    const { dialMin, dialMax, thresholdPct, bonusRate, hireDate } = req.body || {};
    const values = [dialMin, dialMax, thresholdPct, bonusRate];
    if (values.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
      return res
        .status(400)
        .json({ error: 'Min, max, threshold, and bonus rate must all be numbers' });
    }
    if (dialMin < 0 || dialMax > 1e12) {
      return res
        .status(400)
        .json({ error: 'Min must be at least 0 (and max within reason)' });
    }
    if (dialMax <= dialMin) {
      return res.status(400).json({ error: 'Max must be greater than min' });
    }
    if (thresholdPct < 0 || thresholdPct > 100) {
      return res
        .status(400)
        .json({ error: 'Threshold must be between 0 and 100 percent' });
    }
    if (bonusRate < 0 || bonusRate > 100) {
      return res
        .status(400)
        .json({ error: 'Bonus rate must be between 0 and 100 percent' });
    }

    if (hireDate === null || hireDate === '' || hireDate === undefined) {
      employee.hireDate = null;
    } else {
      if (typeof hireDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) {
        return res.status(400).json({ error: 'Hire date must be a date (YYYY-MM-DD)' });
      }
      const parsed = new Date(`${hireDate}T00:00:00.000Z`);
      if (
        Number.isNaN(parsed.getTime()) ||
        parsed.getUTCFullYear() < 1950 ||
        parsed.getUTCFullYear() > 2100
      ) {
        return res.status(400).json({ error: 'Hire date is out of range' });
      }
      employee.hireDate = parsed;
    }

    employee.dialMin = round2(dialMin);
    employee.dialMax = round2(dialMax);
    employee.thresholdPct = round2(thresholdPct);
    employee.bonusRate = round2(bonusRate);
    await employee.save();

    res.json({
      settings: {
        dialMin: employee.dialMin,
        dialMax: employee.dialMax,
        thresholdPct: employee.thresholdPct,
        bonusRate: employee.bonusRate,
        hireDate: employee.hireDate ? employee.hireDate.toISOString().slice(0, 10) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Create a month entry (starts at $0). 409 if the month already exists.
router.post('/:employeeId/projects/:projectId/revenue', async (req, res, next) => {
  try {
    const found = await findOwnedProject(req, res);
    if (!found) return;
    const { project } = found;

    const parsed = parseYearMonth((req.body || {}).year, (req.body || {}).month);
    if (!parsed) {
      return res.status(400).json({ error: 'A valid month and year are required' });
    }

    const exists = project.revenue.some(
      (r) => r.year === parsed.year && r.month === parsed.month
    );
    if (exists) {
      return res.status(409).json({ error: 'That month already exists on this project' });
    }

    // New months start prefilled with the project's monthly recurring revenue.
    const amount = round2(project.monthlyRevenue ?? 0);
    project.revenue.push({ year: parsed.year, month: parsed.month, amount });
    await project.save();
    res.status(201).json({ entry: { year: parsed.year, month: parsed.month, amount } });
  } catch (err) {
    next(err);
  }
});

// Set the amount for an existing month entry.
router.put(
  '/:employeeId/projects/:projectId/revenue/:year/:month',
  async (req, res, next) => {
    try {
      const found = await findOwnedProject(req, res);
      if (!found) return;
      const { project } = found;

      const parsed = parseYearMonth(req.params.year, req.params.month);
      if (!parsed) {
        return res.status(404).json({ error: 'Month entry not found' });
      }

      const { amount } = req.body || {};
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > 1e12) {
        return res.status(400).json({ error: 'Amount must be a number of 0 or more' });
      }

      const entry = project.revenue.find(
        (r) => r.year === parsed.year && r.month === parsed.month
      );
      if (!entry) {
        return res.status(404).json({ error: 'Month entry not found' });
      }

      entry.amount = round2(amount);
      project.markModified('revenue');
      await project.save();
      res.json({ entry: { year: entry.year, month: entry.month, amount: entry.amount } });
    } catch (err) {
      next(err);
    }
  }
);

// Remove a month entry.
router.delete(
  '/:employeeId/projects/:projectId/revenue/:year/:month',
  async (req, res, next) => {
    try {
      const found = await findOwnedProject(req, res);
      if (!found) return;
      const { project } = found;

      const parsed = parseYearMonth(req.params.year, req.params.month);
      if (!parsed) {
        return res.status(404).json({ error: 'Month entry not found' });
      }

      const before = project.revenue.length;
      project.revenue = project.revenue.filter(
        (r) => !(r.year === parsed.year && r.month === parsed.month)
      );
      if (project.revenue.length === before) {
        return res.status(404).json({ error: 'Month entry not found' });
      }

      await project.save();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
