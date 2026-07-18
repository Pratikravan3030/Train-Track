import { loadEnvConfig } from '@next/env';
import mongoose from 'mongoose';

// Load environment variables like Next.js does
loadEnvConfig(process.cwd());

import Student from '../src/models/Student';
import TrainingSession from '../src/models/TrainingSession';
import Attendance from '../src/models/Attendance';
import Feedback from '../src/models/Feedback';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please define the MONGODB_URI environment variable inside .env');
  process.exit(1);
}

const studentsData = [
  { name: 'Aarav Mehta', rollNumber: '22CS001', branch: 'Computer Science & Engineering', year: '3rd Year', email: 'aarav.mehta@college.edu' },
  { name: 'Aditya Sharma', rollNumber: '22CS002', branch: 'Computer Science & Engineering', year: '3rd Year', email: 'aditya.sharma@college.edu' },
  { name: 'Ananya Iyer', rollNumber: '22CS003', branch: 'Computer Science & Engineering', year: '3rd Year', email: 'ananya.iyer@college.edu' },
  { name: 'Dhruv Goel', rollNumber: '22CS004', branch: 'Computer Science & Engineering', year: '3rd Year', email: 'dhruv.goel@college.edu' },
  { name: 'Ishita Patel', rollNumber: '22CS005', branch: 'Computer Science & Engineering', year: '3rd Year', email: 'ishita.patel@college.edu' },
  { name: 'Karan Malhotra', rollNumber: '22IT012', branch: 'Information Technology', year: '3rd Year', email: 'karan.malhotra@college.edu' },
  { name: 'Meera Nair', rollNumber: '22IT015', branch: 'Information Technology', year: '3rd Year', email: 'meera.nair@college.edu' },
  { name: 'Rohan Gupta', rollNumber: '22EC021', branch: 'Electronics & Communication Engineering', year: '4th Year', email: 'rohan.gupta@college.edu' },
  { name: 'Sanjana Sen', rollNumber: '22EC024', branch: 'Electronics & Communication Engineering', year: '4th Year', email: 'sanjana.sen@college.edu' },
  { name: 'Sneha Rao', rollNumber: '22ME035', branch: 'Mechanical Engineering', year: '4th Year', email: 'sneha.rao@college.edu' },
  { name: 'Varun Verma', rollNumber: '22ME040', branch: 'Mechanical Engineering', year: '4th Year', email: 'varun.verma@college.edu' },
  { name: 'Pooja Hegde', rollNumber: '23CS008', branch: 'Computer Science & Engineering', year: '2nd Year', email: 'pooja.hegde@college.edu' },
  { name: 'Ravi Teja', rollNumber: '23IT009', branch: 'Information Technology', year: '2nd Year', email: 'ravi.teja@college.edu' },
  { name: 'Divya Dutta', rollNumber: '23EC015', branch: 'Electronics & Communication Engineering', year: '2nd Year', email: 'divya.dutta@college.edu' },
  { name: 'Rahul Roy', rollNumber: '23EE002', branch: 'Electrical Engineering', year: '2nd Year', email: 'rahul.roy@college.edu' },
  { name: 'Neha Kakkar', rollNumber: '23CE004', branch: 'Civil Engineering', year: '2nd Year', email: 'neha.kakkar@college.edu' }
];

