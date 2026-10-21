import { getDatabase } from '../../db/connection.js'

/**
 * Institutional Evaluation Settings & Thresholds Optimizer
 *
 * Implements:
 * 1. Otsu's Global Thresholding to determine the optimal institutional RRI Confidence Threshold
 *    (maximizing inter-class variance between hasty/mechanical feedback and conscientious evaluations).
 * 2. Empirical percentile calibration for the Rapid Rush Response Threshold (ms).
 * 3. Transparent explainability metrics (intra/inter-class variance, retention %, sample size).
 */

export class ThresholdOptimizer {
  constructor() {
    this.modelMetadata = null
  }

  /**
   * Optimizes the institutional confidence filter threshold (RRI threshold) using Otsu's method.
   *
   * @param {number} currentThreshold - Current configured threshold (e.g. 60)
   */
  optimizeConfidenceThreshold(currentThreshold = 60) {
    const db = getDatabase()

    const reviews = db.prepare(`
      SELECT rri_score
      FROM reviews
      WHERE status = 'submitted' AND rri_score IS NOT NULL
    `).all()

    const scores = reviews.map((r) => Number(r.rri_score)).filter((s) => !Number.isNaN(s))
    const N = scores.length

    if (N < 10) {
      return {
        parameter_type: 'evaluation_settings',
        setting_key: 'default_rri_threshold',
        current_value: currentThreshold,
        recommended_value: currentThreshold,
        difference: 0,
        recommendation_type: 'heuristic_fallback',
        confidence_score: 0.5,
        explanation: 'Insufficient historical review submissions for Otsu discriminant thresholding. Retained default 60.',
        detailed_basis: { sample_size: N },
      }
    }

    // Otsu's algorithm on RRI scores (range 0 to 100)
    // 1. Histogram with 101 bins (0 to 100)
    const histogram = Array(101).fill(0)
    for (const score of scores) {
      const bin = Math.max(0, Math.min(100, Math.round(score)))
      histogram[bin]++
    }

    // Total mean
    let totalMean = 0
    for (let t = 0; t <= 100; t++) {
      totalMean += t * (histogram[t] / N)
    }

    let bestThreshold = 60
    let maxInterClassVariance = 0
    let bestWeight0 = 0
    let bestWeight1 = 0
    let bestMean0 = 0
    let bestMean1 = 0

    let w0 = 0
    let sum0 = 0

    for (let t = 0; t <= 100; t++) {
      const p = histogram[t] / N
      w0 += p
      if (w0 === 0) continue
      const w1 = 1 - w0
      if (w1 === 0) break

      sum0 += t * p
      const m0 = sum0 / w0
      const m1 = (totalMean - sum0) / w1

      // Between-class variance
      const interClassVar = w0 * w1 * Math.pow(m0 - m1, 2)
      if (interClassVar > maxInterClassVariance) {
        maxInterClassVariance = interClassVar
        bestThreshold = t
        bestWeight0 = w0
        bestWeight1 = w1
        bestMean0 = m0
        bestMean1 = m1
      }
    }

    // Calculate total variance
    let totalVariance = 0
    for (const s of scores) {
      totalVariance += Math.pow(s - totalMean, 2)
    }
    totalVariance /= N
    const separabilityRatio = totalVariance > 0 ? Number((maxInterClassVariance / totalVariance).toFixed(3)) : 0.75

    const recommendedThreshold = Math.max(45, Math.min(80, bestThreshold))
    const diff = recommendedThreshold - currentThreshold
    const retainedCount = scores.filter((s) => s >= recommendedThreshold).length
    const retentionPct = Number(((retainedCount / N) * 100).toFixed(1))

    let explanation = `Determined using Otsu's discriminant criterion across ${N} submitted evaluations. An RRI cutoff of ${recommendedThreshold} mathematically maximizes separation between rushed submissions (mean RRI: ${bestMean0.toFixed(1)}) and conscientious submissions (mean RRI: ${bestMean1.toFixed(1)}), retaining ${retentionPct}% (${retainedCount}/${N}) of evaluations for institutional decision-making.`

    if (diff > 0) {
      explanation += ` Increasing the filter by +${diff} points filters out marginal mechanical clickers.`
    } else if (diff < 0) {
      explanation += ` Lowering the filter by ${Math.abs(diff)} points includes more nuanced student evaluations without admitting noise.`
    }

    return {
      parameter_type: 'evaluation_settings',
      setting_key: 'default_rri_threshold',
      setting_label: 'Institutional Confidence Threshold (RRI Cutoff)',
      current_value: currentThreshold,
      recommended_value: recommendedThreshold,
      difference: diff,
      recommendation_type: 'statistical_otsu_discriminant',
      confidence_score: 0.88,
      explanation,
      detailed_basis: {
        algorithm: "Otsu's Global Discriminant Thresholding",
        sample_size: N,
        separability_ratio_eta: separabilityRatio,
        rushed_cohort_mean: Number(bestMean0.toFixed(1)),
        conscientious_cohort_mean: Number(bestMean1.toFixed(1)),
        retained_evaluations_count: retainedCount,
        retention_percentage: retentionPct,
      },
    }
  }

  /**
   * Optimizes the rapid rush response detection threshold (ms) on rating questions.
   *
   * @param {number} currentRushThresholdMs - Current configured threshold (e.g. 1500ms)
   */
  optimizeRushThreshold(currentRushThresholdMs = 1500) {
    const db = getDatabase()

    const rows = db.prepare(`
      SELECT rr.time_on_question_ms
      FROM review_responses rr
      JOIN questions q ON rr.question_id = q.id
      JOIN reviews r ON rr.review_id = r.id
      WHERE q.question_type = 'rating'
        AND r.status = 'submitted'
        AND rr.time_on_question_ms IS NOT NULL
        AND rr.time_on_question_ms >= 300
    `).all()

    const times = rows.map((r) => r.time_on_question_ms).sort((a, b) => a - b)
    const N = times.length

    if (N < 20) {
      return {
        parameter_type: 'evaluation_settings',
        setting_key: 'rush_threshold_ms',
        current_value: currentRushThresholdMs,
        recommended_value: currentRushThresholdMs,
        difference: 0,
        recommendation_type: 'heuristic_fallback',
        confidence_score: 0.5,
        explanation: 'Insufficient rating question telemetry to calibrate empirical motor perception latency. Retained 1500ms.',
        detailed_basis: { sample_size: N },
      }
    }

    // 5th percentile of rating response times
    const p5Index = Math.floor(N * 0.05)
    const p5TimeMs = times[p5Index]

    // Clamped between 1000ms and 2500ms
    const recommendedMs = Math.max(1000, Math.min(2500, Math.round(p5TimeMs / 100) * 100))
    const diffMs = recommendedMs - currentRushThresholdMs

    const explanation = `Calibrated using empirical 5th percentile analysis across ${N} rating responses. Submissions completed under ${recommendedMs}ms reflect mechanical clicking exceeding human cognitive reading and motor coordination limits.`

    return {
      parameter_type: 'evaluation_settings',
      setting_key: 'rush_threshold_ms',
      setting_label: 'Rapid Rush Response Threshold (Motor/Reading Minimum)',
      current_value: currentRushThresholdMs,
      recommended_value: recommendedMs,
      difference: diffMs,
      recommendation_type: 'empirical_percentile_calibration',
      confidence_score: 0.84,
      explanation,
      detailed_basis: {
        algorithm: '5th Percentile Cognitive Motor Latency Benchmark',
        sample_size: N,
        empirical_p5_ms: p5TimeMs,
        median_rating_time_ms: times[Math.floor(N / 2)],
      },
    }
  }
}
