"use strict";

// ─────────────────────────────────────────────
// 1. Calculate coins earned per department
// MANUAL metrics — cap achieved at target (can't earn more than 100% of target)
// DB metrics — use real fetched value as is (no cap)
// ─────────────────────────────────────────────
const calculateDeptCoins = (departments) => {
  return departments.map((dept) => {
    const metrics = dept.metrics.map((metric) => {
      const achieved = parseFloat(metric.value) || 0;
      const target = parseFloat(metric.target) || 0;

      let effectiveValue;

      if (metric.source === "MANUAL") {
        // MANUAL — admin enters achieved value
        // Cap at target so coins can't exceed 100% target coins
        effectiveValue = target > 0 ? Math.min(achieved, target) : achieved;
      } else {
        // DB metrics — real fetched value, no cap
        effectiveValue = achieved;
      }

      const coinsEarned = effectiveValue * (metric.multiplier || 0);

      return { ...metric, coinsEarned };
    });

    const totalBeforeWeight = metrics.reduce(
      (sum, m) => sum + m.coinsEarned,
      0
    );

    // ✅ Fixed — fallback handles both dept.weight and dept.deptWeight
    const deptWeight = parseFloat(dept.weight || dept.deptWeight || 0);
    const weightedContribution = (totalBeforeWeight * deptWeight) / 100;

    return {
      key: dept.key,
      name: dept.name,
      icon: dept.icon || "",
      deptWeight,
      metrics,
      totalBeforeWeight,
      weightedContribution,
    };
  });
};

// ─────────────────────────────────────────────
// 2. Retention multiplier  (0.5x → 1.2x)
// ─────────────────────────────────────────────
const getRetentionMultiplier = (retentionRate) => {
  const rate = parseFloat(retentionRate) || 0;
  return 0.5 + (rate / 100) * 0.7;
};

// ─────────────────────────────────────────────
// 3. Behavior multiplier from 360° ratings
// ─────────────────────────────────────────────
const getBehaviorMultiplier = (ratings) => {
  let finalRating = 0;

  ratings.forEach((r) => {
    finalRating += (parseFloat(r.value) || 0) * ((r.weight || 0) / 100);
  });

  let multiplier, behaviorLevel;

  if (finalRating >= 4.5) {
    multiplier = 1.2;
    behaviorLevel = "Gold";
  } else if (finalRating >= 4.0) {
    multiplier = 1.0;
    behaviorLevel = "Silver";
  } else if (finalRating >= 3.5) {
    multiplier = 0.9;
    behaviorLevel = "Bronze";
  } else if (finalRating >= 3.0) {
    multiplier = 0.75;
    // ✅ Fixed — BRD says Needs Improvement not Bronze
    behaviorLevel = "Needs Improvement";
  } else {
    multiplier = 0.5;
    // ✅ Fixed — BRD says Poor not Needs Improvement
    behaviorLevel = "Poor";
  }

  return {
    finalRating: parseFloat(finalRating.toFixed(2)),
    multiplier,
    behaviorLevel,
  };
};

// ─────────────────────────────────────────────
// 4. Performance category from achievement %
// ─────────────────────────────────────────────
const getPerformanceCategory = (finalCoins, targetCoins) => {
  // guard — always return object so calculateFinal never crashes
  if (!targetCoins || targetCoins === 0) {
    return { achievementPercent: 0, performanceCategory: "Needs Improvement" };
  }

  const achievementPercent = (finalCoins / targetCoins) * 100;

  let performanceCategory;
  if (achievementPercent >= 100) {
    performanceCategory = "Gold";
  } else if (achievementPercent >= 75) {
    performanceCategory = "Silver";
  } else if (achievementPercent >= 50) {
    performanceCategory = "Bronze";
  } else {
    performanceCategory = "Needs Improvement";
  }

  return {
    achievementPercent: parseFloat(achievementPercent.toFixed(2)),
    performanceCategory,
  };
};

// ─────────────────────────────────────────────
// 5. Master function — call this from controller
// ─────────────────────────────────────────────
const calculateFinal = (config) => {
  const { departments, ratings, retentionRate, targetCoins } = config;

  // Step 1 — dept breakdown with per-metric coins
  const deptBreakdown = calculateDeptCoins(departments);

  // Step 2 — sum all weighted dept contributions
  const weightedTotalCoins = deptBreakdown.reduce(
    (sum, d) => sum + d.weightedContribution,
    0
  );

  // Step 3 — apply retention multiplier
  const retentionMultiplier = getRetentionMultiplier(retentionRate);
  const coinsAfterRetention = weightedTotalCoins * retentionMultiplier;

  // Step 4 — apply 360° behavior multiplier
  const {
    finalRating,
    multiplier: behaviorMultiplier,
    behaviorLevel,
  } = getBehaviorMultiplier(ratings);
  const finalCoins = coinsAfterRetention * behaviorMultiplier;

  // Step 5 — final salary (1 FundCoin = ₹1)
  const finalSalary = finalCoins;

  // Step 6 — achievement % and performance category
  const { achievementPercent, performanceCategory } = getPerformanceCategory(
    finalCoins,
    targetCoins
  );

  return {
    deptBreakdown,
    weightedTotalCoins: parseFloat(weightedTotalCoins.toFixed(4)),
    retentionMultiplier: parseFloat(retentionMultiplier.toFixed(4)),
    coinsAfterRetention: parseFloat(coinsAfterRetention.toFixed(4)),
    finalRating,
    behaviorMultiplier: parseFloat(behaviorMultiplier.toFixed(2)),
    behaviorLevel,
    finalCoins: parseFloat(finalCoins.toFixed(4)),
    finalSalary: parseFloat(finalSalary.toFixed(4)),
    achievementPercent,
    performanceCategory,
  };
};

module.exports = {
  calculateFinal,
  calculateDeptCoins,
  getRetentionMultiplier,
  getBehaviorMultiplier,
  getPerformanceCategory,
};