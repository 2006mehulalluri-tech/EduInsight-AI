import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeQuestionDurations } from './telemetry.js'

test('normalizeQuestionDurations keeps total duration within the real review time', () => {
  const responses = [
    { question_id: 1, time_on_question_ms: 22000 },
    { question_id: 2, time_on_question_ms: 18000 },
    { question_id: 3, time_on_question_ms: 31000 },
  ]

  const normalized = normalizeQuestionDurations(responses, 30000)
  const total = normalized.reduce((sum, item) => sum + item.time_on_question_ms, 0)

  assert.equal(total, 30000)
  assert.ok(normalized.every((item) => item.time_on_question_ms >= 0))
  assert.equal(normalized[0].time_on_question_ms + normalized[1].time_on_question_ms + normalized[2].time_on_question_ms, 30000)
})
