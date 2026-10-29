import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { AuthContext } from '@/lib/auth-guards';

let mockUserSession: { user: AuthContext } | null = null;

vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(async () => mockUserSession),
}));

// Route Handlers
import { POST as previewShortlist } from '@/app/api/drives/[id]/shortlist/preview/route';
import { POST as confirmShortlist } from '@/app/api/drives/[id]/shortlist/confirm/route';
import { POST as postDriveOffer } from '@/app/api/drives/[id]/offers/route';
import { GET as getOffers, POST as postManualOffer } from '@/app/api/offers/route';
import {
  GET as getOfferById,
  DELETE as deleteOfferById,
} from '@/app/api/offers/[id]/route';
import { PUT as reverseOffer } from '@/app/api/offers/[id]/reversal/route';
import {
  GET as getOfferLetter,
  POST as uploadOfferLetter,
  DELETE as deleteOfferLetter,
} from '@/app/api/offers/[id]/letter/route';
import { GET as exportDriveApplicants } from '@/app/api/drives/[id]/export/route';
import { POST as registerDriveApplications } from '@/app/api/drives/[id]/applications/route';

// Models
import User from '@/models/User';
import Student from '@/models/Student';
import Company from '@/models/Company';
import Drive from '@/models/Drive';
import Application from '@/models/Application';
import Offer from '@/models/Offer';
import AuditLog from '@/models/AuditLog';

