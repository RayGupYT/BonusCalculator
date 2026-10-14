const express = require('express');
const rateLimit = require('express-rate-limit');

const Employee = require('../models/Employee');
const Project = require('../models/Project');
const Share = require('../models/Share');
const User = require('../models/User');
const { buildEmployeeSummary } = require('../lib/employeeSummary');

const router = express.Router();

// No authentication here on purpose: the token in the URL *is* the credential.
// The limiter is cheap insurance against anyone hammering the endpoint.
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again in a few minutes.' },
});

// Tokens are 32 bytes base64url. Reject anything of the wrong shape before
// touching the database.
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const GONE = { error: 'This report link is no longer available.' };

router.get('/reports/:token', publicLimiter, async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!TOKEN_RE.test(token)) {
      return res.status(404).json(GONE);
    }

    const share = await Share.findOne({ token });
    if (!share) {
      return res.status(404).json(GONE);
    }
    if (share.expiresAt !== null && share.expiresAt.getTime() <= Date.now()) {
      return res.status(410).json({
        error: 'This report link has expired. Ask whoever shared it for a new one.',
      });
    }

    // The link is scoped to one employee of one account; load exactly that.
    const employee = await Employee.findOne({
      _id: share.employeeId,
      userId: share.userId,
    });
    if (!employee) {
      return res.status(404).json(GONE);
    }

    const [projects, owner] = await Promise.all([
      Project.find({ employeeId: employee._id, userId: share.userId }).sort({ createdAt: 1 }),
      User.findById(share.userId).select('name'),
    ]);

    const summary = buildEmployeeSummary(employee, projects, share.year);

    // Record the view, but never fail the read over it.
    Share.updateOne(
      { _id: share._id },
      { $inc: { viewCount: 1 }, $set: { lastViewedAt: new Date() } }
    ).catch(() => {});

    // Deliberately narrower than the signed-in payload: no object ids, no
    // year switcher, nothing about the account beyond who shared it.
    res.json({
      report: {
        label: share.label || '',
        sharedBy: owner ? owner.name : null,
        createdAt: share.createdAt.toISOString(),
        expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
        generatedAt: new Date().toISOString(),
        employee: { name: summary.employee.name },
        year: summary.year,
        totalRevenue: summary.totalRevenue,
        settings: summary.settings,
        computed: summary.computed,
        monthlyTotals: summary.monthlyTotals,
        projects: summary.projects.map((project) => ({
          name: project.name,
          active: project.active,
          total: project.total,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
