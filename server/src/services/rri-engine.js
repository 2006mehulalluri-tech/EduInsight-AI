/**
 * Review Reliability Index (RRI) Engine
 *
 * Core Novelty:
 * Enhances institutional insight quality by estimating review reliability (0-100)
 * based on question-level behavioral tracking and expected response times.
 *
 * IMPORTANT:
 * Positive sentiment != reliable review.
 * Negative sentiment != unreliable review.
 * Sentiment analysis does NOT contribute to RRI.
 */

export const DEFAULT_RRI_WEIGHTS = {
  time_score: 25,
  time_variance: 15,
  rush_score: 15,
  reflection_score: 10,
  behavioral_consistency: 15,
  response_consistency: 10,
  answer_changes: 5,
  question_revisits: 5,
}

/**
 * Calculates the explainable Review Reliability Index (RRI) and component metrics.
 *
 * @param {Array<{
 *   question_id: number,
 *   prompt?: string,
 *   question_type: 'rating' | 'text',
 *   expected_response_time_ms: number,
 *   time_on_question_ms: number,
 *   change_count: number,
 *   revisit_count: number,
 *   answer: any,
 *   text_metadata?: { typing_duration_ms?: number, char_count?: number, word_count?: number }
 * }>} responses
 * @param {typeof DEFAULT_RRI_WEIGHTS} [customWeights]
 * @returns {{
 *   rri: number,
 *   components: {
 *     time_score: number,
 *     time_variance: number,
 *     rush_score: number,
 *     reflection_score: number,
 *     behavioral_consistency: number,
 *     response_consistency: number,
 *     answer_changes: number,
 *     question_revisits: number,
 *   },
 *   weights: typeof DEFAULT_RRI_WEIGHTS,
 *   total_duration_ms: number,
 *   average_question_time_ms: number,
 *   rapid_response_count: number,
 *   answer_change_count: number,
 *   revisit_count: number,
 *   reasons: string[],
 * }}
 */