const sessionsData = [
  { title: 'Resume Building & LinkedIn Branding', date: new Date('2026-07-01'), trainer: 'Sarah Jenkins (HR Director)', description: 'Masterclass on writing technical resumes, parsing ATS filters, and optimization of LinkedIn profiles for recruiters.' },
  { title: 'Quantitative Aptitude & Logic Shortcuts', date: new Date('2026-07-05'), trainer: 'Prof. Alok Gupta', description: 'Fast-track solving methods for probability, permutations, speed-distance-time, and logical reasoning tests.' },
  { title: 'Technical Interview Foundations: Data Structures', date: new Date('2026-07-10'), trainer: 'Sanjay Deshmukh (SDE-2 at Google)', description: 'Deep dive into arrays, strings, hash maps, linked lists, and time complexity analyses.' },
  { title: 'Mock Coding Assessment - Test 1', date: new Date('2026-07-15'), trainer: 'Placement Cell Panel', description: 'Live coding assessment simulator with subsequent review of optimal solutions.' },
  { title: 'Behavioral Interviews & STAR Method', date: new Date('2026-07-22'), trainer: 'Dr. Ritu Verma (Corporate Coach)', description: 'Structuring responses for behavioral and leadership round questions using the Situation-Task-Action-Result format.' },
  { title: 'System Design Basics for Beginners', date: new Date('2026-07-30'), trainer: 'Abhishek Roy (Architect at Amazon)', description: 'Introduction to load balancers, caching, databases, scaling, and system architectures.' }
];

const comments = [
  'Awesome explanation! The examples used were very relatable.',
  'Great session. The trainer solved all doubts patiently.',
  'Excellent slides and materials provided. Learnt a lot.',
  'A bit too fast, but the content was outstanding.',
  'Very structured session. The hands-on practice helped a lot.',
  'Average session. Wanted more deep dive into coding questions.',
  'Extremely helpful for placements! Highly recommended.',
  'Very informative. Got good feedback on my resume draft.',
  'The mock test was challenging and extremely beneficial.'
];

async function seed() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI!);
    console.log('Connected.');

    // Clear existing data
    console.log('Clearing old collections...');
    await Student.deleteMany({});
    await TrainingSession.deleteMany({});
    await Attendance.deleteMany({});
    await Feedback.deleteMany({});
    console.log('Collections cleared.');

    // Seed students
    console.log('Seeding students...');
    const createdStudents = await Student.insertMany(studentsData);
    console.log(`Inserted ${createdStudents.length} students.`);

    // Seed sessions
    console.log('Seeding sessions...');
    const createdSessions = await TrainingSession.insertMany(sessionsData);
    console.log(`Inserted ${createdSessions.length} training sessions.`);

    // Seed attendance records (simulate past sessions attendance)
    console.log('Seeding attendance...');
    const attendanceRecords = [];
    
    // For past sessions (indices 0, 1, 2, 3)
    for (let i = 0; i < 4; i++) {
      const session = createdSessions[i];
      for (const student of createdStudents) {
        // Randomly assign presence status (80% attendance rate)
        const present = Math.random() > 0.2;
        attendanceRecords.push({
          sessionId: session._id,
          studentId: student._id,
          present,
          markedAt: new Date(session.date)
        });
      }
    }
    await Attendance.insertMany(attendanceRecords);
    console.log(`Inserted ${attendanceRecords.length} attendance records.`);

    // Seed feedback logs
    console.log('Seeding feedback logs...');
    const feedbackRecords = [];

    // Past sessions feedback (indices 0, 1, 2, 3)
    for (let i = 0; i < 4; i++) {
      const session = createdSessions[i];
      
      // Select 3-4 random students to give feedback (some anonymous, some linked)
      const shuffledStudents = [...createdStudents].sort(() => 0.5 - Math.random());
      const selectedStudents = shuffledStudents.slice(0, Math.floor(Math.random() * 3) + 3);

      for (const student of selectedStudents) {
        const rating = Math.floor(Math.random() * 3) + 3; // Rating between 3 and 5
        const comment = comments[Math.floor(Math.random() * comments.length)];
        const isAnon = Math.random() > 0.6; // 40% anonymous

        feedbackRecords.push({
          sessionId: session._id,
          studentId: isAnon ? null : student._id,
          rating,
          comment,
          createdAt: new Date(session.date)
        });
      }
    }

    await Feedback.insertMany(feedbackRecords);
    console.log(`Inserted ${feedbackRecords.length} feedback entries.`);

    console.log('Database seeding completed successfully!');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

seed();
