import { useEffect, useState } from 'react'
import { getReviewById } from '../../api.js'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Info,
  RotateCcw,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react'

export default function ReviewDetailModal({ reviewId, onClose }) {
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    setLoading(true)

    getReviewById(reviewId)
      .then((data) => {
        if (isCurrent) setReview(data.review)
      })
      .catch((err) => {
        if (isCurrent) setError(err.message || 'Failed to load review details')
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [reviewId])

  if (!reviewId) return null

  const getRriColor = (score) => {
    if (score >= 80) return 'score-excellent'
    if (score >= 60) return 'score-good'
    if (score >= 40) return 'score-moderate'
    return 'score-poor'
  }

  const getRriLabel = (score) => {
    if (score >= 80) return 'Highly Conscientious & Reliable'
    if (score >= 60) return 'Moderately Reliable'
    if (score >= 40) return 'Low Cognitive Reflection'
    return 'Severe Rush / Inconsistent'
  }

  const breakdown = review?.metrics?.breakdown || {}
  const components = breakdown.components || review?.metrics || {}
  const reasons = breakdown.reasons || []

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window review-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="modal-eyebrow">Explainable Reliability Audit</span>
            <h2 className="modal-title">Review Reliability Details #{reviewId}</h2>
            {review && (
              <p className="modal-subtitle">
                {review.course_code}: {review.course_title} ({review.course_department})
              </p>
            )}
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              <p>Analyzing behavioral telemetry and computing component metrics...</p>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {review && (
            <div className="detail-content-grid">
              {/* Top Summary Banner: RRI Score & Sentiment (Orthogonal outputs) */}
              <div className="rri-score-banner">
                <div className={`rri-gauge-card ${getRriColor(review.rri_score)}`}>
                  <div className="gauge-header">
                    <span>REVIEW RELIABILITY INDEX</span>
                    <span className="info-chip">RRI</span>
                  </div>
                  <div className="gauge-score-value">
                    <span className="score-num">{review.rri_score}</span>
                    <span className="score-max">/ 100</span>
                  </div>
                  <div className="gauge-badge">{getRriLabel(review.rri_score)}</div>
                  <p className="gauge-note">
                    Calculated from 8 question-level behavioral metrics comparing actual vs. expected
                    response times.
                  </p>
                </div>

                <div className="sentiment-card">
                  <div className="card-top">
                    <span>INDEPENDENT SENTIMENT</span>
                    <span className={`badge badge-sentiment-${review.sentiment_label}`}>
                      {review.sentiment_label?.toUpperCase() || 'NEUTRAL'}
                    </span>
                  </div>
                  <div className="sentiment-value-box">
                    <span className="sentiment-label-text">
                      {review.sentiment_label === 'positive' && 'Positive Feedback'}
                      {review.sentiment_label === 'negative' && 'Critical / Negative Feedback'}
                      {review.sentiment_label === 'neutral' && 'Neutral Feedback'}
                    </span>
                    <span className="sentiment-polarity">
                      Polarity Score: {review.sentiment_score ?? 0}
                    </span>
                  </div>
                  <div className="sentiment-callout">
                    <Info size={16} />
                    <span>
                      <strong>Core Project Principle:</strong> Sentiment analysis is strictly separate
                      from RRI. Critical feedback with high reflection receives a high RRI score.
                    </span>
                  </div>
                </div>

                <div className="meta-card">
                  <div className="card-top">
                    <span>EVALUATION TELEMETRY</span>
                    <span className="badge badge-outline">
                      {review.is_demo ? 'Synthetic Demo' : 'Live Submission'}
                    </span>
                  </div>
                  <dl className="telemetry-list">
                    <div>
                      <dt>Average Rating</dt>
                      <dd className="telemetry-val">
                        ⭐ {review.average_rating ? `${review.average_rating} / 5.0` : 'N/A'}
                      </dd>
                    </div>
                    <div>
                      <dt>Total Duration</dt>
                      <dd className="telemetry-val">
                        {Math.round((review.total_duration_ms || 0) / 1000)}s (
                        {(Math.round((review.total_duration_ms || 0) / 1000) / 60).toFixed(1)} min)
                      </dd>
                    </div>
                    <div>
                      <dt>Answer Changes</dt>
                      <dd className="telemetry-val">{review.metrics?.answer_change_count || 0}</dd>
                    </div>
                    <div>
                      <dt>Question Revisits</dt>
                      <dd className="telemetry-val">{review.metrics?.revisit_count || 0}</dd>
                    </div>
                    <div>
                      <dt>Reviewer</dt>
                      <dd className="telemetry-val anonymized-val">
                        {review.student?.student_name} ({review.student?.student_id})
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Diagnostic Reasons (Explainability) */}
              <div className="explainability-section">
                <h3 className="section-title">
                  <Sparkles size={18} />
                  <span>Explainability Breakdown: Why this Review scored {review.rri_score}/100</span>
                </h3>
                <ul className="reasons-list">
                  {reasons.length > 0 ? (
                    reasons.map((reason, idx) => (
                      <li key={idx} className="reason-item">
                        <CheckCircle2 size={16} className="reason-icon" />
                        <span>{reason}</span>
                      </li>
                    ))
                  ) : (
                    <li className="reason-item">
                      <CheckCircle2 size={16} className="reason-icon" />
                      <span>Consistent timing and response patterns observed throughout the survey.</span>
                    </li>
                  )}
                </ul>
              </div>

              {/* 8 Component Scores Grid */}
              <div className="components-grid-section">
                <h3 className="section-title">
                  <TrendingUp size={18} />
                  <span>Normalized Component Scores (0 – 100)</span>
                </h3>
                <div className="components-grid">
                  <div className="component-card">
                    <div className="comp-header">
                      <span className="comp-name">Time Score</span>
                      <span className="comp-weight">25% Weight</span>
                    </div>
                    <div className="comp-bar-wrapper">
                      <div
                        className="comp-bar-fill"
                        style={{ width: `${components.time_score || 0}%` }}
                      />
                    </div>
                    <div className="comp-score-row">
                      <span className="comp-score-num">{components.time_score || 0} / 100</span>
                      <span className="comp-desc">Actual vs. Expected Cognitive Time</span>
                    </div>
                  </div>

                  <div className="component-card">
                    <div className="comp-header">
                      <span className="comp-name">Time Variance</span>
                      <span className="comp-weight">15% Weight</span>
                    </div>
                    <div className="comp-bar-wrapper">
                      <div
                        className="comp-bar-fill"
                        style={{ width: `${components.time_variance || 0}%` }}
                      />
                    </div>
                    <div className="comp-score-row">
                      <span className="comp-score-num">{components.time_variance || 0} / 100</span>
                      <span className="comp-desc">Coefficient of Duration Variation</span>
                    </div>
                  </div>

                  <div className="component-card">
                    <div className="comp-header">
                      <span className="comp-name">Rush Score</span>
                      <span className="comp-weight">15% Weight</span>
                    </div>
                    <div className="comp-bar-wrapper">
                      <div
                        className="comp-bar-fill"
                        style={{ width: `${components.rush_score || 0}%` }}
                      />
                    </div>
                    <div className="comp-score-row">
                      <span className="comp-score-num">{components.rush_score || 0} / 100</span>
                      <span className="comp-desc">Proportion of Unrushed Questions</span>
                    </div>
                  </div>

                  <div className="component-card">
                    <div className="comp-header">
                      <span className="comp-name">Reflection Score</span>
                      <span className="comp-weight">10% Weight</span>
                    </div>
                    <div className="comp-bar-wrapper">
                      <div
                        className="comp-bar-fill"
                        style={{ width: `${components.reflection_score || 0}%` }}
                      />
                    </div>
                    <div className="comp-score-row">
                      <span className="comp-score-num">{components.reflection_score || 0} / 100</span>
                      <span className="comp-desc">Qualitative Open-Text Depth</span>
                    </div>
                  </div>

                  <div className="component-card">
                    <div className="comp-header">
                      <span className="comp-name">Behavioral Consistency</span>
                      <span className="comp-weight">15% Weight</span>
                    </div>
                    <div className="comp-bar-wrapper">
                      <div
                        className="comp-bar-fill"
                        style={{ width: `${components.behavioral_consistency || 0}%` }}
                      />
                    </div>
                    <div className="comp-score-row">
                      <span className="comp-score-num">
                        {components.behavioral_consistency || 0} / 100
                      </span>
                      <span className="comp-desc">Pacing Cadence & Fatigue Resistance</span>
                    </div>
                  </div>

                  <div className="component-card">
                    <div className="comp-header">
                      <span className="comp-name">Response Consistency</span>
                      <span className="comp-weight">10% Weight</span>
                    </div>
                    <div className="comp-bar-wrapper">
                      <div
                        className="comp-bar-fill"
                        style={{ width: `${components.response_consistency || 0}%` }}
                      />
                    </div>
                    <div className="comp-score-row">
                      <span className="comp-score-num">
                        {components.response_consistency || 0} / 100
                      </span>
                      <span className="comp-desc">Straight-lining & Differentiated Rating</span>
                    </div>
                  </div>

                  <div className="component-card">
                    <div className="comp-header">
                      <span className="comp-name">Answer Changes</span>
                      <span className="comp-weight">5% Weight</span>
                    </div>
                    <div className="comp-bar-wrapper">
                      <div
                        className="comp-bar-fill"
                        style={{ width: `${components.answer_changes || 0}%` }}
                      />
                    </div>
                    <div className="comp-score-row">
                      <span className="comp-score-num">{components.answer_changes || 0} / 100</span>
                      <span className="comp-desc">Deliberative Revisions</span>
                    </div>
                  </div>

                  <div className="component-card">
                    <div className="comp-header">
                      <span className="comp-name">Question Revisits</span>
                      <span className="comp-weight">5% Weight</span>
                    </div>
                    <div className="comp-bar-wrapper">
                      <div
                        className="comp-bar-fill"
                        style={{ width: `${components.question_revisits || 0}%` }}
                      />
                    </div>
                    <div className="comp-score-row">
                      <span className="comp-score-num">
                        {components.question_revisits || 0} / 100
                      </span>
                      <span className="comp-desc">Survey Back-Navigation Checks</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Question-by-Question Response Audit Table */}
              <div className="question-responses-section">
                <h3 className="section-title">
                  <Clock size={18} />
                  <span>Question-Level Behavioral Telemetry</span>
                </h3>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Question Prompt</th>
                        <th>Type</th>
                        <th>Expected</th>
                        <th>Actual Time</th>
                        <th>Changes</th>
                        <th>Revisits</th>
                        <th>Student Answer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {review.responses?.map((r) => {
                        const actualSec = ((r.time_on_question_ms || 0) / 1000).toFixed(1)
                        const expectedSec = ((r.expected_response_time_ms || 10000) / 1000).toFixed(0)
                        const isRushed = (r.time_on_question_ms || 0) < (r.expected_response_time_ms || 10000) * 0.25

                        return (
                          <tr key={r.id}>
                            <td className="font-mono">{r.position}</td>
                            <td className="prompt-cell">{r.prompt}</td>
                            <td>
                              <span className={`badge badge-sm badge-${r.question_type}`}>
                                {r.question_type}
                              </span>
                            </td>
                            <td className="font-mono">{expectedSec}s</td>
                            <td>
                              <span
                                className={`time-badge ${isRushed ? 'time-rushed' : 'time-normal'}`}
                              >
                                {actualSec}s {isRushed && '⚡ Rushed'}
                              </span>
                            </td>
                            <td className="text-center">{r.change_count || 0}</td>
                            <td className="text-center">{r.revisit_count || 0}</td>
                            <td className="answer-cell">
                              {r.question_type === 'rating' ? (
                                <span className="rating-pill">⭐ {r.answer} / 5</span>
                              ) : (
                                <span className="text-comment-display">"{r.answer}"</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
