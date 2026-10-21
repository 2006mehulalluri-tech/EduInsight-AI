import Database from 'better-sqlite3'

const db = new Database('./data/college_review.db')
db.prepare("DELETE FROM courses WHERE code IN ('CSE1001', 'CSE2004', 'CSE3002', 'ECE2001')").run()
console.log('Active Courses in Database:')
console.table(db.prepare('SELECT id, code, class_nbr, course_type, ltpjc, slot, venue, title FROM courses ORDER BY id').all())
db.close()
