const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');

const Employee = require('../models/Employee');
const Share = require('../models/Share');
const requireAuth = require('../middleware/auth');
const { resolveYear } = require('../lib/employeeSummary');

const router = express.Router();

router.use(requireAuth);

const MAX_SHARES_PER_USER = 100;
const EXPIRY_CHOICES = [7, 30, 90, 365];

// 32 random bytes, base64url: long enough that guessing a live link is not a
// threat worth modelling.
function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function isExpired(share) {
  return share.expiresAt !== null && share.expiresAt.getTime() <= Date.now();
}

function presentShare(share, employeeName) {
  return {
    id: share._id.toString(),
    employeeId: share.employeeId.toString(),
    employeeName: employeeName || null,
    label: share.label || '',
    year: share.year,
    url: `/r/${share.token}`,
    expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
    expired: isExpired(share),
    viewCount: share.viewCount || 0,
    lastViewedAt: share.lastViewedAt ? share.lastViewedAt.toISOString() : null,
    createdAt: share.createdAt.toISOString(),
  };
}

// GET /api/shares            every link this account has issued
// GET /api/shares?employeeId=…  just that employee's links
router.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.employeeId !== undefined) {
      if (!mongoose.isValidObjectId(req.query.employeeId)) {
        return res.status(400).json({ error: 'Invalid employee' });
      }
      filter.employeeId = req.query.employeeId;
    }

    const shares = await Share.find(filter).sort({ createdAt: -1 });
    const employees = await Employee.find({ userId: req.user._id }).select('name');
    const nameById = new Map(employees.map((e) => [e._id.toString(), e.name]));

    res.json({
      shares: shares.map((share) =>
        presentShare(share, nameById.get(share.employeeId.toString()))
      ),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/shares  { employeeId, year?, label?, expiresInDays? }
router.post('/', async (req, res, next) => {
  try {
    const { employeeId, year, label, expiresInDays } = req.body || {};

    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const employee = await Employee.findOne({ _id: employeeId, userId: req.user._id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (label !== undefined && label !== null) {
      if (typeof label !== 'string' || label.trim().length > 80) {
        return res.status(400).json({ error: 'Label must be text (max 80 characters)' });
      }
    }

    let expiresAt = null;
    if (expiresInDays !== undefined && expiresInDays !== null && expiresInDays !== 0) {
      if (!EXPIRY_CHOICES.includes(expiresInDays)) {
        return res.status(400).json({
          error: `Expiry must be one of ${EXPIRY_CHOICES.join(', ')} days, or left off entirely`,
        });
      }
      expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    }

    const count = await Share.countDocuments({ userId: req.user._id });
    if (count >= MAX_SHARES_PER_USER) {
      return res.status(400).json({
        error: `You already have ${MAX_SHARES_PER_USER} report links — revoke one before creating another.`,
      });
    }

    const share = await Share.create({
      userId: req.user._id,
      employeeId: employee._id,
      token: newToken(),
      year: resolveYear(year),
      label: typeof label === 'string' ? label.trim() : '',
      expiresAt,
    });

    res.status(201).json({ share: presentShare(share, employee.name) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/shares/:shareId — revokes the link for good.
router.delete('/:shareId', async (req, res, next) => {
  try {
    const { shareId } = req.params;
    if (!mongoose.isValidObjectId(shareId)) {
      return res.status(404).json({ error: 'Report link not found' });
    }
    const deleted = await Share.findOneAndDelete({
      _id: shareId,
      userId: req.user._id,
    });
    if (!deleted) {
      return res.status(404).json({ error: 'Report link not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
