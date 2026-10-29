import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Student from '@/models/Student';
import Offer from '@/models/Offer';
import { requirePermission, canAccessDepartment } from '@/lib/auth-guards';
import { DEFAULT_PASSOUT_YEAR, PLACEMENT_POLICY_CONFIG } from '@/config/collegeConfig';
import { serializeCsv } from '@/lib/csv';
import { generateExcelBuffer } from '@/lib/excel';

export async function GET(request: Request) {
  const auth = await requirePermission('reports', 'read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const batchParam = searchParams.get('batch') || searchParams.get('passoutYear');
    const effectiveBatch =
      batchParam && batchParam !== 'all'
        ? parseInt(batchParam, 10)
        : batchParam === 'all'
        ? null
        : DEFAULT_PASSOUT_YEAR;

    const requestedDept = searchParams.get('department');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const companyParam = searchParams.get('company');
    const format = searchParams.get('format') || 'json';

    // Scoping check for coordinator
    if (auth.user.role === 'DEPT_COORDINATOR' && requestedDept) {
      if (!canAccessDepartment(auth.user, requestedDept)) {
        return NextResponse.json(
          { error: 'Forbidden. You cannot view placement reports outside your department.' },
          { status: 403 }
        );
      }
    }

    const effectiveDept =
      auth.user.role === 'DEPT_COORDINATOR' ? auth.user.department : requestedDept;

    await dbConnect();

    // 1. Build Student Filter
    const studentFilter: Record<string, unknown> = {
      isDeleted: { $ne: true },
    };
    if (effectiveBatch) {
      studentFilter.passoutYear = effectiveBatch;
    }
    if (effectiveDept && effectiveDept !== 'all') {
      studentFilter.$or = [{ department: effectiveDept }, { branch: effectiveDept }];
    }

    // Retrieve scoped students
    const students = await Student.find(studentFilter).lean();
    const studentIdMap = new Map<string, typeof students[0]>();
    const studentIds = students.map((s) => {
      studentIdMap.set(s._id.toString(), s);
      return s._id;
    });

    const totalStudents = students.length;
    const placedStudentsCount = students.filter((s) => s.placementStatus === 'Placed').length;
    const excludedStudentsCount = students.filter((s) =>
      ['Opted Out', 'Higher Studies', 'Entrepreneurship'].includes(s.placementStatus)
    ).length;
    const eligibleStudents = Math.max(0, totalStudents - excludedStudentsCount);
    const placementRate =
      eligibleStudents > 0
        ? parseFloat(((placedStudentsCount / eligibleStudents) * 100).toFixed(1))
        : 0;

    // 2. Build Offer Filter
    const offerFilter: Record<string, unknown> = {
      student: { $in: studentIds },
      status: 'Accepted',
      type: { $in: [...PLACEMENT_POLICY_CONFIG.rules.placementStatOfferTypes] },
    };

    if (companyParam && companyParam !== 'all') {
      offerFilter.companyName = companyParam;
    }

    if (startDateParam || endDateParam) {
      const dateQuery: Record<string, Date> = {};
      if (startDateParam) dateQuery.$gte = new Date(startDateParam);
      if (endDateParam) {
        const end = new Date(endDateParam);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
      offerFilter.offerDate = dateQuery;
    }

    const offers = await Offer.find(offerFilter)
      .populate('drive', 'role')
      .sort({ ctcLpa: -1 })
      .lean();

    // 3. Package statistics calculation
    const packages: number[] = offers
      .map((o) => o.ctcLpa)
      .filter((p): p is number => typeof p === 'number' && p > 0);

    const highestPackageLPA = packages.length > 0 ? Math.max(...packages) : 0;
    const avgPackageLPA =
      packages.length > 0
        ? parseFloat((packages.reduce((a, b) => a + b, 0) / packages.length).toFixed(2))
        : 0;

    let medianPackageLPA = 0;
    if (packages.length > 0) {
      const sorted = [...packages].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianPackageLPA =
        sorted.length % 2 !== 0 ? sorted[mid] : parseFloat(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
    }

    // 4. Department Breakdown
    const deptStatsMap = new Map<string, { total: number; placed: number; packages: number[] }>();
    students.forEach((s) => {
      const d = s.department || 'Unassigned';
      if (!deptStatsMap.has(d)) {
        deptStatsMap.set(d, { total: 0, placed: 0, packages: [] });
      }
      const item = deptStatsMap.get(d)!;
      item.total++;
      if (s.placementStatus === 'Placed') item.placed++;
    });

    offers.forEach((o) => {
      const st = studentIdMap.get(o.student?.toString());
      if (st && o.ctcLpa && o.ctcLpa > 0) {
        const d = st.department || 'Unassigned';
        deptStatsMap.get(d)?.packages.push(o.ctcLpa);
      }
    });

    const departmentBreakdown = Array.from(deptStatsMap.entries()).map(([dept, data]) => {
      const avg =
        data.packages.length > 0
          ? parseFloat((data.packages.reduce((a, b) => a + b, 0) / data.packages.length).toFixed(2))
          : 0;
      const rate = data.total > 0 ? parseFloat(((data.placed / data.total) * 100).toFixed(1)) : 0;
      return {
        department: dept,
        totalStudents: data.total,
        placedStudents: data.placed,
        placementRate: rate,
        avgPackageLPA: avg,
      };
    });

    // 5. Company Breakdown
    const companyStatsMap = new Map<string, { count: number; packages: number[] }>();
    offers.forEach((o) => {
      const compName = o.companyName || 'Direct / Off-Campus';
      if (!companyStatsMap.has(compName)) {
        companyStatsMap.set(compName, { count: 0, packages: [] });
      }
      const item = companyStatsMap.get(compName)!;
      item.count++;
      if (o.ctcLpa && o.ctcLpa > 0) item.packages.push(o.ctcLpa);
    });

    const companyBreakdown = Array.from(companyStatsMap.entries()).map(([companyName, data]) => ({
      companyName,
      offersCount: data.count,
      highestPackageLPA: data.packages.length > 0 ? Math.max(...data.packages) : 0,
      avgPackageLPA:
        data.packages.length > 0
          ? parseFloat((data.packages.reduce((a, b) => a + b, 0) / data.packages.length).toFixed(2))
          : 0,
    }));

    // 6. Tier Breakdown
    const tierMap = new Map<string, number>();
    offers.forEach((o) => {
      const t = o.tier || 'Regular / General';
      tierMap.set(t, (tierMap.get(t) || 0) + 1);
    });
    const tierBreakdown = Array.from(tierMap.entries()).map(([tier, count]) => ({ tier, count }));

    // 7. Detailed Placements Roster
    const detailedRoster = offers.map((o) => {
      const st = studentIdMap.get(o.student?.toString());
      return {
        rollNumber: st?.rollNumber || 'N/A',
        studentName: st?.name || 'N/A',
        department: st?.department || 'N/A',
        passoutYear: st?.passoutYear || effectiveBatch || 'N/A',
        companyName: o.companyName || 'Direct / Off-Campus',
        role: (o.drive as { role?: string })?.role || o.role || o.source || 'Full-time',
        offerType: o.type,
        packageLPA: o.ctcLpa ?? '—',
        tier: o.tier || 'Regular',
        offerDate: o.offerDate ? new Date(o.offerDate).toISOString().split('T')[0] : '—',
      };
    });

    const summary = {
      totalStudents,
      placedStudentsCount,
      excludedStudentsCount,
      eligibleStudents,
      placementRate,
      totalQualifyingOffers: offers.length,
      avgPackageLPA,
      highestPackageLPA,
      medianPackageLPA,
      qualifyingOfferTypes: PLACEMENT_POLICY_CONFIG.rules.placementStatOfferTypes,
    };

    // CSV Export
    if (format === 'csv') {
      const headers = [
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'studentName', label: 'Student Name' },
        { key: 'department', label: 'Department' },
        { key: 'passoutYear', label: 'Batch' },
        { key: 'companyName', label: 'Company' },
        { key: 'role', label: 'Job Role' },
        { key: 'offerType', label: 'Offer Type' },
        { key: 'packageLPA', label: 'Package (LPA)' },
        { key: 'tier', label: 'Offer Tier' },
        { key: 'offerDate', label: 'Offer Date' },
      ];

      const csvContent = serializeCsv(headers, detailedRoster);
      const filename = `placement-report-${effectiveDept || 'campus'}-${effectiveBatch || 'all'}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Excel Export
    if (format === 'excel') {
      const columns = [
        { header: 'Roll Number', key: 'rollNumber', width: 16 },
        { header: 'Student Name', key: 'studentName', width: 24 },
        { header: 'Department', key: 'department', width: 14 },
        { header: 'Batch', key: 'passoutYear', width: 12 },
        { header: 'Company', key: 'companyName', width: 26 },
        { header: 'Job Role', key: 'role', width: 22 },
        { header: 'Offer Type', key: 'offerType', width: 16 },
        { header: 'Package (LPA)', key: 'packageLPA', width: 16 },
        { header: 'Offer Tier', key: 'tier', width: 18 },
        { header: 'Offer Date', key: 'offerDate', width: 14 },
      ];

      const summaryCards = [
        { label: 'Total Enrolled Students', value: totalStudents },
        { label: 'Eligible Opted-In Students', value: eligibleStudents },
        { label: 'Placed Students Count', value: placedStudentsCount },
        { label: 'Placement Percentage (%)', value: `${placementRate}%` },
        { label: 'Total Accepted Offers', value: offers.length },
        { label: 'Highest Package (LPA)', value: `₹${highestPackageLPA} LPA` },
        { label: 'Average Package (LPA)', value: `₹${avgPackageLPA} LPA` },
        { label: 'Median Package (LPA)', value: `₹${medianPackageLPA} LPA` },
      ];

      const excelBuffer = await generateExcelBuffer({
        title: `CampusPlace Placement Report — Batch ${effectiveBatch || 'All'} (${effectiveDept || 'All Departments'})`,
        sheetName: 'Placements',
        columns,
        data: detailedRoster,
        summaryCards,
      });

      const filename = `placement-report-${effectiveDept || 'campus'}-${effectiveBatch || 'all'}.xlsx`;

      return new NextResponse(new Uint8Array(excelBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Default JSON
    return NextResponse.json({
      summary,
      departmentBreakdown,
      companyBreakdown,
      tierBreakdown,
      detailedRoster,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[GET /api/reports/placement error]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