describe('Phase 4: Shortlist Workflow, Offer Sync, Reversal & Formula-Safe Export', () => {
  let mongoServer: MongoMemoryServer;

  let tpoSession: { user: AuthContext };
  let coordinatorCseSession: { user: AuthContext };
  let coordinatorMeSession: { user: AuthContext };
  let studentSession: { user: AuthContext };

  let cseStudent1Id: string;
  let cseStudent2Id: string;
  let meStudentId: string;
  let driveId: string;
  let cseApp1Id: string;
  let cseApp2Id: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);

    const tpoUser = await User.create({
      name: 'TPO Officer',
      email: 'tpo@dypcet.ac.in',
      role: 'TPO',
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });
    const coordUser = await User.create({
      name: 'CSE Coordinator',
      email: 'coord.cse@dypcet.ac.in',
      role: 'DEPT_COORDINATOR',
      department: 'CSE',
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });
    const studentUser = await User.create({
      name: 'Student User',
      email: 'student@dypcet.ac.in',
      role: 'STUDENT',
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });

    tpoSession = {
      user: {
        id: tpoUser._id.toString(),
        email: tpoUser.email,
        name: tpoUser.name,
        role: 'TPO',
        tokenVersion: 1,
      },
    };

    coordinatorCseSession = {
      user: {
        id: coordUser._id.toString(),
        email: coordUser.email,
        name: coordUser.name,
        role: 'DEPT_COORDINATOR',
        department: 'CSE',
        tokenVersion: 1,
      },
    };

    const coordMeUser = await User.create({
      name: 'ME Coordinator',
      email: 'coord.me@dypcet.ac.in',
      role: 'DEPT_COORDINATOR',
      department: 'ME',
      password: 'password123',
      isActive: true,
      tokenVersion: 1,
    });

    coordinatorMeSession = {
      user: {
        id: coordMeUser._id.toString(),
        email: coordMeUser.email,
        name: coordMeUser.name,
        role: 'DEPT_COORDINATOR',
        department: 'ME',
        tokenVersion: 1,
      },
    };

    studentSession = {
      user: {
        id: studentUser._id.toString(),
        email: studentUser.email,
        name: studentUser.name,
        role: 'STUDENT',
        tokenVersion: 1,
      },
    };
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Student.deleteMany({});
    await Company.deleteMany({});
    await Drive.deleteMany({});
    await Application.deleteMany({});
    await Offer.deleteMany({});
    await AuditLog.deleteMany({});

    // Seed students
    const s1 = await Student.create({
      name: 'Aarav Patel',
      rollNumber: 'CSE-01',
      prn: 'PRN001',
      department: 'CSE',
      year: 'BE',
      batch: 2025,
      passoutYear: 2025,
      cgpa: 8.5,
      backlogs: 0,
      tenthPercentage: 85,
      twelfthOrDiplomaPercentage: 80,
      placementStatus: 'Not Placed',
    });
    cseStudent1Id = s1._id.toString();

    const s2 = await Student.create({
      name: 'Diya Rao',
      rollNumber: 'CSE-02',
      prn: 'PRN002',
      department: 'CSE',
      year: 'BE',
      batch: 2025,
      passoutYear: 2025,
      cgpa: 7.8,
      backlogs: 0,
      tenthPercentage: 82,
      twelfthOrDiplomaPercentage: 78,
      placementStatus: 'Not Placed',
    });
    cseStudent2Id = s2._id.toString();

    const s3 = await Student.create({
      name: '=Formula Injected Name',
      rollNumber: '+ME-01',
      prn: 'PRN003',
      department: 'ME',
      year: 'BE',
      batch: 2025,
      passoutYear: 2025,
      cgpa: 7.2,
      backlogs: 0,
      placementStatus: 'Not Placed',
    });
    meStudentId = s3._id.toString();

    // Seed Company
    const comp = await Company.create({
      name: 'Persistent Systems',
      normalizedName: 'persistent systems',
      sector: 'IT Services',
    });

    // Seed Drive with 3 selection rounds
    const drv = await Drive.create({
      company: comp._id,
      role: 'Software Engineer',
      type: 'Full-time',
      jd: 'Full stack development role',
      ctcLpa: 8.0,
      tier: 'Dream',
      location: 'Pune',
      driveDate: new Date(Date.now() + 5 * 86400000),
      registrationDeadline: new Date(Date.now() + 2 * 86400000),
      selectionRounds: ['Online Assessment', 'Technical Interview', 'HR Interview'],
      status: 'Open',
    });
    driveId = drv._id.toString();

    // Seed Applications at Round 0 (Online Assessment)
    const app1 = await Application.create({
      drive: drv._id,
      student: s1._id,
      status: 'Applied',
      currentRoundIndex: 0,
      roundResults: [
        { roundIndex: 0, roundName: 'Online Assessment', status: 'Pending', updatedBy: tpoSession.user.id },
        { roundIndex: 1, roundName: 'Technical Interview', status: 'Pending', updatedBy: tpoSession.user.id },
        { roundIndex: 2, roundName: 'HR Interview', status: 'Pending', updatedBy: tpoSession.user.id },
      ],
      registeredBy: tpoSession.user.id,
      eligibilitySnapshot: {
        isEligible: true,
        department: 'CSE',
        passoutYear: 2025,
        evaluatedAt: new Date(),
        policyCheck: { passesPolicy: true },
      },
    });
    cseApp1Id = app1._id.toString();

    const app2 = await Application.create({
      drive: drv._id,
      student: s2._id,
      status: 'Applied',
      currentRoundIndex: 0,
      roundResults: [
        { roundIndex: 0, roundName: 'Online Assessment', status: 'Pending', updatedBy: tpoSession.user.id },
        { roundIndex: 1, roundName: 'Technical Interview', status: 'Pending', updatedBy: tpoSession.user.id },
        { roundIndex: 2, roundName: 'HR Interview', status: 'Pending', updatedBy: tpoSession.user.id },
      ],
      registeredBy: tpoSession.user.id,
      eligibilitySnapshot: {
        isEligible: true,
        department: 'CSE',
        passoutYear: 2025,
        evaluatedAt: new Date(),
        policyCheck: { passesPolicy: true },
      },
    });
    cseApp2Id = app2._id.toString();
  });

  describe('1. Two-Step Shortlist Workflow & Idempotency', () => {
    it('previews shortlist, identifying matched, omitted, and unrecognized candidates', async () => {
      mockUserSession = tpoSession;
      const req = new Request(`http://localhost/api/drives/${driveId}/shortlist/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRoundIndex: 1, // Advance to Technical Interview
          rollNumbers: ['CSE-01', 'UNKNOWN-99'],
        }),
      });

      const res = await previewShortlist(req, {
        params: Promise.resolve({ id: driveId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.counts.matchedCount).toBe(1);
      expect(data.counts.omittedCount).toBe(1); // CSE-02 was omitted
      expect(data.counts.unrecognizedCount).toBe(1); // UNKNOWN-99 is unrecognized
      expect(data.matched[0].rollNumber).toBe('CSE-01');
      expect(data.omitted[0].rollNumber).toBe('CSE-02');
      expect(data.unrecognized).toContain('UNKNOWN-99');
    });

    it('confirms shortlist: advances matched candidates and eliminates omitted candidates when chosen', async () => {
      mockUserSession = tpoSession;
      const req = new Request(`http://localhost/api/drives/${driveId}/shortlist/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRoundIndex: 1,
          shortlistedRollNumbers: ['CSE-01'],
          eliminateOmitted: true,
          rejectionReason: 'Did not clear Online Assessment cutoff score',
        }),
      });

      const res = await confirmShortlist(req, {
        params: Promise.resolve({ id: driveId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary.advancedCount).toBe(1);
      expect(data.summary.eliminatedCount).toBe(1);

      // Verify DB state for advanced student CSE-01
      const app1 = await Application.findById(cseApp1Id);
      expect(app1?.currentRoundIndex).toBe(1);
      expect(app1?.status).toBe('In Round');
      expect(app1?.roundResults[0].status).toBe('Passed');

      // Verify DB state for eliminated student CSE-02
      const app2 = await Application.findById(cseApp2Id);
      expect(app2?.status).toBe('Rejected');
      expect(app2?.roundResults[0].status).toBe('Failed');
      expect(app2?.statusHistory[app2.statusHistory.length - 1].reason).toContain('cutoff score');
    });

    it('ensures confirming shortlist is idempotent: re-uploading does not advance rounds twice', async () => {
      mockUserSession = tpoSession;
      // First confirm
      await confirmShortlist(
        new Request(`http://localhost/api/drives/${driveId}/shortlist/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetRoundIndex: 1,
            shortlistedRollNumbers: ['CSE-01'],
            eliminateOmitted: false,
          }),
        }),
        { params: Promise.resolve({ id: driveId }) }
      );

      // Second confirm with same data
      const res2 = await confirmShortlist(
        new Request(`http://localhost/api/drives/${driveId}/shortlist/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetRoundIndex: 1,
            shortlistedRollNumbers: ['CSE-01'],
            eliminateOmitted: false,
          }),
        }),
        { params: Promise.resolve({ id: driveId }) }
      );

      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.summary.advancedCount).toBe(0);
      expect(data2.summary.alreadyAdvancedCount).toBe(1);

      const app1 = await Application.findById(cseApp1Id);
      expect(app1?.currentRoundIndex).toBe(1);
    });
  });

  describe('2. Offer Creation, Placement Status Synchronization & Reversal', () => {
    it('creates an Accepted Full-time offer, synchronizing Student.placementStatus to Placed', async () => {
      mockUserSession = tpoSession;
      const req = new Request(`http://localhost/api/drives/${driveId}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: cseStudent1Id,
          type: 'Full-time',
          ctcLpa: 8.5,
          status: 'Accepted',
        }),
      });

      const res = await postDriveOffer(req, {
        params: Promise.resolve({ id: driveId }),
      });
      expect(res.status).toBe(201);
      const offer = await res.json();
      expect(offer.status).toBe('Accepted');
      expect(offer.companyName).toBe('Persistent Systems');

      // Verify student denormalized cache
      const student = await Student.findById(cseStudent1Id);
      expect(student?.placementStatus).toBe('Placed');
      expect(student?.placementDetails?.companyName).toBe('Persistent Systems');
      expect(student?.placementDetails?.packageLPA).toBe(8.5);
    });

    it('creates an Internship offer without marking Student as Placed', async () => {
      mockUserSession = tpoSession;
      const req = new Request(`http://localhost/api/drives/${driveId}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: cseStudent2Id,
          type: 'Internship',
          stipendMonthly: 30000,
          status: 'Accepted',
        }),
      });

      const res = await postDriveOffer(req, {
        params: Promise.resolve({ id: driveId }),
      });
      expect(res.status).toBe(201);

      // Student remains Not Placed because Internship does not qualify for Placed institutional stats
      const student = await Student.findById(cseStudent2Id);
      expect(student?.placementStatus).toBe('Not Placed');
      expect(student?.placementDetails?.companyName).toBeUndefined();
    });

    it('updates Student.placementDetails with the highest CTC offer when student holds multiple accepted offers', async () => {
      mockUserSession = tpoSession;
      // 1. First offer: 6.0 LPA
      await postDriveOffer(
        new Request(`http://localhost/api/drives/${driveId}/offers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: cseStudent1Id,
            type: 'Full-time',
            ctcLpa: 6.0,
            status: 'Accepted',
          }),
        }),
        { params: Promise.resolve({ id: driveId }) }
      );

      // 2. Second off-campus offer: 12.0 LPA (Super Dream)
      await postManualOffer(
        new Request('http://localhost/api/offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: cseStudent1Id,
            companyName: 'Google',
            role: 'Software Engineer',
            type: 'Full-time',
            ctcLpa: 12.0,
            status: 'Accepted',
          }),
        })
      );

      // Verify student cache reflects the 12.0 LPA offer
      const student = await Student.findById(cseStudent1Id);
      expect(student?.placementStatus).toBe('Placed');
      expect(student?.placementDetails?.companyName).toBe('Google');
      expect(student?.placementDetails?.packageLPA).toBe(12.0);
    });

    it('reverses an accepted offer: reverts Student to Not Placed when no other accepted qualifying offers remain', async () => {
      mockUserSession = tpoSession;
      // Create single accepted offer
      const createRes = await postDriveOffer(
        new Request(`http://localhost/api/drives/${driveId}/offers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: cseStudent1Id,
            type: 'Full-time',
            ctcLpa: 8.0,
            status: 'Accepted',
          }),
        }),
        { params: Promise.resolve({ id: driveId }) }
      );
      const offer = await createRes.json();

      // Student is Placed
      let student = await Student.findById(cseStudent1Id);
      expect(student?.placementStatus).toBe('Placed');

      // Reverse offer to Declined
      const reverseRes = await reverseOffer(
        new Request(`http://localhost/api/offers/${offer._id}/reversal`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'Declined',
            reason: 'Candidate opted for competitive off-campus opportunity',
          }),
        }),
        { params: Promise.resolve({ id: offer._id }) }
      );

      expect(reverseRes.status).toBe(200);
      const revData = await reverseRes.json();
      expect(revData.placementStatus).toBe('Not Placed');

      // Student is reverted to Not Placed and placementDetails is cleared
      student = await Student.findById(cseStudent1Id);
      expect(student?.placementStatus).toBe('Not Placed');
      expect(student?.placementDetails?.companyName).toBeUndefined();
    });
  });

  describe('3. Formula-Safe CSV Export & Column Presets', () => {
    it('escapes spreadsheet formula injection characters (=, +, -, @, \\t, \\r)', async () => {
      mockUserSession = tpoSession;
      // Register candidate with formula characters in name and roll number
      await Application.create({
        drive: driveId,
        student: meStudentId, // Name: '=Formula Injected Name', Roll: '+ME-01'
        status: 'Applied',
        currentRoundIndex: 0,
        registeredBy: tpoSession.user.id,
        eligibilitySnapshot: {
          isEligible: true,
          department: 'ME',
          passoutYear: 2025,
          evaluatedAt: new Date(),
          policyCheck: { passesPolicy: true },
        },
      });

      const req = new Request(`http://localhost/api/drives/${driveId}/export?preset=company`);
      const res = await exportDriveApplicants(req, {
        params: Promise.resolve({ id: driveId }),
      });

      expect(res.status).toBe(200);
      const csvText = await res.text();

      // Ensure formula characters are prefixed with single quote
      expect(csvText).toContain("'+ME-01");
      expect(csvText).toContain("'=Formula Injected Name");
    });

    it('preset "company" excludes DOB and gender columns', async () => {
      mockUserSession = tpoSession;
      const req = new Request(`http://localhost/api/drives/${driveId}/export?preset=company`);
      const res = await exportDriveApplicants(req, {
        params: Promise.resolve({ id: driveId }),
      });

      expect(res.status).toBe(200);
      const csvText = await res.text();
      const firstLine = csvText.split('\r\n')[0];

      expect(firstLine).not.toContain('DOB');
      expect(firstLine).not.toContain('Date of Birth');
      expect(firstLine).not.toContain('Gender');
      expect(firstLine).toContain('Candidate Name');
      expect(firstLine).toContain('CGPA');
      expect(firstLine).toContain('10th %');
    });

    it('scopes export to coordinator own department', async () => {
      // Register ME student to same drive
      await Application.create({
        drive: driveId,
        student: meStudentId,
        status: 'Applied',
        currentRoundIndex: 0,
        registeredBy: tpoSession.user.id,
        eligibilitySnapshot: {
          isEligible: true,
          department: 'ME',
          passoutYear: 2025,
          evaluatedAt: new Date(),
          policyCheck: { passesPolicy: true },
        },
      });

      mockUserSession = coordinatorCseSession; // CSE Coordinator
      const req = new Request(`http://localhost/api/drives/${driveId}/export?preset=company`);
      const res = await exportDriveApplicants(req, {
        params: Promise.resolve({ id: driveId }),
      });

      expect(res.status).toBe(200);
      const csvText = await res.text();
      // Should contain CSE students, but NOT ME student
      expect(csvText).toContain('CSE-01');
      expect(csvText).not.toContain('+ME-01');
    });
  });

  describe('4. Offer Letter Upload & Storage Security', () => {
    it('uploads valid PDF offer letter within 2MB limit', async () => {
      mockUserSession = tpoSession;
      const offerDoc = await Offer.create({
        drive: driveId,
        student: cseStudent1Id,
        source: 'Campus Drive',
        companyName: 'Persistent Systems',
        role: 'SWE',
        type: 'Full-time',
        status: 'Accepted',
      });

      // Valid PDF buffer starting with %PDF-
      const pdfBuffer = Buffer.from('%PDF-1.4 sample offer letter content %EOF');
      const formData = new FormData();
      const file = new File([pdfBuffer], 'Persistent_Offer.pdf', { type: 'application/pdf' });
      formData.append('file', file);

      const req = new Request(`http://localhost/api/offers/${offerDoc._id}/letter`, {
        method: 'POST',
        body: formData,
      });

      const res = await uploadOfferLetter(req, {
        params: Promise.resolve({ id: offerDoc._id.toString() }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe('Offer letter uploaded successfully');
      expect(body.offerLetterUrl).toBe(`/api/offers/${offerDoc._id}/letter`);

      // Verify DB storage key
      const updated = await Offer.findById(offerDoc._id);
      expect(updated?.offerLetterStorageKey).toBeDefined();
    });

    it('rejects non-PDF offer letter upload', async () => {
      mockUserSession = tpoSession;
      const offerDoc = await Offer.create({
        drive: driveId,
        student: cseStudent1Id,
        source: 'Campus Drive',
        companyName: 'Persistent Systems',
        role: 'SWE',
        type: 'Full-time',
        status: 'Accepted',
      });

      // Invalid fake text file
      const textBuffer = Buffer.from('Plain text file content');
      const formData = new FormData();
      const file = new File([textBuffer], 'Offer.txt', { type: 'text/plain' });
      formData.append('file', file);

      const req = new Request(`http://localhost/api/offers/${offerDoc._id}/letter`, {
        method: 'POST',
        body: formData,
      });

      const res = await uploadOfferLetter(req, {
        params: Promise.resolve({ id: offerDoc._id.toString() }),
      });
      expect(res.status).toBe(400);
      const err = await res.json();
      expect(err.error).toContain('Uploaded file must be a valid PDF document');
    });

    it('serves offer letter with nosniff and safe Content-Disposition headers', async () => {
      mockUserSession = tpoSession;
      const offerDoc = await Offer.create({
        drive: driveId,
        student: cseStudent1Id,
        source: 'Campus Drive',
        companyName: 'Persistent Systems',
        role: 'SWE',
        type: 'Full-time',
        status: 'Accepted',
      });

      // Upload first
      const pdfBuffer = Buffer.from('%PDF-1.4 test document %EOF');
      const formData = new FormData();
      const file = new File([pdfBuffer], 'Offer.pdf', { type: 'application/pdf' });
      formData.append('file', file);

      await uploadOfferLetter(
        new Request(`http://localhost/api/offers/${offerDoc._id}/letter`, {
          method: 'POST',
          body: formData,
        }),
        { params: Promise.resolve({ id: offerDoc._id.toString() }) }
      );

      // GET letter
      const getReq = new Request(`http://localhost/api/offers/${offerDoc._id}/letter`);
      const getRes = await getOfferLetter(getReq, {
        params: Promise.resolve({ id: offerDoc._id.toString() }),
      });

      expect(getRes.status).toBe(200);
      expect(getRes.headers.get('Content-Type')).toBe('application/pdf');
      expect(getRes.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(getRes.headers.get('Content-Disposition')).toContain('inline; filename=');
    });

    it('allows deleting an offer and cleans up stored offer letter', async () => {
      mockUserSession = tpoSession;
      const offerDoc = await Offer.create({
        drive: driveId,
        student: cseStudent1Id,
        source: 'Campus Drive',
        companyName: 'Persistent Systems',
        role: 'SWE',
        type: 'Full-time',
        status: 'Accepted',
      });

      // Upload letter
      const pdfBuffer = Buffer.from('%PDF-1.4 test document %EOF');
      const formData = new FormData();
      const file = new File([pdfBuffer], 'Offer.pdf', { type: 'application/pdf' });
      formData.append('file', file);

      await uploadOfferLetter(
        new Request(`http://localhost/api/offers/${offerDoc._id}/letter`, {
          method: 'POST',
          body: formData,
        }),
        { params: Promise.resolve({ id: offerDoc._id.toString() }) }
      );

      // Verify GET offers list and GET offer by id
      const listRes = await getOffers(new Request('http://localhost/api/offers'));
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.data.length).toBeGreaterThan(0);

      const detailRes = await getOfferById(
        new Request(`http://localhost/api/offers/${offerDoc._id}`),
        { params: Promise.resolve({ id: offerDoc._id.toString() }) }
      );
      expect(detailRes.status).toBe(200);

      // Delete offer letter
      const delLetterRes = await deleteOfferLetter(
        new Request(`http://localhost/api/offers/${offerDoc._id}/letter`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: offerDoc._id.toString() }) }
      );
      expect(delLetterRes.status).toBe(200);

      // Delete offer document
      const delOfferRes = await deleteOfferById(
        new Request(`http://localhost/api/offers/${offerDoc._id}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: offerDoc._id.toString() }) }
      );
      expect(delOfferRes.status).toBe(200);
    });

    it('denies STUDENT role from viewing offers (HTTP 403)', async () => {
      mockUserSession = studentSession;
      const res = await getOffers(new Request('http://localhost/api/offers'));
      expect(res.status).toBe(403);
    });

    describe('Phase 4 Review Deliverables: Isolation, Governance & Sync Safeguards', () => {
      it('Cross-department access: denies ME coordinator from viewing CSE student offer letter (403)', async () => {
        const offerDoc = await Offer.create({
          drive: driveId,
          student: cseStudent1Id,
          source: 'Campus Drive',
          companyName: 'Persistent Systems',
          role: 'SWE',
          type: 'Full-time',
          status: 'Accepted',
          offerLetterStorageKey: 'offer-letters/fake-cse-letter.pdf',
        });

        mockUserSession = coordinatorMeSession;
        const res = await getOfferLetter(
          new Request(`http://localhost/api/offers/${offerDoc._id}/letter`),
          { params: Promise.resolve({ id: offerDoc._id.toString() }) }
        );
        expect(res.status).toBe(403);
      });

      it('Offer-to-placement sync NEVER overwrites Opted Out, Higher Studies, or Entrepreneurship', async () => {
        mockUserSession = tpoSession;
        const statuses = ['Opted Out', 'Higher Studies', 'Entrepreneurship'] as const;

        for (const status of statuses) {
          const studentDoc = await Student.create({
            name: `Test ${status} Student`,
            rollNumber: `STATUS-${status.replace(/\s+/g, '-')}`,
            department: 'CSE',
            year: 'Final Year',
            passoutYear: 2026,
            placementStatus: status,
            cgpa: 8.5,
            backlogs: 0,
          });

          // Create an accepted qualifying offer for this student
          const offerRes = await postManualOffer(
            new Request('http://localhost/api/offers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentId: studentDoc._id.toString(),
                companyName: 'Cognizant',
                role: 'Programmer Analyst',
                type: 'Full-time',
                ctcLpa: 4.5,
                status: 'Accepted',
              }),
            })
          );
          expect(offerRes.status).toBe(201);

          // Verify student status was NOT overwritten
          const afterSync = await Student.findById(studentDoc._id);
          expect(afterSync?.placementStatus).toBe(status);
        }
      });

      it('Reversing an offer records mandatory reason in placementDetails.reasonForStatusChange when leaving Placed', async () => {
        mockUserSession = tpoSession;
        const placedStudent = await Student.create({
          name: 'Placed Test Candidate',
          rollNumber: 'PLACED-REV-01',
          department: 'CSE',
          year: 'Final Year',
          passoutYear: 2026,
          placementStatus: 'Not Placed',
          cgpa: 8.0,
          backlogs: 0,
        });

        // Create accepted offer which moves student to Placed
        const offerRes = await postManualOffer(
          new Request('http://localhost/api/offers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: placedStudent._id.toString(),
              companyName: 'Wipro Technologies',
              role: 'Project Engineer',
              type: 'Full-time',
              ctcLpa: 6.5,
              status: 'Accepted',
            }),
          })
        );
        expect(offerRes.status).toBe(201);
        const offerData = await offerRes.json();

        const beforeRev = await Student.findById(placedStudent._id);
        expect(beforeRev?.placementStatus).toBe('Placed');

        // Reverse offer with reason
        const revReason = 'Candidate failed background verification';
        const revRes = await reverseOffer(
          new Request(`http://localhost/api/offers/${offerData._id}/reversal`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'Revoked',
              reason: revReason,
            }),
          }),
          { params: Promise.resolve({ id: offerData._id }) }
        );
        expect(revRes.status).toBe(200);

        const afterRev = await Student.findById(placedStudent._id);
        expect(afterRev?.placementStatus).toBe('Not Placed');
        expect(afterRev?.placementDetails?.reasonForStatusChange).toBe(revReason);
      });

      it('Bulk register-on-behalf: dedupes studentIds, checks eligibility, and allows staff override with audit trail', async () => {
        mockUserSession = tpoSession;

        const restrictedDrive = await Drive.create({
          company: (await Company.findOne({}))!._id,
          role: 'Specialist Engineer',
          type: 'Full-time',
          ctcLpa: 9.0,
          tier: 'Dream',
          jd: 'Specialist engineering role description',
          location: 'Kolhapur',
          driveDate: new Date(Date.now() + 5 * 86400000),
          registrationDeadline: new Date(Date.now() + 2 * 86400000),
          selectionRounds: ['Online Assessment'],
          status: 'Open',
          eligibilityRules: {
            minCgpa: 7.0,
            maxBacklogs: 0,
            allowedDepartments: ['CSE'],
          },
        });

        // Ineligible student due to CGPA below drive requirement (7.0)
        const ineligibleStudent = await Student.create({
          name: 'Ineligible Low CGPA',
          rollNumber: 'INELIGIBLE-01',
          department: 'CSE',
          year: 'Final Year',
          passoutYear: 2026,
          placementStatus: 'Not Placed',
          cgpa: 5.5,
          backlogs: 0,
        });

        // 1. Bulk registration with duplicate IDs in array
        const bulkRes = await registerDriveApplications(
          new Request(`http://localhost/api/drives/${restrictedDrive._id}/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentIds: [
                cseStudent2Id,
                cseStudent2Id, // Duplicate in payload
                ineligibleStudent._id.toString(),
              ],
            }),
          }),
          { params: Promise.resolve({ id: restrictedDrive._id.toString() }) }
        );
        expect(bulkRes.status).toBe(201);
        const data = await bulkRes.json();
        expect(data.summary.total).toBe(2); // Deduped to 2 distinct students
        expect(data.summary.created).toBe(1); // cseStudent2 created
        expect(data.summary.errors).toBe(1); // ineligibleStudent failed

        // 2. Register ineligible student with explicit overrideReason
        const overrideReasonText = 'Approved by TPO due to exceptional open-source contributions';
        const overrideRes = await registerDriveApplications(
          new Request(`http://localhost/api/drives/${restrictedDrive._id}/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: ineligibleStudent._id.toString(),
              overrideReason: overrideReasonText,
            }),
          }),
          { params: Promise.resolve({ id: restrictedDrive._id.toString() }) }
        );
        expect(overrideRes.status).toBe(201);

        // Verify audit log exists
        const auditLog = await AuditLog.findOne({
          action: 'REGISTER_APPLICANT',
          'details.studentId': ineligibleStudent._id.toString(),
          'details.isOverride': true,
        });
        expect(auditLog).toBeDefined();
      });

      it('Denies STUDENT role from drive registration until student portal is enabled (403)', async () => {
        mockUserSession = studentSession;
        const res = await registerDriveApplications(
          new Request(`http://localhost/api/drives/${driveId}/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: cseStudent1Id,
            }),
          }),
          { params: Promise.resolve({ id: driveId }) }
        );
        expect(res.status).toBe(403);
      });
    });
  });
});
