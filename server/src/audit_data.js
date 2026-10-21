import { getDatabase, closeDatabase } from './db/connection.js';

const db = getDatabase();

console.log('--- TABLES ---');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables.map(t => t.name));

console.log('\n--- COUNTS ---');
console.log('Users:', db.prepare('SELECT count(*) as c FROM users').get().c);
console.log('Courses:', db.prepare('SELECT count(*) as c FROM courses').get().c);
console.log('Questions:', db.prepare('SELECT count(*) as c FROM questions').get().c);
console.log('Reviews:', db.prepare('SELECT count(*) as c FROM reviews').get().c);
console.log('Review Responses:', db.prepare('SELECT count(*) as c FROM review_responses').get().c);

console.log('\n--- SCHEMA: questions ---');
console.log(db.prepare("PRAGMA table_info(questions)").all());

console.log('\n--- SCHEMA: review_responses ---');
console.log(db.prepare("PRAGMA table_info(review_responses)").all());

console.log('\n--- SCHEMA: reviews ---');
console.log(db.prepare("PRAGMA table_info(reviews)").all());

console.log('\n--- SCHEMA: system_settings ---');
console.log(db.prepare("PRAGMA table_info(system_settings)").all());
console.log('Settings Rows:', db.prepare("SELECT * FROM system_settings").all());

console.log('\n--- SAMPLE REVIEW_RESPONSES (with timing data) ---');
const sampleResp = db.prepare(`
  SELECT rr.id, rr.question_id, rr.time_on_question_ms, rr.change_count, rr.revisit_count,
         q.prompt, q.question_type, q.category, q.expected_response_time_ms
  FROM review_responses rr
  JOIN questions q ON rr.question_id = q.id
  LIMIT 5
`).all();
console.log(sampleResp);

console.log('\n--- AGGREGATE STATS PER QUESTION ---');
const qStats = db.prepare(`
  SELECT q.id, q.prompt, q.question_type, q.category, q.expected_response_time_ms,
         COUNT(rr.id) as response_count,
         ROUND(AVG(rr.time_on_question_ms), 1) as avg_time_ms,
         MIN(rr.time_on_question_ms) as min_time_ms,
         MAX(rr.time_on_question_ms) as max_time_ms
  FROM questions q
  LEFT JOIN review_responses rr ON q.id = rr.question_id
  GROUP BY q.id
  LIMIT 10
`).all();
console.log(qStats);

closeDatabase();
