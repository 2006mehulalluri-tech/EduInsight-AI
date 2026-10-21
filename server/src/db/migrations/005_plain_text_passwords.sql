-- Migration 005: Remove password hashing and store plain text passwords
ALTER TABLE users RENAME COLUMN password_hash TO password;

-- Reset existing accounts to their normal plain-text passwords
UPDATE users SET password = 'Student123!' WHERE email = 'student@local.test';
UPDATE users SET password = 'Faculty123!' WHERE email = 'faculty@local.test';
UPDATE users SET password = 'Faculty123!' WHERE email = 'prof.sharma@local.test';
UPDATE users SET password = 'Admin123!' WHERE email = 'admin@local.test';
UPDATE users SET password = 'ImportPass123!' WHERE email = 'import.student@local.test';
UPDATE users SET password = 'Password123!' WHERE role = 'faculty' AND email NOT IN ('faculty@local.test', 'prof.sharma@local.test');
UPDATE users SET password = 'DemoStudent123!' WHERE email LIKE 'student%@vitdemo.edu';

-- Ensure no bcrypt hashes remain for any users
UPDATE users SET password = 'Password123!' WHERE password LIKE '$2b$%';