export function calculateRRI(responses, customWeights = {}) {
  const weights = { ...DEFAULT_RRI_WEIGHTS, ...customWeights }
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + Number(w || 0), 0) || 100

  if (!Array.isArray(responses) || responses.length === 0) {
    return {
      rri: 50,
      components: {
        time_score: 50,
        time_variance: 50,
        rush_score: 50,
        reflection_score: 50,
        behavioral_consistency: 50,
        response_consistency: 50,
        answer_changes: 50,
        question_revisits: 50,
      },
      weights,
      total_duration_ms: 0,
      average_question_time_ms: 0,
      rapid_response_count: 0,
      answer_change_count: 0,
      revisit_count: 0,
      reasons: ['No question responses provided for evaluation.'],
    }
  }

  const reasons = []
  const questionCount = responses.length

  // Aggregated totals
  let totalDurationMs = 0
  let totalChanges = 0
  let totalRevisits = 0
  let rapidCount = 0

  const timePerQuestion = []
  const expectedPerQuestion = []
  const ratingValues = []
  const textResponses = []

  for (const resp of responses) {
    const actualTime = Math.max(100, Number(resp.time_on_question_ms) || 0)
    const expectedTime = Math.max(1000, Number(resp.expected_response_time_ms) || 10000)
    const changes = Math.max(0, Number(resp.change_count) || 0)
    const revisits = Math.max(0, Number(resp.revisit_count) || 0)

    totalDurationMs += actualTime
    totalChanges += changes
    totalRevisits += revisits

    timePerQuestion.push(actualTime)
    expectedPerQuestion.push(expectedTime)

    // Flag rapid rush (< 25% of expected time or < 1500ms for ratings)
    const isRapid = actualTime < expectedTime * 0.25 || (resp.question_type === 'rating' && actualTime < 1500)
    if (isRapid) {
      rapidCount += 1
    }

    if (resp.question_type === 'rating' && resp.answer !== null && resp.answer !== undefined) {
      const num = Number(resp.answer)
      if (!Number.isNaN(num)) {
        ratingValues.push(num)
      }
    }

    if (resp.question_type === 'text' && typeof resp.answer === 'string') {
      textResponses.push({
        text: resp.answer.trim(),
        timeMs: actualTime,
        typingDurationMs: Number(resp.text_metadata?.typing_duration_ms) || actualTime * 0.8,
        charCount: Number(resp.text_metadata?.char_count) || resp.answer.trim().length,
        wordCount: Number(resp.text_metadata?.word_count) || resp.answer.trim().split(/\s+/).filter(Boolean).length,
      })
    }
  }

  const avgQuestionTimeMs = totalDurationMs / questionCount

  // 1. Time Score (25%) - Comparison against expected response times
  let timeScoreSum = 0
  for (let i = 0; i < questionCount; i++) {
    const ratio = timePerQuestion[i] / expectedPerQuestion[i]
    let qScore = 100
    if (ratio < 0.15) {
      qScore = Math.max(5, ratio * 200)
    } else if (ratio < 0.6) {
      qScore = 30 + ((ratio - 0.15) / 0.45) * 65
    } else if (ratio <= 2.5) {
      qScore = 100
    } else if (ratio <= 6.0) {
      qScore = Math.max(60, 100 - (ratio - 2.5) * 11.4)
    } else {
      qScore = 50 // idle dwell
    }
    timeScoreSum += qScore
  }
  const timeScore = clamp(timeScoreSum / questionCount)
  if (timeScore >= 85) {
    reasons.push('Response pacing aligns well with expected cognitive processing time.')
  } else if (timeScore < 50) {
    reasons.push('Responses were submitted significantly faster than expected reading time.')
  }

  // 2. Time Variance Score (15%) - Coefficient of variation
  let timeVarianceScore = 100
  if (questionCount > 1) {
    const mean = avgQuestionTimeMs
    const variance =
      timePerQuestion.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (questionCount - 1)
    const stdDev = Math.sqrt(variance)
    const cv = mean > 0 ? stdDev / mean : 0

    if (cv < 0.1) {
      timeVarianceScore = 25 // bot or rapid identical clicker
      reasons.push('Unusually uniform question durations indicate mechanical clicking.')
    } else if (cv < 0.3) {
      timeVarianceScore = 25 + ((cv - 0.1) / 0.2) * 65
    } else if (cv <= 1.2) {
      timeVarianceScore = 100
      reasons.push('Natural timing variations between different questions.')
    } else {
      timeVarianceScore = Math.max(55, 100 - (cv - 1.2) * 25)
    }
  }
  timeVarianceScore = clamp(timeVarianceScore)

  // 3. Rush Score (15%) - Proportion of un-rushed questions
  const unRushedRatio = 1 - rapidCount / questionCount
  const rushScore = clamp(unRushedRatio * 100)
  if (rapidCount === 0) {
    reasons.push('Zero rushed questions detected.')
  } else if (rapidCount >= questionCount * 0.5) {
    reasons.push(`Over 50% of questions (${rapidCount}/${questionCount}) were answered hastily.`)
  }

  // 4. Reflection Score (10%) - Open-text richness or reading depth
  let reflectionScore = 80
  if (textResponses.length > 0) {
    let textScoreSum = 0
    for (const item of textResponses) {
      const len = item.charCount
      const words = item.wordCount
      const typingTime = item.typingDurationMs

      if (len === 0) {
        textScoreSum += 30 // blank optional text
      } else if (words <= 2 && len < 10) {
        // very short trivial reply: "good", "ok", "nice"
        textScoreSum += 40
      } else if (words >= 15 && typingTime >= 4000) {
        // thoughtful detailed comment
        textScoreSum += 100
      } else {
        textScoreSum += 50 + Math.min(45, words * 4)
      }
    }
    reflectionScore = clamp(textScoreSum / textResponses.length)
    if (reflectionScore >= 85) {
      reasons.push('Substantive, reflective qualitative feedback provided.')
    } else if (reflectionScore < 50) {
      reasons.push('Open-text feedback was minimal or generic.')
    }
  } else {
    // If only rating questions exist, evaluate overall reading speed
    reflectionScore = clamp(Math.min(100, (avgQuestionTimeMs / 6000) * 100))
  }

  // 5. Behavioral Consistency Score (15%) - Pace stability (first half vs second half)
  let behavioralConsistencyScore = 100
  if (questionCount >= 4) {
    const half = Math.floor(questionCount / 2)
    const firstHalfAvg =
      timePerQuestion.slice(0, half).reduce((a, b) => a + b, 0) / half
    const secondHalfAvg =
      timePerQuestion.slice(half).reduce((a, b) => a + b, 0) / (questionCount - half)

    if (firstHalfAvg > 0) {
      const decayRatio = secondHalfAvg / firstHalfAvg
      if (decayRatio < 0.2) {
        behavioralConsistencyScore = 40 // severe fatigue rush at end
        reasons.push('Severe response speed drop-off toward survey completion.')
      } else if (decayRatio < 0.45) {
        behavioralConsistencyScore = 70
      } else {
        behavioralConsistencyScore = 95
      }
    }
  }
  behavioralConsistencyScore = clamp(behavioralConsistencyScore)

  // 6. Response Consistency Score (10%) - Straight-lining detection
  let responseConsistencyScore = 95
  if (ratingValues.length >= 4) {
    const rMean = ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
    const rVar =
      ratingValues.reduce((acc, val) => acc + Math.pow(val - rMean, 2), 0) / ratingValues.length

    if (rVar === 0) {
      // Straight-lining (all 5s or all 1s)
      if (avgQuestionTimeMs < 4000) {
        responseConsistencyScore = 25
        reasons.push('Straight-lining detected: identical rating given to all items with rapid completion.')
      } else {
        responseConsistencyScore = 60
        reasons.push('Uniform rating across all questions, but with normal reading duration.')
      }
    } else if (rVar < 0.2) {
      responseConsistencyScore = 75
    } else {
      responseConsistencyScore = 100
      reasons.push('Differentiated ratings reflect nuanced evaluation across diverse criteria.')
    }
  }
  responseConsistencyScore = clamp(responseConsistencyScore)

  // 7. Answer Changes Score (5%) - Deliberation indicator
  let answerChangesScore = 85
  if (totalChanges >= 1 && totalChanges <= 4) {
    answerChangesScore = 100
    reasons.push('Answer modifications show careful consideration prior to submission.')
  } else if (totalChanges === 0) {
    answerChangesScore = 85
  } else if (totalChanges > 8) {
    answerChangesScore = 65
    reasons.push('Frequent answer revisions indicate possible uncertainty or fluctuation.')
  }
  answerChangesScore = clamp(answerChangesScore)

  // 8. Question Revisits Score (5%) - Navigation review indicator
  let revisitsScore = 85
  if (totalRevisits >= 1 && totalRevisits <= 5) {
    revisitsScore = 100
    reasons.push('Student revisited earlier questions to verify and review entries.')
  } else if (totalRevisits === 0) {
    revisitsScore = 85
  } else if (totalRevisits > 12) {
    revisitsScore = 70
  }
  revisitsScore = clamp(revisitsScore)

  // Weighted RRI composite calculation
  const weightedSum =
    timeScore * (weights.time_score / totalWeight) +
    timeVarianceScore * (weights.time_variance / totalWeight) +
    rushScore * (weights.rush_score / totalWeight) +
    reflectionScore * (weights.reflection_score / totalWeight) +
    behavioralConsistencyScore * (weights.behavioral_consistency / totalWeight) +
    responseConsistencyScore * (weights.response_consistency / totalWeight) +
    answerChangesScore * (weights.answer_changes / totalWeight) +
    revisitsScore * (weights.question_revisits / totalWeight)

  const finalRRI = Number(clamp(weightedSum).toFixed(1))

  return {
    rri: finalRRI,
    components: {
      time_score: Number(timeScore.toFixed(1)),
      time_variance: Number(timeVarianceScore.toFixed(1)),
      rush_score: Number(rushScore.toFixed(1)),
      reflection_score: Number(reflectionScore.toFixed(1)),
      behavioral_consistency: Number(behavioralConsistencyScore.toFixed(1)),
      response_consistency: Number(responseConsistencyScore.toFixed(1)),
      answer_changes: Number(answerChangesScore.toFixed(1)),
      question_revisits: Number(revisitsScore.toFixed(1)),
    },
    weights,
    total_duration_ms: Math.round(totalDurationMs),
    average_question_time_ms: Math.round(avgQuestionTimeMs),
    rapid_response_count: rapidCount,
    answer_change_count: totalChanges,
    revisit_count: totalRevisits,
    reasons,
  }
}

function clamp(value, min = 0, max = 100) {
  if (Number.isNaN(value) || value === null || value === undefined) return 50
  return Math.max(min, Math.min(max, value))
}
