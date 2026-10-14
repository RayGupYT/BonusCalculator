// The bonus maths for one employee over one year. Shared by the signed-in
// dashboard and by public shared reports so the two can never disagree.

function round2(value) {
  return Math.round(value * 100) / 100;
}

function resolveYear(requestedYear) {
  const currentYear = new Date().getFullYear();
  const year = Number.parseInt(requestedYear, 10);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return currentYear;
  return year;
}

function buildEmployeeSummary(employee, projects, requestedYear) {
  const currentYear = new Date().getFullYear();
  const year = resolveYear(requestedYear);

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

  return {
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
  };
}

module.exports = { buildEmployeeSummary, resolveYear, round2 };
