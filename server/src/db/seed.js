import { DEFAULT_RRI_WEIGHTS } from '../services/rri-engine.js'
import { closeDatabase, getDatabase } from './connection.js'
import { submitReview } from '../repositories/reviews.js'
import { saveRriWeights } from './../repositories/settings.js'

// VTOP Theory Questions with official Sections
const theoryQuestions = [
  // SECTION A: FEEDBACK - CLASS WISE
  { section: 'FEEDBACK - CLASS WISE', position: 1, prompt: 'Subject knowledge of the teacher', question_type: 'rating', expected_response_time_ms: 10000, category: 'Theory' },
  { section: 'FEEDBACK - CLASS WISE', position: 2, prompt: 'Communication skills and clarity of explanation', question_type: 'rating', expected_response_time_ms: 8000, category: 'Theory' },
  { section: 'FEEDBACK - CLASS WISE', position: 3, prompt: 'Use of board / OHP / PPTs creatively to facilitate understanding', question_type: 'rating', expected_response_time_ms: 9000, category: 'Theory' },
  { section: 'FEEDBACK - CLASS WISE', position: 4, prompt: 'Relating subject matter to practical applications and industry examples', question_type: 'rating', expected_response_time_ms: 10000, category: 'Theory' },
  { section: 'FEEDBACK - CLASS WISE', position: 5, prompt: 'Encouragement given to students to ask questions and participate', question_type: 'rating', expected_response_time_ms: 9000, category: 'Theory' },
  { section: 'FEEDBACK - CLASS WISE', position: 6, prompt: 'Teacher availability outside class for doubt clearing', question_type: 'rating', expected_response_time_ms: 9000, category: 'Theory' },
  { section: 'FEEDBACK - CLASS WISE', position: 7, prompt: 'Special attention and guidance given to slow learners / low CAT marks', question_type: 'rating', expected_response_time_ms: 10000, category: 'Theory' },
  { section: 'FEEDBACK - CLASS WISE', position: 8, prompt: 'Timely evaluation and fairness in marking of assignments and CATs', question_type: 'rating', expected_response_time_ms: 10000, category: 'Theory' },
  { section: 'FEEDBACK - CLASS WISE', position: 9, prompt: 'Focus on imparting career-relevant problem solving skills', question_type: 'rating', expected_response_time_ms: 10000, category: 'Theory' },
  { section: 'FEEDBACK - CLASS WISE', position: 10, prompt: 'Teacher punctuality and discipline maintained during lecture hours', question_type: 'rating', expected_response_time_ms: 9000, category: 'Theory' },

  // SECTION B: FEEDBACK - COURSE OUTCOME
  { section: 'FEEDBACK - COURSE OUTCOME', position: 11, prompt: 'Course content was challenging, intellectually stimulating, and well-structured', question_type: 'rating', expected_response_time_ms: 9000, category: 'Theory' },
  { section: 'FEEDBACK - COURSE OUTCOME', position: 12, prompt: 'Learning outcomes specified in the syllabus were effectively attained', question_type: 'rating', expected_response_time_ms: 9000, category: 'Theory' },
  { section: 'FEEDBACK - COURSE OUTCOME', position: 13, prompt: 'Ability to apply concepts to real-world software & engineering scenarios', question_type: 'rating', expected_response_time_ms: 10000, category: 'Theory' },

  // SECTION C: FEEDBACK - CURRICULUM AND SYLLABUS
  { section: 'FEEDBACK - CURRICULUM AND SYLLABUS', position: 14, prompt: 'Syllabus coverage was completed thoroughly as per the academic calendar', question_type: 'rating', expected_response_time_ms: 9000, category: 'Theory' },
  { section: 'FEEDBACK - CURRICULUM AND SYLLABUS', position: 15, prompt: 'Good things about the teacher / Course Strengths', question_type: 'text', expected_response_time_ms: 30000, category: 'Theory' },
  { section: 'FEEDBACK - CURRICULUM AND SYLLABUS', position: 16, prompt: 'Areas for improvement and suggestions for better student learning', question_type: 'text', expected_response_time_ms: 30000, category: 'Theory' },
]

