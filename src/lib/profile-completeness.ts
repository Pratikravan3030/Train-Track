import { IStudent } from '@/models/Student';

export interface SectionCompleteness {
  score: number;
  max: number;
  percentage: number;
  completed: boolean;
  missing: string[];
}

export interface ProfileCompletenessResult {
  totalPercentage: number;
  sections: {
    basic: SectionCompleteness;
    academic: SectionCompleteness;
    skillsAndResume: SectionCompleteness;
    experience: SectionCompleteness;
  };
  recommendations: string[];
}

export function calculateProfileCompleteness(
  student: Partial<IStudent> | Record<string, unknown>
): ProfileCompletenessResult {
  // 1. Basic Section (Max: 25)
  const basicMissing: string[] = [];
  let basicScore = 0;

  if (student.name) basicScore += 5;
  else basicMissing.push('Full Name');

  if (student.rollNumber) basicScore += 5;
  else basicMissing.push('Roll Number');

  if (student.email) basicScore += 5;
  else basicMissing.push('Email Address');

  if (student.department || student.branch) basicScore += 5;
  else basicMissing.push('Department');

  if (student.passoutYear) basicScore += 3;
  else basicMissing.push('Passout Batch');

  if (student.phone) basicScore += 2;
  else basicMissing.push('Phone Number');

  const basicPercentage = Math.round((basicScore / 25) * 100);

  // 2. Academic Section (Max: 25)
  const academicMissing: string[] = [];
  let academicScore = 0;

  if (student.cgpa !== null && student.cgpa !== undefined) academicScore += 10;
  else academicMissing.push('Current CGPA');

  if (student.division) academicScore += 5;
  else academicMissing.push('Division / Section');

  const sgpaList = Array.isArray(student.semesterSgpa) ? student.semesterSgpa : [];
  if (sgpaList.length > 0) academicScore += 5;
  else academicMissing.push('Semester SGPA Records');

  if (
    (student.tenthPercentage !== null && student.tenthPercentage !== undefined) ||
    (student.twelfthOrDiplomaPercentage !== null && student.twelfthOrDiplomaPercentage !== undefined)
  ) {
    academicScore += 5;
  } else {
    academicMissing.push('10th / 12th Percentage');
  }

  const academicPercentage = Math.round((academicScore / 25) * 100);

  // 3. Skills & Resume Section (Max: 25)
  const skillsMissing: string[] = [];
  let skillsScore = 0;

  if (student.resumeUrl || student.resumeStorageKey) {
    skillsScore += 15;
  } else {
    skillsMissing.push('Resume PDF Upload');
  }

  const skillsList = Array.isArray(student.skills) ? student.skills : [];
  if (skillsList.length >= 3) {
    skillsScore += 10;
  } else if (skillsList.length > 0) {
    skillsScore += 5;
    skillsMissing.push('Add at least 3 technical skills');
  } else {
    skillsMissing.push('Technical Skills (at least 3)');
  }

  const skillsPercentage = Math.round((skillsScore / 25) * 100);

  // 4. Experience & Projects Section (Max: 25)
  const expMissing: string[] = [];
  let expScore = 0;

  const projectsList = Array.isArray(student.projects) ? student.projects : [];
  if (projectsList.length > 0) {
    expScore += 10;
  } else {
    expMissing.push('At least one Project');
  }

  const internshipsList = Array.isArray(student.internships) ? student.internships : [];
  const certsList = Array.isArray(student.certifications) ? student.certifications : [];
  if (internshipsList.length > 0 || certsList.length > 0) {
    expScore += 10;
  } else {
    expMissing.push('Internship or Certification');
  }

  const socialLinks = (student.socialLinks || {}) as Record<string, string | undefined>;
  if (socialLinks.github || socialLinks.linkedin || socialLinks.portfolio) {
    expScore += 5;
  } else {
    expMissing.push('LinkedIn or GitHub Profile Link');
  }

  const expPercentage = Math.round((expScore / 25) * 100);

  const totalPercentage = Math.min(100, basicScore + academicScore + skillsScore + expScore);

  const recommendations = [
    ...basicMissing,
    ...academicMissing,
    ...skillsMissing,
    ...expMissing,
  ].slice(0, 4);

  return {
    totalPercentage,
    sections: {
      basic: {
        score: basicScore,
        max: 25,
        percentage: basicPercentage,
        completed: basicScore === 25,
        missing: basicMissing,
      },
      academic: {
        score: academicScore,
        max: 25,
        percentage: academicPercentage,
        completed: academicScore === 25,
        missing: academicMissing,
      },
      skillsAndResume: {
        score: skillsScore,
        max: 25,
        percentage: skillsPercentage,
        completed: skillsScore === 25,
        missing: skillsMissing,
      },
      experience: {
        score: expScore,
        max: 25,
        percentage: expPercentage,
        completed: expScore === 25,
        missing: expMissing,
      },
    },
    recommendations,
  };
}
