import Sentiment from 'sentiment'

const sentimentAnalyzer = new Sentiment()

// Educational context domain vocabulary enhancement
const domainWordRatings = {
  approachable: 3,
  clear: 2,
  engaging: 3,
  inspirational: 3,
  thorough: 2,
  encouraging: 3,
  punctual: 2,
  patient: 2,
  helpful: 3,
  practical: 2,
  knowledgeable: 3,
  unfair: -3,
  harsh: -2,
  biased: -3,
  monotonous: -2,
  boring: -2,
  rushed: -2,
  confusing: -2,
  unapproachable: -3,
  unprepared: -3,
  rude: -3,
  strict: -1,
  lenient: 1,
}

sentimentAnalyzer.registerLanguage('en-edu', {
  labels: domainWordRatings,
})

/**
 * Analyzes open-text review comments and returns sentiment classification.
 * NOTE: Sentiment is strictly separate from RRI calculation.
 *
 * @param {string|string[]} textInput - String or array of text responses
 * @returns {{
 *   score: number,
 *   comparative: number,
 *   label: 'positive' | 'neutral' | 'negative',
 *   positiveWords: string[],
 *   negativeWords: string[]
 * }}
 */
export function analyzeSentiment(textInput) {
  let combinedText = ''
  if (Array.isArray(textInput)) {
    combinedText = textInput.filter((t) => typeof t === 'string').join(' ')
  } else if (typeof textInput === 'string') {
    combinedText = textInput
  }

  const trimmed = combinedText.trim()
  if (!trimmed) {
    return {
      score: 0,
      comparative: 0,
      label: 'neutral',
      positiveWords: [],
      negativeWords: [],
    }
  }

  const result = sentimentAnalyzer.analyze(trimmed, { language: 'en-edu' })

  // Comparative score is normalized between roughly -1 and +1 based on token length
  let label = 'neutral'
  if (result.comparative > 0.05 || result.score >= 2) {
    label = 'positive'
  } else if (result.comparative < -0.05 || result.score <= -2) {
    label = 'negative'
  }

  return {
    score: result.score,
    comparative: Number(result.comparative.toFixed(3)),
    label,
    positiveWords: Array.from(new Set(result.positive)),
    negativeWords: Array.from(new Set(result.negative)),
  }
}