// VTOP Lab Questions with official Sections
const labQuestions = [
  // SECTION A: FEEDBACK - LAB EXPERIMENTS & GUIDANCE
  { section: 'FEEDBACK - LAB EXPERIMENTS', position: 1, prompt: 'Subject knowledge and conceptual guidance provided during lab sessions', question_type: 'rating', expected_response_time_ms: 8000, category: 'Lab' },
  { section: 'FEEDBACK - LAB EXPERIMENTS', position: 2, prompt: 'Assistance and active troubleshooting guidance for experiment execution', question_type: 'rating', expected_response_time_ms: 9000, category: 'Lab' },
  { section: 'FEEDBACK - LAB EXPERIMENTS', position: 3, prompt: 'Opportunity to bridge theoretical knowledge into practical implementations', question_type: 'rating', expected_response_time_ms: 10000, category: 'Lab' },
  { section: 'FEEDBACK - LAB EXPERIMENTS', position: 4, prompt: 'Encouragement given to test novel approaches and write clean implementations', question_type: 'rating', expected_response_time_ms: 8000, category: 'Lab' },
  { section: 'FEEDBACK - LAB EXPERIMENTS', position: 5, prompt: 'Punctuality and continuous presence of faculty throughout the lab slot', question_type: 'rating', expected_response_time_ms: 8000, category: 'Lab' },
  { section: 'FEEDBACK - LAB EXPERIMENTS', position: 6, prompt: 'Adequacy, diversity, and depth of lab experiments conducted', question_type: 'rating', expected_response_time_ms: 10000, category: 'Lab' },

  // SECTION B: FEEDBACK - INFRASTRUCTURE & FACILITY
  { section: 'FEEDBACK - INFRASTRUCTURE', position: 7, prompt: 'Condition, maintenance, and availability of lab hardware/software systems', question_type: 'rating', expected_response_time_ms: 9000, category: 'Lab' },
  { section: 'FEEDBACK - INFRASTRUCTURE', position: 8, prompt: 'Adequacy of network connectivity and computing tools for lab deliverables', question_type: 'rating', expected_response_time_ms: 9000, category: 'Lab' },

  // SECTION C: FEEDBACK - SUGGESTIONS
  { section: 'FEEDBACK - SUGGESTIONS', position: 9, prompt: 'Other suggestions or constructive recommendations for improving lab effectiveness', question_type: 'text', expected_response_time_ms: 30000, category: 'Lab' },
]

