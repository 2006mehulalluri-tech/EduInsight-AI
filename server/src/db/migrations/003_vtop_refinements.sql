-- Migration 003: VTOP Course Metadata & Question Sections

ALTER TABLE courses ADD COLUMN class_nbr TEXT;
ALTER TABLE courses ADD COLUMN course_type TEXT DEFAULT 'Theory Only';
ALTER TABLE courses ADD COLUMN ltpjc TEXT DEFAULT '3-0-0-0-3';
ALTER TABLE courses ADD COLUMN slot TEXT DEFAULT 'A1+TA1';
ALTER TABLE courses ADD COLUMN venue TEXT DEFAULT 'SJT 101';

ALTER TABLE questions ADD COLUMN section TEXT DEFAULT 'FEEDBACK - CLASS WISE';
