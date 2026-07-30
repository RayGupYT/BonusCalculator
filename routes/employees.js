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
      byEmployee.get(key).push({ id: project._id.toString(), name: project.name });
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

    const { clientName } = req.body || {};
    if (typeof clientName !== 'string' || clientName.trim().length > 120) {
      return res
        .status(400)
        .json({ error: 'Client name must be text (max 120 characters)' });
    }

    const project = await Project.findOneAndUpdate(
      { _id: projectId, employeeId: employee._id, userId: req.user._id },
      { clientName: clientName.trim() },
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

module.exports = router;