// Full 11 courses matching VTOP reference screenshots
const VTOP_COURSES = [
  {
    code: 'BCSE204L',
    title: 'Design and Analysis of Algorithms',
    course_type: 'Theory Only',
    class_nbr: '1102',
    ltpjc: '3-0-0-0-3',
    slot: 'A1+TA1',
    venue: 'SJT 101',
    department: 'School of Computer Science and Engineering (SCOPE)',
    faculty: { name: 'Prof. PRAVIN RENOLD A', email: 'faculty@local.test', empId: 'FAC-10021', title: 'Associate Professor' },
    isLab: false,
  },
  {
    code: 'BCSE204P',
    title: 'Design and Analysis of Algorithms Lab',
    course_type: 'Lab Only',
    class_nbr: '1103',
    ltpjc: '0-0-2-0-1',
    slot: 'L31+L32',
    venue: 'SJT 102 Lab',
    department: 'School of Computer Science and Engineering (SCOPE)',
    faculty: { name: 'Prof. PRAVIN RENOLD A', email: 'faculty@local.test', empId: 'FAC-10021', title: 'Associate Professor' },
    isLab: true,
  },
  {
    code: 'BCSE209L',
    title: 'Machine Learning',
    course_type: 'Theory Only',
    class_nbr: '1145',
    ltpjc: '3-0-0-0-3',
    slot: 'B1+TB1',
    venue: 'SJT 201',
    department: 'School of Computer Science and Engineering (SCOPE)',
    faculty: { name: 'Prof. SALEENA B', email: 'prof.saleena@local.test', empId: 'FAC-10042', title: 'Professor' },
    isLab: false,
  },
  {
    code: 'BCSE209P',
    title: 'Machine Learning Lab',
    course_type: 'Lab Only',
    class_nbr: '1146',
    ltpjc: '0-0-2-0-1',
    slot: 'L15+L16',
    venue: 'SJT 202 Lab',
    department: 'School of Computer Science and Engineering (SCOPE)',
    faculty: { name: 'Prof. SALEENA B', email: 'prof.saleena@local.test', empId: 'FAC-10042', title: 'Professor' },
    isLab: true,
  },
  {
    code: 'BCSE301L',
    title: 'Software Engineering',
    course_type: 'Theory Only',
    class_nbr: '1210',
    ltpjc: '3-0-0-0-3',
    slot: 'C1+TC1',
    venue: 'TT 301',
    department: 'School of Computer Science and Engineering (SCOPE)',
    faculty: { name: 'Prof. ELAKYAR', email: 'prof.elakyar@local.test', empId: 'FAC-10058', title: 'Associate Professor' },
    isLab: false,
  },
  {
    code: 'BCSE301P',
    title: 'Software Engineering Lab',
    course_type: 'Lab Only',
    class_nbr: '1211',
    ltpjc: '0-0-2-0-1',
    slot: 'L41+L42',
    venue: 'TT 305 Lab',
    department: 'School of Computer Science and Engineering (SCOPE)',
    faculty: { name: 'Prof. ELAKYAR', email: 'prof.elakyar@local.test', empId: 'FAC-10058', title: 'Associate Professor' },
    isLab: true,
  },
  {
    code: 'BCSE305L',
    title: 'Embedded Systems',
    course_type: 'Theory Only',
    class_nbr: '1280',
    ltpjc: '3-0-0-0-3',
    slot: 'D1+TD1',
    venue: 'TT 401',
    department: 'School of Computer Science and Engineering (SCOPE)',
    faculty: { name: 'Prof. KARTHIKEYAN P R', email: 'prof.karthikeyan@local.test', empId: 'FAC-10072', title: 'Associate Professor' },
    isLab: false,
  },
  {
    code: 'BCSE355L',
    title: 'Cloud Architecture Design',
    course_type: 'Theory Only',
    class_nbr: '1320',
    ltpjc: '3-0-0-0-3',
    slot: 'E1+TE1',
    venue: 'SJT 401',
    department: 'School of Computer Science and Engineering (SCOPE)',
    faculty: { name: 'Prof. SIVA PRIYA M S', email: 'prof.sivapriya@local.test', empId: 'FAC-10088', title: 'Assistant Professor' },
    isLab: false,
  },
  {
    code: 'BMAT202L',
    title: 'Probability and Statistics',
    course_type: 'Theory Only',
    class_nbr: '1401',
    ltpjc: '3-1-0-0-4',
    slot: 'F1+TF1',
    venue: 'MB 105',
    department: 'Department of Mathematics (SAS)',
    faculty: { name: 'Prof. SANDIP SAHA', email: 'prof.sandipsaha@local.test', empId: 'FAC-10095', title: 'Associate Professor' },
    isLab: false,
  },
  {
    code: 'BMAT202P',
    title: 'Probability and Statistics Lab',
    course_type: 'Lab Only',
    class_nbr: '1402',
    ltpjc: '0-0-2-0-1',
    slot: 'L21+L22',
    venue: 'MB 106 Lab',
    department: 'Department of Mathematics (SAS)',
    faculty: { name: 'Prof. SANDIP SAHA', email: 'prof.sandipsaha@local.test', empId: 'FAC-10095', title: 'Associate Professor' },
    isLab: true,
  },
  {
    code: 'BSTS301P',
    title: 'Advanced Competitive Coding - I',
    course_type: 'Soft Skill',
    class_nbr: '1550',
    ltpjc: '0-0-0-0-1',
    slot: 'G1+TG1',
    venue: 'TT 501',
    department: 'Centre for Technical Career Development (CTCD)',
    faculty: { name: 'Prof. FACE (APT)', email: 'prof.face@local.test', empId: 'FAC-10110', title: 'Senior Corporate Trainer' },
    isLab: false,
  },
]

