export function normalizeQuestionDurations(responses, totalDurationMs) {
  if (!Array.isArray(responses) || responses.length === 0) {
    return responses
  }

  const totalMs = Number(totalDurationMs)
  if (!Number.isFinite(totalMs) || totalMs <= 0) {
    return responses.map((response) => ({
      ...response,
      time_on_question_ms: Math.max(0, Number(response.time_on_question_ms) || 0),
    }))
  }

  const entries = responses.map((response) => ({
    ...response,
    _rawTime: Math.max(0, Number(response.time_on_question_ms) || 0),
  }))

  const rawTotal = entries.reduce((sum, entry) => sum + entry._rawTime, 0)
  if (rawTotal <= 0 || rawTotal <= totalMs) {
    return entries.map((entry) => ({
      ...entry,
      time_on_question_ms: Math.max(0, entry._rawTime),
    }))
  }

  let remaining = totalMs
  const normalized = entries.map((entry, index) => {
    const scaled = Math.round((entry._rawTime / rawTotal) * totalMs)
    const value = index === entries.length - 1 ? remaining : Math.min(Math.max(0, scaled), remaining)
    remaining = Math.max(0, remaining - value)

    const { _rawTime, ...clean } = entry
    return {
      ...clean,
      time_on_question_ms: value,
    }
  })

  if (remaining > 0 && normalized.length > 0) {
    normalized[normalized.length - 1].time_on_question_ms += remaining
  }

  return normalized
}
