import { describe, it, expect } from 'vitest';
import {
  evaluateStudentEligibility,
  isDriveRegistrationOpen,
  formatInIST,
  StudentEligibilityProfile,
  DriveEligibilityRulesInput,
} from '@/lib/eligibilityEngine';
import {
  resolveOfferTier,
} from '@/config/collegeConfig';
import {
  evaluatePlacementPolicyCompliance,
  StudentOfferSummary,
} from '@/lib/placementPolicy';

describe('Eligibility Engine & Placement Policy Tests', () => {
  const baseStudent: StudentEligibilityProfile = {
    name: 'Aniket Shinde',
    rollNumber: 'PRN-ELIG-001',
    department: 'CSE',
    passoutYear: 2026,
    cgpa: 8.5,
    backlogs: 0,
    tenthPercentage: 88.0,
    twelfthOrDiplomaPercentage: 84.0,
    placementStatus: 'Not Placed',
  };

  describe('1. Eligibility Engine Criteria & Boundary Checks', () => {
    it('passes student meeting all criteria', () => {
      const rules: DriveEligibilityRulesInput = {
        minCgpa: 7.5,
        maxBacklogs: 0,
        allowedDepartments: ['CSE', 'IT'],
        allowedBatches: [2026],
        minTenthPercentage: 75.0,
        minTwelfthOrDiplomaPercentage: 70.0,
      };

      const result = evaluateStudentEligibility(baseStudent, rules);
      expect(result.isEligible).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.isDataIncomplete).toBe(false);
    });

    it('tests CGPA boundary: 7.00 passes minCgpa 7.00, 6.99 fails', () => {
      const rules: DriveEligibilityRulesInput = { minCgpa: 7.0 };

      const studentAtBoundary = { ...baseStudent, cgpa: 7.0 };
      expect(evaluateStudentEligibility(studentAtBoundary, rules).isEligible).toBe(true);

      const studentBelowBoundary = { ...baseStudent, cgpa: 6.99 };
      const failResult = evaluateStudentEligibility(studentBelowBoundary, rules);
      expect(failResult.isEligible).toBe(false);
      expect(failResult.reasons[0]).toMatch(/below minimum required 7.00/);
    });

    it('treats missing/null CGPA as ineligible with explicit "not recorded" reason', () => {
      const studentNullCgpa = { ...baseStudent, cgpa: null };
      const res = evaluateStudentEligibility(studentNullCgpa, { minCgpa: 6.0 });
      expect(res.isEligible).toBe(false);
      expect(res.reasons).toContain('CGPA not recorded.');
      expect(res.isDataIncomplete).toBe(true);
      expect(res.missingFields).toContain('cgpa');
    });

    it('tests backlogs boundary: 0 passes maxBacklogs 0, 1 fails', () => {
      const rules: DriveEligibilityRulesInput = { maxBacklogs: 0 };

      const studentZero = { ...baseStudent, backlogs: 0 };
      expect(evaluateStudentEligibility(studentZero, rules).isEligible).toBe(true);

      const studentOne = { ...baseStudent, backlogs: 1 };
      const failResult = evaluateStudentEligibility(studentOne, rules);
      expect(failResult.isEligible).toBe(false);
      expect(failResult.reasons[0]).toMatch(/exceeds maximum permitted limit of 0/);
    });

    it('treats missing/null backlogs as ineligible with explicit "not recorded" reason (never treats null as 0)', () => {
      const studentNullBacklogs = { ...baseStudent, backlogs: null };
      const res = evaluateStudentEligibility(studentNullBacklogs, { maxBacklogs: 2 });
      expect(res.isEligible).toBe(false);
      expect(res.reasons).toContain('Active backlogs count not recorded.');
      expect(res.isDataIncomplete).toBe(true);
    });

    it('tests 10th and 12th percentage boundary checks', () => {
      const rules: DriveEligibilityRulesInput = {
        minTenthPercentage: 80.0,
        minTwelfthOrDiplomaPercentage: 75.0,
      };

      const boundaryStudent = { ...baseStudent, tenthPercentage: 80.0, twelfthOrDiplomaPercentage: 75.0 };
      expect(evaluateStudentEligibility(boundaryStudent, rules).isEligible).toBe(true);

      const belowTenth = { ...baseStudent, tenthPercentage: 79.9 };
      const resTenth = evaluateStudentEligibility(belowTenth, rules);
      expect(resTenth.isEligible).toBe(false);
      expect(resTenth.reasons[0]).toMatch(/10th percentage 79.9% is below minimum required 80.0%/);

      const nullTwelfth = { ...baseStudent, twelfthOrDiplomaPercentage: null };
      const resTwelfth = evaluateStudentEligibility(nullTwelfth, rules);
      expect(resTwelfth.isEligible).toBe(false);
      expect(resTwelfth.reasons).toContain('12th / Diploma percentage not recorded.');
    });

    it('empty allowedDepartments and allowedBatches means "no restriction"', () => {
      const unrestrictedRules: DriveEligibilityRulesInput = {
        allowedDepartments: [], // empty = no restriction
        allowedBatches: [],     // empty = no restriction
      };

      const result = evaluateStudentEligibility(baseStudent, unrestrictedRules);
      expect(result.isEligible).toBe(true);
      expect(result.criteriaChecks.department).toBe(true);
      expect(result.criteriaChecks.batch).toBe(true);
    });

    it('filters department and batch when specified', () => {
      const restrictedRules: DriveEligibilityRulesInput = {
        allowedDepartments: ['ME', 'CE'],
        allowedBatches: [2027],
      };

      const result = evaluateStudentEligibility(baseStudent, restrictedRules);
      expect(result.isEligible).toBe(false);
      expect(result.reasons.some((r) => r.includes('Department "CSE" is not eligible'))).toBe(true);
      expect(result.reasons.some((r) => r.includes('Graduation batch "2026" is not eligible'))).toBe(true);
    });

    it('excludes students with placementStatus "Opted Out" or "Higher Studies"', () => {
      const optedOutStudent = { ...baseStudent, placementStatus: 'Opted Out' };
      const resOpted = evaluateStudentEligibility(optedOutStudent, {});
      expect(resOpted.isEligible).toBe(false);
      expect(resOpted.reasons).toContain('Student has opted out of campus placements.');

      const higherStudiesStudent = { ...baseStudent, placementStatus: 'Higher Studies' };
      const resHigher = evaluateStudentEligibility(higherStudiesStudent, {});
      expect(resHigher.isEligible).toBe(false);
      expect(resHigher.reasons).toContain('Student has opted for higher studies.');
    });
  });

  describe('2. Placement Policy & Half-Open CTC Tiers', () => {
    it('tests tier boundary 5.0 LPA: 4.99 is Regular, 5.0 is Dream', () => {
      expect(resolveOfferTier(4.99)).toBe('Regular');
      expect(resolveOfferTier(5.0)).toBe('Dream'); // Exact boundary belongs to Dream [5.0, 10.0)
    });

    it('tests tier boundary 10.0 LPA: 9.99 is Dream, 10.0 is Super Dream', () => {
      expect(resolveOfferTier(9.99)).toBe('Dream');
      expect(resolveOfferTier(10.0)).toBe('Super Dream'); // Exact boundary belongs to Super Dream [10.0, null)
      expect(resolveOfferTier(25.0)).toBe('Super Dream');
    });

    it('allows student with Regular offer to apply for Dream or Super Dream drive', () => {
      const existingOffers: StudentOfferSummary[] = [
        {
          role: 'Junior Engineer',
          companyName: 'TCS',
          type: 'Full-time',
          ctcLpa: 4.0,
          tier: 'Regular',
          status: 'Accepted',
        },
      ];

      const dreamCheck = evaluatePlacementPolicyCompliance({
        existingOffers,
        targetTier: 'Dream',
        targetCtcLpa: 7.0,
      });
      expect(dreamCheck.compliant).toBe(true);

      const superDreamCheck = evaluatePlacementPolicyCompliance({
        existingOffers,
        targetTier: 'Super Dream',
        targetCtcLpa: 14.0,
      });
      expect(superDreamCheck.compliant).toBe(true);
    });

    it('blocks student with Dream offer from applying to Regular or Dream tier drive', () => {
      const existingOffers: StudentOfferSummary[] = [
        {
          role: 'Software Engineer',
          companyName: 'Persistent Systems',
          type: 'Full-time',
          ctcLpa: 7.5,
          tier: 'Dream',
          status: 'Accepted',
        },
      ];

      const regularCheck = evaluatePlacementPolicyCompliance({
        existingOffers,
        targetTier: 'Regular',
        targetCtcLpa: 4.5,
      });
      expect(regularCheck.compliant).toBe(false);
      expect(regularCheck.violationReason).toMatch(/Placement policy requires tier upgrades/);

      const dreamCheck = evaluatePlacementPolicyCompliance({
        existingOffers,
        targetTier: 'Dream',
        targetCtcLpa: 8.0,
      });
      expect(dreamCheck.compliant).toBe(false);
    });

    it('blocks student holding a Super Dream offer from re-applying to any drive', () => {
      const existingOffers: StudentOfferSummary[] = [
        {
          role: 'Software Engineer',
          companyName: 'Amazon',
          type: 'Full-time',
          ctcLpa: 22.0,
          tier: 'Super Dream',
          status: 'Accepted',
        },
      ];

      const check = evaluatePlacementPolicyCompliance({
        existingOffers,
        targetTier: 'Super Dream',
        targetCtcLpa: 28.0,
      });
      expect(check.compliant).toBe(false);
      expect(check.violationReason).toMatch(/already holds a Super Dream offer/);
    });

    it('enforces maximum 2 offers per student', () => {
      const twoOffers: StudentOfferSummary[] = [
        { role: 'Dev 1', companyName: 'Comp A', type: 'Full-time', ctcLpa: 4.0, tier: 'Regular', status: 'Accepted' },
        { role: 'Dev 2', companyName: 'Comp B', type: 'Full-time', ctcLpa: 8.0, tier: 'Dream', status: 'Accepted' },
      ];

      const check = evaluatePlacementPolicyCompliance({
        existingOffers: twoOffers,
        targetTier: 'Super Dream',
        targetCtcLpa: 12.0,
      });
      expect(check.compliant).toBe(false);
      expect(check.violationReason).toMatch(/already holds 2 active\/accepted offer\(s\)/);
    });
  });

  describe('3. Registration Deadline & IST Conversion Checks', () => {
    it('allows registration when deadline is in the future and drive is Open', () => {
      const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const res = isDriveRegistrationOpen({
        status: 'Open',
        registrationDeadline: futureDeadline,
      });
      expect(res.isOpen).toBe(true);
    });

    it('computes "Registration Closed" on read when deadline has passed (no cron needed)', () => {
      const pastDeadline = new Date(Date.now() - 60 * 1000);
      const res = isDriveRegistrationOpen({
        status: 'Open',
        registrationDeadline: pastDeadline,
      });
      expect(res.isOpen).toBe(false);
      expect(res.reason).toMatch(/Registration closed on/);
      expect(res.reason).toMatch(/IST/);
    });

    it('tests IST and UTC date boundary representation', () => {
      // 2026-10-09 23:30:00 UTC corresponds to 2026-10-10 05:00:00 AM IST
      const utcDate = new Date('2026-10-09T23:30:00Z');
      const istString = formatInIST(utcDate);
      expect(istString).toContain('10 Oct 2026');
      expect(istString).toContain('05:00 am');
      expect(istString).toContain('IST');
    });
  });
});