async function seedDatabase() {
  const db = getDatabase()

  console.log('Seeding system settings (RRI weights)...')
  saveRriWeights(DEFAULT_RRI_WEIGHTS)

  console.log('Seeding core user accounts...')
  const defaultPassword = 'Password123!'

  // Admin user
  let admin = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get('admin@local.test')
  let adminId = admin?.id
  if (!admin) {
    const res = db.prepare(
      `INSERT INTO users (email, password, role, first_name, last_name, enrollment_number)
       VALUES (?, ?, 'administrator', 'Dean', 'Academic Quality', NULL)`
    ).run('admin@local.test', 'Admin123!')
    adminId = res.lastInsertRowid
  }

  // Student user
  let student = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get('student@local.test')
  let studentId = student?.id
  if (!student) {
    const res = db.prepare(
      `INSERT INTO users (email, password, role, first_name, last_name, enrollment_number)
       VALUES (?, ?, 'student', 'Aarav', 'Patel', '22BCE1042')`
    ).run('student@local.test', 'Student123!')
    studentId = res.lastInsertRowid
  }

  console.log('Seeding VTOP Faculty and Course Catalog...')
  const createdCourseIds = {}

  for (const c of VTOP_COURSES) {
    // 1. Ensure faculty user exists
    let facUser = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(c.faculty.email)
    let facUserId = facUser?.id
    if (!facUser) {
      const plainPassword = c.faculty.email === 'faculty@local.test' ? 'Faculty123!' : defaultPassword
      const parts = c.faculty.name.replace(/^Prof\.\s*/, '').split(/\s+/)
      const firstName = parts[0]
      const lastName = parts.slice(1).join(' ') || 'Faculty'
      const res = db.prepare(
        `INSERT INTO users (email, password, role, first_name, last_name)
         VALUES (?, ?, 'faculty', ?, ?)`
      ).run(c.faculty.email, plainPassword, firstName, lastName)
      facUserId = res.lastInsertRowid
    } else {
      const parts = c.faculty.name.replace(/^Prof\.\s*/, '').split(/\s+/)
      const firstName = parts[0]
      const lastName = parts.slice(1).join(' ') || ''
      db.prepare('UPDATE users SET first_name = ?, last_name = ? WHERE id = ?').run(firstName, lastName, facUserId)
    }

    // 2. Ensure faculty table record exists
    let facRec = db.prepare('SELECT id FROM faculty WHERE user_id = ?').get(facUserId)
    let facId = facRec?.id
    if (!facRec) {
      const res = db.prepare(
        `INSERT INTO faculty (user_id, employee_id, department, title)
         VALUES (?, ?, ?, ?)`
      ).run(facUserId, c.faculty.empId, c.department, c.faculty.title)
      facId = res.lastInsertRowid
    }

    // 3. Ensure course exists and has VTOP fields
    let course = db.prepare('SELECT id FROM courses WHERE code = ?').get(c.code)
    let courseId = course?.id
    if (!course) {
      const res = db.prepare(
        `INSERT INTO courses (
          code, title, department, academic_year, academic_term,
          class_nbr, course_type, ltpjc, slot, venue, created_by
        ) VALUES (?, ?, ?, '2025-2026', 'Winter Semester', ?, ?, ?, ?, ?, ?)`
      ).run(
        c.code,
        c.title,
        c.department,
        c.class_nbr,
        c.course_type,
        c.ltpjc,
        c.slot,
        c.venue,
        adminId
      )
      courseId = res.lastInsertRowid
    } else {
      // Update metadata fields if course already existed
      db.prepare(
        `UPDATE courses 
         SET class_nbr = ?, course_type = ?, ltpjc = ?, slot = ?, venue = ?
         WHERE id = ?`
      ).run(c.class_nbr, c.course_type, c.ltpjc, c.slot, c.venue, courseId)
    }
    createdCourseIds[c.code] = courseId

    // 4. Assign faculty to course
    db.prepare('INSERT OR IGNORE INTO course_faculty (course_id, faculty_id) VALUES (?, ?)').run(courseId, facId)

    // 5. Seed questions for this course
    const qList = c.isLab ? labQuestions : theoryQuestions
    for (const q of qList) {
      const existingQ = db.prepare('SELECT id FROM questions WHERE course_id = ? AND position = ?').get(courseId, q.position)
      if (!existingQ) {
        db.prepare(
          `INSERT INTO questions (
            course_id, position, prompt, question_type, required, category, section, expected_response_time_ms
          ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)`
        ).run(courseId, q.position, q.prompt, q.question_type, q.category, q.section, q.expected_response_time_ms)
      } else {
        db.prepare('UPDATE questions SET section = ?, category = ?, prompt = ? WHERE id = ?').run(q.section, q.category, q.prompt, existingQ.id)
      }
    }
  }

  // Clear existing demo reviews to re-seed clean realistic demo data
  db.prepare('DELETE FROM reviews WHERE is_demo = 1').run()

  console.log('Generating realistic synthetic reviews across all 11 VTOP courses...')

  // Pool of synthetic students
  const studentPool = []
  for (let i = 1; i <= 30; i++) {
    const email = `student${i}@vitdemo.edu`
    let s = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (!s) {
      const res = db.prepare(
        `INSERT INTO users (email, password, role, first_name, last_name, enrollment_number)
         VALUES (?, ?, 'student', 'Student', '#${i}', '22BCE${1000 + i}')`
      ).run(email, 'DemoStudent123!')
      studentPool.push(res.lastInsertRowid)
    } else {
      studentPool.push(s.id)
    }
  }

  const positiveComments = [
    'Prof. explains algorithms with clear step-by-step trace tables. Very encouraging during doubt clearing.',
    'Excellent lecture delivery, punctual, and connects theoretical concepts directly to coding implementations.',
    'Thorough explanation of data structures and optimization. Hands-on coding exercises were very helpful.',
    'Presents complex mathematical derivations with great simplicity. Highly approachable after class.',
    'Lab experiments were well organized and challenging. Debugging guidance was top-notch.',
  ]

  const criticalComments = [
    'Lectures are too fast-paced before CAT exams. Would appreciate more solved numerical examples.',
    'Too much content crammed into each session. Marking on assignments was strict without clear rubrics.',
    'Difficult to follow derivations on slides alone. More blackboard work and office hours needed.',
    'Lab manual needs updated compiler instructions. Clarification on complex test cases was delayed.',
  ]

  const neutralComments = [
    'Covers textbook syllabus regularly as per schedule. Standard lecture progression.',
    'Classes conducted consistently. Course materials and lecture slides provided on time.',
    'Standard curriculum delivery. Follows the course plan properly.',
  ]

  const minimalComments = ['good', 'ok', 'fine', 'nil', 'nice teacher', 'satisfactory']

  // Seed reviews for each of the 11 courses (approx 6-8 reviews per course, total ~75 reviews)
  for (const c of VTOP_COURSES) {
    const cId = createdCourseIds[c.code]
    const questions = db.prepare('SELECT * FROM questions WHERE course_id = ? ORDER BY position ASC').all(cId)
    if (questions.length === 0) continue

    const reviewCountForCourse = 7

    for (let rIdx = 0; rIdx < reviewCountForCourse; rIdx++) {
      const studentUserId = studentPool[(rIdx * 3 + cId) % studentPool.length]

      // Determine profile:
      // 0, 1, 2: Conscientious (High RRI ~85-98)
      // 3, 4: Moderate (RRI ~65-78)
      // 5: Rushed clicker (Low RRI ~30-48) - straight line 5s or 1s
      // 6: Critical review with high effort (RRI ~88-96, Negative Sentiment)
      let profile = 'conscientious'
      if (rIdx <= 2) profile = 'conscientious'
      else if (rIdx <= 4) profile = 'moderate'
      else if (rIdx === 5) profile = 'rushed'
      else profile = 'critical_high_rri'

      let totalTime = 0
      const responses = questions.map((q, qIdx) => {
        const isRating = q.question_type === 'rating'
        let answer = null
        let time = 0
        let changes = 0
        let revisits = 0

        if (profile === 'conscientious') {
          const ratingVal = isRating ? Math.min(5, Math.max(3, 4 + (Math.random() > 0.6 ? 1 : (Math.random() > 0.5 ? -1 : 0)))) : null
          time = isRating ? Math.round(7000 + Math.random() * 6000) : Math.round(25000 + Math.random() * 20000)
          changes = qIdx === 2 ? 1 : 0
          revisits = qIdx === 0 ? 1 : 0
          answer = isRating ? ratingVal : positiveComments[Math.floor(Math.random() * positiveComments.length)]
        } else if (profile === 'critical_high_rri') {
          const ratingVal = isRating ? Math.min(3, Math.max(1, 2 + (Math.random() > 0.5 ? 0 : -1))) : null
          time = isRating ? Math.round(8000 + Math.random() * 6000) : Math.round(30000 + Math.random() * 15000)
          changes = qIdx === 1 ? 1 : 0
          revisits = qIdx === 3 ? 1 : 0
          answer = isRating ? ratingVal : criticalComments[Math.floor(Math.random() * criticalComments.length)]
        } else if (profile === 'moderate') {
          const ratingVal = isRating ? Math.min(4, Math.max(2, 3 + (Math.random() > 0.5 ? 1 : 0))) : null
          time = isRating ? Math.round(4000 + Math.random() * 3000) : Math.round(10000 + Math.random() * 6000)
          answer = isRating ? ratingVal : neutralComments[Math.floor(Math.random() * neutralComments.length)]
        } else {
          // Rushed
          const straightVal = Math.random() > 0.3 ? 5 : 1
          time = isRating ? Math.round(500 + Math.random() * 700) : Math.round(1000 + Math.random() * 1500)
          answer = isRating ? straightVal : minimalComments[Math.floor(Math.random() * minimalComments.length)]
        }

        totalTime += time

        return {
          question_id: q.id,
          question_type: q.question_type,
          prompt: q.prompt,
          expected_response_time_ms: q.expected_response_time_ms,
          time_on_question_ms: time,
          change_count: changes,
          revisit_count: revisits,
          answer,
          text_metadata: !isRating ? {
            typing_duration_ms: time * 0.7,
            char_count: String(answer).length,
            word_count: String(answer).split(/\s+/).length,
          } : null,
        }
      })

      const submittedAt = new Date(Date.now() - (7 - rIdx) * 3600 * 1000).toISOString()
      const startedAt = new Date(Date.now() - (7 - rIdx) * 3600 * 1000 - totalTime).toISOString()

      submitReview({
        course_id: cId,
        student_id: studentUserId,
        started_at: startedAt,
        submitted_at: submittedAt,
        total_duration_ms: totalTime,
        responses,
        is_demo: 1,
      })
    }
  }

  console.log('Seeding VTOP courses and reviews completed successfully!')
}

try {
  await seedDatabase()
} catch (e) {
  console.error('Seed error:', e)
} finally {
  closeDatabase()
}
