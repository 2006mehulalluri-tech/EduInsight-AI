import { getDatabase } from '../db/connection.js'

/**
 * Computes confidence-aware analytics filtered by RRI threshold.
 *
 * @param {{
 *   course_id?: number,
 *   facultyUserId?: number,
 *   rri_threshold?: number,
 * }} filters
 */
export function getConfidenceAwareAnalytics(filters = {}) {
  const db = getDatabase()
  const threshold = Math.max(0, Math.min(100, Number(filters.rri_threshold ?? 0)))

  // Base scope conditions (course or faculty)
  const scopeConditions = ["r.status = 'submitted'"]
  const scopeParams = []

  if (filters.course_id) {
    scopeConditions.push('r.course_id = ?')
    scopeParams.push(filters.course_id)
  }

  if (filters.facultyUserId) {
    scopeConditions.push(`r.course_id IN (
      SELECT cf.course_id FROM course_faculty cf
      JOIN faculty f ON f.id = cf.faculty_id
      WHERE f.user_id = ?
    )`)
    scopeParams.push(filters.facultyUserId)
  }

  const scopeWhere = scopeConditions.join(' AND ')

  // 1. Total reviews in scope (regardless of threshold)
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS total_count FROM reviews r WHERE ${scopeWhere}`)
    .get(...scopeParams)
  const totalReviews = totalRow?.total_count || 0

  // 2. Retained reviews (where rri_score >= threshold)
  const retainedWhere = `${scopeWhere} AND r.rri_score >= ?`
  const retainedParams = [...scopeParams, threshold]

  const retainedSummary = db
    .prepare(
      `SELECT 
        COUNT(*) AS count_above,
        ROUND(AVG(r.rri_score), 1) AS avg_rri,
        ROUND(AVG(r.average_rating), 2) AS avg_rating,
        ROUND(AVG(r.total_duration_ms), 0) AS avg_duration_ms,
        SUM(CASE WHEN r.sentiment_label = 'positive' THEN 1 ELSE 0 END) AS pos_count,
        SUM(CASE WHEN r.sentiment_label = 'neutral' THEN 1 ELSE 0 END) AS neu_count,
        SUM(CASE WHEN r.sentiment_label = 'negative' THEN 1 ELSE 0 END) AS neg_count
       FROM reviews r
       WHERE ${retainedWhere}`,
    )
    .get(...retainedParams)

  const reviewsAbove = retainedSummary?.count_above || 0
  const avgRri = retainedSummary?.avg_rri || 0
  const avgRating = retainedSummary?.avg_rating || 0
  const avgDurationMs = retainedSummary?.avg_duration_ms || 0
  const posCount = retainedSummary?.pos_count || 0
  const neuCount = retainedSummary?.neu_count || 0
  const negCount = retainedSummary?.neg_count || 0

  const retentionPct = totalReviews > 0 ? Number(((reviewsAbove / totalReviews) * 100).toFixed(1)) : 0
  const posPct = reviewsAbove > 0 ? Number(((posCount / reviewsAbove) * 100).toFixed(1)) : 0
  const neuPct = reviewsAbove > 0 ? Number(((neuCount / reviewsAbove) * 100).toFixed(1)) : 0
  const negPct = reviewsAbove > 0 ? Number(((negCount / reviewsAbove) * 100).toFixed(1)) : 0

  // 3. RRI Score Distribution (5 bins across retained or total)
  const rriDistributionRows = db
    .prepare(
      `SELECT 
        CASE 
          WHEN r.rri_score < 20 THEN '0-20 (Critical Rush)'
          WHEN r.rri_score < 40 THEN '20-40 (Low Confidence)'
          WHEN r.rri_score < 60 THEN '40-60 (Moderate)'
          WHEN r.rri_score < 80 THEN '60-80 (Reliable)'
          ELSE '80-100 (Highly Conscientious)'
        END AS rri_band,
        COUNT(*) AS count
       FROM reviews r
       WHERE ${scopeWhere}
       GROUP BY rri_band
       ORDER BY MIN(r.rri_score) ASC`,
    )
    .all(...scopeParams)

  const standardBands = [
    { band: '0-20 (Critical Rush)', min: 0, max: 20 },
    { band: '20-40 (Low Confidence)', min: 20, max: 40 },
    { band: '40-60 (Moderate)', min: 40, max: 60 },
    { band: '60-80 (Reliable)', min: 60, max: 80 },
    { band: '80-100 (Highly Conscientious)', min: 80, max: 100 },
  ]
  const bandCounts = new Map(rriDistributionRows.map((r) => [r.rri_band, r.count]))
  const rriDistribution = standardBands.map((b) => ({
    band: b.band,
    count: bandCounts.get(b.band) || 0,
    isAboveThreshold: b.max > threshold,
  }))

  // 4. Rating Distribution for retained reviews (1-5 stars)
  const ratingDistRows = db
    .prepare(
      `SELECT 
        ROUND(r.average_rating) AS star_rating,
        COUNT(*) AS count
       FROM reviews r
       WHERE ${retainedWhere} AND r.average_rating IS NOT NULL
       GROUP BY ROUND(r.average_rating)
       ORDER BY star_rating ASC`,
    )
    .all(...retainedParams)

  const ratingMap = new Map(ratingDistRows.map((r) => [r.star_rating, r.count]))
  const ratingDistribution = [1, 2, 3, 4, 5].map((star) => ({
    rating: `${star} Star${star > 1 ? 's' : ''}`,
    star,
    count: ratingMap.get(star) || 0,
  }))

  // 5. Sentiment Distribution
  const sentimentDistribution = [
    { label: 'Positive', count: posCount, percentage: posPct, color: '#10b981' },
    { label: 'Neutral', count: neuCount, percentage: neuPct, color: '#64748b' },
    { label: 'Negative', count: negCount, percentage: negPct, color: '#ef4444' },
  ]

  // 6. Question-level Average Response Time vs Expected
  // Analyze across retained reviews to observe behavioral differences
  const responseTimeRows = db
    .prepare(
      `SELECT 
        q.position,
        SUBSTR(q.prompt, 1, 35) || '...' AS short_prompt,
        q.prompt AS full_prompt,
        q.expected_response_time_ms / 1000 AS expected_sec,
        ROUND(AVG(rr.time_on_question_ms) / 1000, 1) AS actual_sec
       FROM review_responses rr
       JOIN questions q ON q.id = rr.question_id
       JOIN reviews r ON r.id = rr.review_id
       WHERE ${retainedWhere}
       GROUP BY q.id
       ORDER BY q.position ASC
       LIMIT 15`,
    )
    .all(...retainedParams)

  // 7. RRI vs Rating Correlation (demonstrating independence of sentiment & rating from RRI)
  const rriVsRatingRows = db
    .prepare(
      `SELECT 
        r.id,
        r.rri_score,
        r.average_rating,
        r.sentiment_label,
        r.total_duration_ms / 1000 AS duration_sec
       FROM reviews r
       WHERE ${retainedWhere} AND r.average_rating IS NOT NULL
       ORDER BY r.id DESC
       LIMIT 50`,
    )
    .all(...retainedParams)

  // 8. RRI & Reviews by Course
  const rriByCourseRows = db
    .prepare(
      `SELECT 
        c.id AS course_id,
        c.code AS course_code,
        c.title AS course_title,
        COUNT(r.id) AS total_reviews,
        ROUND(AVG(r.rri_score), 1) AS avg_rri,
        ROUND(AVG(r.average_rating), 2) AS avg_rating,
        SUM(CASE WHEN r.sentiment_label = 'positive' THEN 1 ELSE 0 END) AS pos_count,
        SUM(CASE WHEN r.sentiment_label = 'neutral' THEN 1 ELSE 0 END) AS neu_count,
        SUM(CASE WHEN r.sentiment_label = 'negative' THEN 1 ELSE 0 END) AS neg_count
       FROM courses c
       JOIN reviews r ON r.course_id = c.id AND r.status = 'submitted' AND r.rri_score >= ?
       ${filters.facultyUserId ? `WHERE c.id IN (SELECT cf.course_id FROM course_faculty cf JOIN faculty f ON f.id = cf.faculty_id WHERE f.user_id = ${Number(filters.facultyUserId)})` : ''}
       GROUP BY c.id
       ORDER BY c.code ASC`,
    )
    .all(threshold)

  // 9. Qualitative Feedback Highlights & Point Summary (for reviews >= threshold)
  const textFeedbackRows = db
    .prepare(
      `SELECT 
        rr.answer_json,
        r.rri_score,
        r.sentiment_label,
        r.average_rating,
        q.prompt
       FROM review_responses rr
       JOIN questions q ON q.id = rr.question_id
       JOIN reviews r ON r.id = rr.review_id
       WHERE ${retainedWhere} AND q.question_type = 'text'
       ORDER BY r.rri_score DESC
       LIMIT 60`,
    )
    .all(...retainedParams)

  const positiveHighlights = []
  const areasForImprovement = []
  const generalSuggestions = []

  const trivialPattern = /^(good|ok|fine|nice|nil|none|n\/a|nothing|satisfactory|\.)$/i

  for (const row of textFeedbackRows) {
    let text = ''
    try {
      text = JSON.parse(row.answer_json)
    } catch {
      text = row.answer_json
    }

    if (!text || typeof text !== 'string') continue
    const trimmed = text.trim()
    if (trimmed.length < 8 || trivialPattern.test(trimmed)) continue

    const promptLower = (row.prompt || '').toLowerCase()
    const item = {
      comment: trimmed,
      rri_score: row.rri_score,
      rating: row.average_rating,
      sentiment: row.sentiment_label,
    }

    if (promptLower.includes('good') || promptLower.includes('strength') || row.sentiment_label === 'positive') {
      if (!positiveHighlights.some((h) => h.comment === trimmed) && positiveHighlights.length < 8) {
        positiveHighlights.push(item)
      }
    } else if (
      promptLower.includes('improve') ||
      promptLower.includes('area') ||
      row.sentiment_label === 'negative'
    ) {
      if (!areasForImprovement.some((a) => a.comment === trimmed) && areasForImprovement.length < 8) {
        areasForImprovement.push(item)
      }
    } else {
      if (!generalSuggestions.some((s) => s.comment === trimmed) && generalSuggestions.length < 8) {
        generalSuggestions.push(item)
      }
    }
  }

  return {
    threshold,
    summary: {
      total_reviews: totalReviews,
      reviews_above_threshold: reviewsAbove,
      retention_rate_pct: retentionPct,
      average_rri: avgRri,
      average_rating: avgRating,
      average_duration_sec: Math.round(avgDurationMs / 1000),
      sentiment: {
        positive_count: posCount,
        neutral_count: neuCount,
        negative_count: negCount,
        positive_pct: posPct,
        neutral_pct: neuPct,
        negative_pct: negPct,
      },
    },
    charts: {
      rri_distribution: rriDistribution,
      rating_distribution: ratingDistribution,
      sentiment_distribution: sentimentDistribution,
      avg_response_time: responseTimeRows,
      rri_vs_rating: rriVsRatingRows,
      rri_by_course: rriByCourseRows,
    },
    feedback_summary: {
      positive_highlights: positiveHighlights,
      areas_for_improvement: areasForImprovement,
      general_suggestions: generalSuggestions,
    },
  }
}
