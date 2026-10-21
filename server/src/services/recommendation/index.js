import { getDatabase } from '../../db/connection.js'
import { listAllQuestions } from '../../repositories/questions.js'
import {
  getAllModelMetadata,
  getCachedRecommendations,
  saveCachedRecommendations,
  saveModelMetadata,
} from '../../repositories/recommendations.js'
import { getEvaluationSettings, getRriWeights } from '../../repositories/settings.js'
import { QuestionDurationModel } from './duration-model.js'
import { ThresholdOptimizer } from './threshold-optimizer.js'
import { RriWeightsOptimizer } from './weights-optimizer.js'

/**
 * Unified Machine Learning Recommendation System for EduInsight AI
 */
class RecommendationService {
  constructor() {
    this.durationModel = new QuestionDurationModel()
    this.weightsOptimizer = new RriWeightsOptimizer()
    this.thresholdOptimizer = new ThresholdOptimizer()
  }

  /**
   * Generates and caches recommendations for all configurable parameters.
   *
   * @param {{ forceRetrain?: boolean }} options
   */
  async generateAllRecommendations({ forceRetrain = false } = {}) {
    const db = getDatabase()

    // 1. Train models
    const durationMetadata = this.durationModel.train()
    saveModelMetadata(durationMetadata)

    // 2. Fetch current configurations
    const currentWeights = getRriWeights()
    const currentEvalSettings = getEvaluationSettings()

    // 3. Optimize RRI Weights
    const weightsResult = this.weightsOptimizer.optimizeWeights(currentWeights)
    if (weightsResult.modelMetadata) {
      saveModelMetadata(weightsResult.modelMetadata)
    }

    // 4. Optimize Evaluation Settings / Thresholds
    const rriThresholdRec = this.thresholdOptimizer.optimizeConfidenceThreshold(
      currentEvalSettings.default_rri_threshold || 60,
    )
    const rushThresholdRec = this.thresholdOptimizer.optimizeRushThreshold(
      currentEvalSettings.rush_threshold_ms || 1500,
    )

    // Save metadata for threshold optimizer
    saveModelMetadata({
      model_id: 'evaluation_threshold_optimizer',
      model_type: 'statistical_otsu_and_percentile_optimization',
      trained_at: new Date().toISOString(),
      training_sample_count: rriThresholdRec.detailed_basis?.sample_size || 0,
      features_used: ['rri_score_distribution', 'rating_question_durations'],
      metrics: {
        separability_ratio_eta: rriThresholdRec.detailed_basis?.separability_ratio_eta || 0,
        sample_size: rriThresholdRec.detailed_basis?.sample_size || 0,
      },
      status: 'trained',
      version: '1.2.0',
    })

    // 5. Generate Question Duration Recommendations
    const allQuestions = listAllQuestions()
    const allResponses = db.prepare(`
      SELECT question_id, time_on_question_ms
      FROM review_responses
      WHERE time_on_question_ms IS NOT NULL
    `).all()

    const responsesByQuestion = new Map()
    for (const r of allResponses) {
      if (!responsesByQuestion.has(r.question_id)) {
        responsesByQuestion.set(r.question_id, [])
      }
      responsesByQuestion.get(r.question_id).push(r.time_on_question_ms)
    }

    const durationRecs = allQuestions.map((q) => {
      const qResponses = responsesByQuestion.get(q.id) || []
      return this.durationModel.recommendDuration(q, qResponses)
    })

    // 6. Assemble recommendations list for caching
    const allRecs = [
      ...durationRecs,
      {
        parameter_type: 'rri_weights',
        target_id: 'global',
        current_value: currentWeights,
        recommended_value: weightsResult.weights,
        difference: Object.fromEntries(
          Object.keys(weightsResult.weights || {}).map((k) => [
            k,
            (weightsResult.weights[k] || 0) - (currentWeights[k] || 0),
          ]),
        ),
        recommendation_type: weightsResult.recommendation_type,
        confidence_score: weightsResult.is_experimental ? 0.6 : 0.85,
        explanation: `Proposed weights optimize Fisher's discriminant criterion between deliberate evaluations and mechanical rushes, improving signal-to-noise ratio by +${weightsResult.optimization_summary?.snr_improvement_pct || 0}% while maintaining exact 100% sum balance.`,
        detailed_basis: {
          metrics_breakdown: weightsResult.recommendations_by_metric,
          optimization_summary: weightsResult.optimization_summary,
        },
      },
      rriThresholdRec,
      rushThresholdRec,
    ]

    // Save all to database
    saveCachedRecommendations(allRecs)

    return {
      status: 'success',
      generated_at: new Date().toISOString(),
      counts: {
        questions: durationRecs.length,
        weights: 1,
        evaluation_settings: 2,
        total: allRecs.length,
      },
    }
  }

  /**
   * Retrieves active question duration recommendations.
   */
  async getQuestionDurationRecommendations() {
    let recs = getCachedRecommendations('question_duration')
    if (recs.length === 0) {
      await this.generateAllRecommendations()
      recs = getCachedRecommendations('question_duration')
    }
    return recs
  }

  /**
   * Retrieves active RRI weights recommendation.
   */
  async getRriWeightsRecommendation() {
    let recs = getCachedRecommendations('rri_weights')
    if (recs.length === 0) {
      await this.generateAllRecommendations()
      recs = getCachedRecommendations('rri_weights')
    }
    return recs[0] || null
  }

  /**
   * Retrieves active evaluation settings / thresholds recommendations.
   */
  async getEvaluationSettingsRecommendations() {
    let recs = getCachedRecommendations('evaluation_settings')
    if (recs.length === 0) {
      await this.generateAllRecommendations()
      recs = getCachedRecommendations('evaluation_settings')
    }
    return recs
  }

  /**
   * Retrieves all model status and training metadata.
   */
  getModelStatus() {
    const models = getAllModelMetadata()
    return {
      models,
      last_refreshed: models[0]?.trained_at || null,
      is_operational: models.length > 0,
    }
  }
}

export const recommendationService = new RecommendationService()
