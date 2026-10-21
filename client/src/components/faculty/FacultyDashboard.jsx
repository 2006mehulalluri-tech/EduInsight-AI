import { useEffect, useState } from 'react'
import { getAnalytics, getCourses, getReviews } from '../../api.js'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Layers,
  Lightbulb,
  MessageSquareQuote,
  Search,
  Sliders,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  User,
  UserCheck,
} from 'lucide-react'
import ReviewDetailModal from '../common/ReviewDetailModal.jsx'

export default function FacultyDashboard({ overrideCourseId = null, onBackToCourseList = null }) {
  const [courses, setCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState(overrideCourseId || '')
  const [rriThreshold, setRriThreshold] = useState(60) // Default threshold 60
  const [analytics, setAnalytics] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters for review table
  const [searchTerm, setSearchTerm] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState('')
  const [minRatingFilter, setMinRatingFilter] = useState('')
  const [selectedReviewId, setSelectedReviewId] = useState(null)

  // Feedback summary tab: 'positive' | 'improvement' | 'suggestions'
  const [feedbackTab, setFeedbackTab] = useState('positive')

  // Load faculty's assigned courses
  useEffect(() => {
    getCourses()
      .then((data) => {
        setCourses(data.courses || [])
        // If an override course was passed or if faculty has courses, select first
        if (overrideCourseId) {
          setSelectedCourseId(overrideCourseId)
        }
      })
      .catch((err) => {
        console.error('Failed to load assigned courses:', err)
      })
  }, [overrideCourseId])

  // Load confidence-aware analytics and reviews
  useEffect(() => {
    let isCurrent = true
    setLoading(true)

    const fetchAll = async () => {
      try {
        const [analyticsData, reviewsData] = await Promise.all([
          getAnalytics(rriThreshold, selectedCourseId),
          getReviews({
            course_id: selectedCourseId || undefined,
            rri_threshold: rriThreshold,
            sentiment_label: sentimentFilter || undefined,
            min_rating: minRatingFilter || undefined,
            search: searchTerm || undefined,
          }),
        ])

        if (isCurrent) {
          setAnalytics(analyticsData)
          setReviews(reviewsData.reviews || [])
        }
      } catch (err) {
        if (isCurrent) setError(err.message || 'Failed to calculate confidence analytics')
      } finally {
        if (isCurrent) setLoading(false)
      }
    }

    fetchAll()

    return () => {
      isCurrent = false
    }
  }, [selectedCourseId, rriThreshold, sentimentFilter, minRatingFilter, searchTerm])

  const summary = analytics?.summary || {}
  const charts = analytics?.charts || {}
  const feedbackSummary = analytics?.feedback_summary || {
    positive_highlights: [],
    areas_for_improvement: [],
    general_suggestions: [],
  }

  const selectedCourseObj = courses.find((c) => String(c.id) === String(selectedCourseId))

  const SENTIMENT_COLORS = {
    Positive: '#10b981',
    Neutral: '#64748b',
    Negative: '#ef4444',
  }

  return (
    <div className="faculty-dashboard container">
      {/* Top Header & Course Filter */}
      <div className="dashboard-header">
        <div>
          {onBackToCourseList && (
            <button
              type="button"
              className="btn btn-secondary btn-sm mb-2"
              onClick={onBackToCourseList}
            >
              ← Back to Course Overview Hierarchy
            </button>
          )}
          <span className="page-eyebrow">Faculty Analytics & Evaluation Insights</span>
          <h2 className="page-title">
            {selectedCourseObj
              ? `${selectedCourseObj.code}: ${selectedCourseObj.title}`
              : 'Assigned Courses Analytics'}
          </h2>
          <p className="page-description">
            Faculty views are strictly scoped to your assigned subjects. Adjust the Review
            Reliability Index (RRI) slider below to filter out rushed feedback and derive
            confidence-aware insights.
          </p>
        </div>

        {/* Course Dropdown */}
        {!overrideCourseId && (
          <div className="course-select-box">
            <label htmlFor="course-select">Select Assigned Course:</label>
            <select
              id="course-select"
              className="form-select"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
            >
              <option value="">All My Assigned Subjects ({courses.length})</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}: {c.title} ({c.course_type || 'Theory'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* CORE NOVELTY: Interactive RRI Threshold Slider */}
      <section className="threshold-control-panel">
        <div className="slider-header-row">
          <div className="slider-title-group">
            <Sliders size={22} className="slider-icon" />
            <div>
              <h3 className="slider-title">Confidence Threshold Filter (RRI)</h3>
              <p className="slider-subtitle">
                Only student evaluations with <strong>RRI ≥ {rriThreshold}</strong> are factored
                into the metrics, charts, and qualitative summaries below.
              </p>
            </div>
          </div>
          <div className="threshold-display-badge">
            <span className="thresh-label">Selected RRI Cutoff:</span>
            <span className="thresh-val">{rriThreshold}</span>
            <span className="thresh-max">/ 100</span>
          </div>
        </div>

        <div className="slider-container">
          <input
            type="range"
            min="0"
            max="95"
            step="5"
            value={rriThreshold}
            onChange={(e) => setRriThreshold(Number(e.target.value))}
            className="rri-range-slider"
          />
          <div className="slider-scale-ticks">
            <span className={rriThreshold === 0 ? 'tick-active' : ''}>0 (All Reviews)</span>
            <span className={rriThreshold === 20 ? 'tick-active' : ''}>20</span>
            <span className={rriThreshold === 40 ? 'tick-active' : ''}>40 (Moderate)</span>
            <span className={rriThreshold === 60 ? 'tick-active' : ''}>60 (Reliable)</span>
            <span className={rriThreshold === 80 ? 'tick-active' : ''}>80 (High Confidence)</span>
            <span className={rriThreshold >= 90 ? 'tick-active' : ''}>95 (Maximum)</span>
          </div>
        </div>

        <div className="threshold-explanation-strip">
          <span className="info-dot" />
          <span>
            Current filter includes <strong>{summary.reviews_above_threshold || 0}</strong> out of{' '}
            <strong>{summary.total_reviews || 0}</strong> submissions (
            <strong>{summary.retention_rate_pct || 0}% retention rate</strong>).
            Unreflective click-throughs and mechanical straight-lined ratings are eliminated.
          </span>
        </div>
      </section>

      {/* KPI Stat Cards Grid */}
      <section className="kpi-cards-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">TOTAL REVIEWS</span>
            <Layers size={18} />
          </div>
          <div className="kpi-val">{summary.total_reviews || 0}</div>
          <p className="kpi-meta">Total evaluations submitted</p>
        </div>

        <div className="kpi-card kpi-highlight-card">
          <div className="kpi-top">
            <span className="kpi-title">REVIEWS ≥ THRESHOLD</span>
            <UserCheck size={18} />
          </div>
          <div className="kpi-val">
            {summary.reviews_above_threshold || 0}
            <span className="kpi-sub"> ({summary.retention_rate_pct || 0}%)</span>
          </div>
          <p className="kpi-meta">High-fidelity evaluations retained</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">AVERAGE RRI</span>
            <Sparkles size={18} />
          </div>
          <div className="kpi-val">{summary.average_rri || 0}</div>
          <p className="kpi-meta">Mean reliability index</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">CONFIDENCE RATING</span>
            <Star size={18} />
          </div>
          <div className="kpi-val">
            ⭐ {summary.average_rating ? `${summary.average_rating} / 5.0` : 'N/A'}
          </div>
          <p className="kpi-meta">Weighted by cognitive dwell time</p>
        </div>

        <div className="kpi-card sentiment-kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">SENTIMENT BALANCE</span>
            <ThumbsUp size={18} />
          </div>
          <div className="sentiment-mini-bars">
            <div className="sent-row">
              <span className="sent-label text-success">Positive</span>
              <span className="sent-pct">{summary.sentiment?.positive_pct || 0}%</span>
            </div>
            <div className="sent-row">
              <span className="sent-label text-muted">Neutral</span>
              <span className="sent-pct">{summary.sentiment?.neutral_pct || 0}%</span>
            </div>
            <div className="sent-row">
              <span className="sent-label text-danger">Negative</span>
              <span className="sent-pct">{summary.sentiment?.negative_pct || 0}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* QUALITATIVE FEEDBACK POINT SUMMARY (Requirement 5) */}
      <section className="feedback-summary-panel">
        <div className="feedback-summary-header">
          <div className="header-icon-title">
            <MessageSquareQuote size={22} className="text-primary" />
            <div>
              <h3>Qualitative Written Feedback Highlights (RRI ≥ {rriThreshold})</h3>
              <p>
                Synthesized student feedback points filtered by cognitive reflection. Only verified
                thoughtful submissions are extracted.
              </p>
            </div>
          </div>

          <div className="feedback-tabs">
            <button
              type="button"
              className={`f-tab ${feedbackTab === 'positive' ? 'active' : ''}`}
              onClick={() => setFeedbackTab('positive')}
            >
              <ThumbsUp size={15} />
              <span>Strengths & Positive Points ({feedbackSummary.positive_highlights?.length || 0})</span>
            </button>
            <button
              type="button"
              className={`f-tab ${feedbackTab === 'improvement' ? 'active' : ''}`}
              onClick={() => setFeedbackTab('improvement')}
            >
              <ThumbsDown size={15} />
              <span>Areas for Improvement ({feedbackSummary.areas_for_improvement?.length || 0})</span>
            </button>
            <button
              type="button"
              className={`f-tab ${feedbackTab === 'suggestions' ? 'active' : ''}`}
              onClick={() => setFeedbackTab('suggestions')}
            >
              <Lightbulb size={15} />
              <span>Key Suggestions ({feedbackSummary.general_suggestions?.length || 0})</span>
            </button>
          </div>
        </div>

        <div className="feedback-summary-body">
          {feedbackTab === 'positive' && (
            <div className="feedback-items-grid">
              {feedbackSummary.positive_highlights?.length === 0 ? (
                <p className="no-feedback-text">No positive written comments meeting threshold.</p>
              ) : (
                feedbackSummary.positive_highlights.map((item, idx) => (
                  <div key={idx} className="feedback-card card-positive">
                    <div className="feedback-card-top">
                      <span className="badge badge-success">✓ Verified Strength</span>
                      <span className="rri-mini-badge">RRI: {item.rri_score}</span>
                    </div>
                    <p className="feedback-text">"{item.comment}"</p>
                    <div className="feedback-card-foot">
                      <span>Rating: ⭐ {item.rating} / 5</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {feedbackTab === 'improvement' && (
            <div className="feedback-items-grid">
              {feedbackSummary.areas_for_improvement?.length === 0 ? (
                <p className="no-feedback-text">No critical comments meeting threshold.</p>
              ) : (
                feedbackSummary.areas_for_improvement.map((item, idx) => (
                  <div key={idx} className="feedback-card card-improvement">
                    <div className="feedback-card-top">
                      <span className="badge badge-danger">⚠️ Constructive Area</span>
                      <span className="rri-mini-badge">RRI: {item.rri_score}</span>
                    </div>
                    <p className="feedback-text">"{item.comment}"</p>
                    <div className="feedback-card-foot">
                      <span>Rating: ⭐ {item.rating} / 5</span>
                      <span className="text-muted text-xs">High Reliability Negative Feedback</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {feedbackTab === 'suggestions' && (
            <div className="feedback-items-grid">
              {feedbackSummary.general_suggestions?.length === 0 ? (
                <p className="no-feedback-text">No general recommendations meeting threshold.</p>
              ) : (
                feedbackSummary.general_suggestions.map((item, idx) => (
                  <div key={idx} className="feedback-card card-suggestion">
                    <div className="feedback-card-top">
                      <span className="badge badge-outline">💡 Curriculum Recommendation</span>
                      <span className="rri-mini-badge">RRI: {item.rri_score}</span>
                    </div>
                    <p className="feedback-text">"{item.comment}"</p>
                    <div className="feedback-card-foot">
                      <span>Rating: ⭐ {item.rating} / 5</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* 7 RECHARTS VISUALIZATIONS */}
      <section className="charts-dashboard-section">
        <h3 className="section-title">
          <BarChart3 size={20} />
          <span>Evaluation Metrics Visualizations (Confidence Threshold ≥ {rriThreshold})</span>
        </h3>

        <div className="charts-grid-2col">
          {/* Chart 1: RRI Distribution Histogram */}
          <div className="chart-card">
            <div className="chart-header">
              <h4>1. Review Reliability Index (RRI) Distribution</h4>
              <p>Frequency of evaluations categorized by reliability tiers</p>
            </div>
            <div className="chart-body" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.rri_distribution || []}
                  margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="band"
                    tick={{ fontSize: 11 }}
                    angle={-15}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    {(charts.rri_distribution || []).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isAboveThreshold ? '#2563eb' : '#94a3b8'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Rating Distribution */}
          <div className="chart-card">
            <div className="chart-header">
              <h4>2. Rating Distribution (Retained Reviews)</h4>
              <p>Breakdown of 1–5 star evaluations above cutoff</p>
            </div>
            <div className="chart-body" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.rating_distribution || []}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="rating" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Sentiment Distribution */}
          <div className="chart-card">
            <div className="chart-header">
              <h4>3. Sentiment Polarity Breakdown</h4>
              <p>Local NLP categorization (Independent from RRI)</p>
            </div>
            <div className="chart-body" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.sentiment_distribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="label"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(charts.sentiment_distribution || []).map((entry) => (
                      <Cell
                        key={`sent-${entry.label}`}
                        fill={SENTIMENT_COLORS[entry.label] || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Average Response Time vs Expected */}
          <div className="chart-card">
            <div className="chart-header">
              <h4>4. Actual Response Time vs. Expected Benchmark</h4>
              <p>Question dwell time vs calibrated expectation</p>
            </div>
            <div className="chart-body" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.avg_response_time || []}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="position" tickFormatter={(p) => `Q${p}`} />
                  <YAxis unit="s" />
                  <Tooltip
                    labelFormatter={(val, items) => {
                      const item = items?.[0]?.payload
                      return item ? `Q${item.position}: ${item.full_prompt}` : `Question ${val}`
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="expected_sec"
                    name="Expected (sec)"
                    fill="#94a3b8"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="actual_sec"
                    name="Actual Mean (sec)"
                    fill="#0ea5e9"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 5: RRI vs Rating Correlation */}
          <div className="chart-card">
            <div className="chart-header">
              <h4>5. RRI vs. Rating Correlation</h4>
              <p>Empirical proof of independence between rating and reliability</p>
            </div>
            <div className="chart-body" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    dataKey="average_rating"
                    name="Rating"
                    domain={[1, 5]}
                    unit=" ⭐"
                  />
                  <YAxis type="number" dataKey="rri_score" name="RRI" domain={[0, 100]} />
                  <ZAxis range={[60, 60]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter
                    name="Reviews"
                    data={charts.rri_vs_rating || []}
                    fill="#6366f1"
                    shape="circle"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 6: RRI by Course */}
          <div className="chart-card">
            <div className="chart-header">
              <h4>6. Average RRI Across Courses</h4>
              <p>Course-level reliability benchmark</p>
            </div>
            <div className="chart-body" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.rri_by_course || []}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="course_code" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar
                    dataKey="avg_rri"
                    name="Average RRI"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* FILTERABLE & SEARCHABLE REVIEWS TABLE */}
      <section className="reviews-table-section">
        <div className="table-header-row">
          <div>
            <h3 className="section-title">
              <Filter size={18} />
              <span>Student Evaluations Table (RRI ≥ {rriThreshold})</span>
            </h3>
            <p className="table-subtitle">
              Student identities are strictly anonymized in adherence to academic privacy policies.
            </p>
          </div>

          <div className="table-filters-row">
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search course code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="form-select select-sm"
              value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value)}
            >
              <option value="">All Sentiments</option>
              <option value="positive">Positive Only</option>
              <option value="neutral">Neutral Only</option>
              <option value="negative">Negative Only</option>
            </select>

            <select
              className="form-select select-sm"
              value={minRatingFilter}
              onChange={(e) => setMinRatingFilter(e.target.value)}
            >
              <option value="">All Ratings</option>
              <option value="4">4+ Stars</option>
              <option value="3">3+ Stars</option>
              <option value="2">2+ Stars</option>
              <option value="1">1+ Stars</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Course</th>
                <th>Reviewer</th>
                <th>RRI Score</th>
                <th>Sentiment</th>
                <th>Rating</th>
                <th>Duration</th>
                <th>Changes</th>
                <th>Revisits</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-6 text-muted">
                    No evaluations match the current threshold (≥ {rriThreshold}) and filters.
                  </td>
                </tr>
              ) : (
                reviews.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono">#{r.id}</td>
                    <td>
                      <strong>{r.course_code}</strong>
                      <span className="sub-text block">{r.course_title}</span>
                    </td>
                    <td className="anonymized-reviewer">{r.student_display}</td>
                    <td>
                      <span
                        className={`rri-badge ${
                          r.rri_score >= 80
                            ? 'rri-high'
                            : r.rri_score >= 60
                            ? 'rri-mid'
                            : 'rri-low'
                        }`}
                      >
                        {r.rri_score} / 100
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-sentiment-${r.sentiment_label}`}>
                        {r.sentiment_label?.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="rating-display">⭐ {r.average_rating || 'N/A'}</span>
                    </td>
                    <td className="font-mono">
                      {Math.round((r.total_duration_ms || 0) / 1000)}s
                    </td>
                    <td className="text-center">{r.answer_change_count || 0}</td>
                    <td className="text-center">{r.revisit_count || 0}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelectedReviewId(r.id)}
                      >
                        <Eye size={14} />
                        <span>Inspect RRI</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Review Detail Explainability Modal */}
      {selectedReviewId && (
        <ReviewDetailModal
          reviewId={selectedReviewId}
          onClose={() => setSelectedReviewId(null)}
        />
      )}
    </div>
  )
}
