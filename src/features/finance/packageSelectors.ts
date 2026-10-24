import { DEMO_DATE, type ClinicState } from '../../data';
import { addDays } from '../../services';

/** Package validity comes from the purchased course, never an invoice due date. */
export function expiringCourses(s: ClinicState, date = DEMO_DATE, days = 14) {
  return s.records['Treatment Plans'].filter(r =>
    r.course && !['Cancelled', 'Completed'].includes(r.status) &&
    r.course.validUntil >= date && r.course.validUntil <= addDays(date, days) &&
    (r.completedSittings || 0) < (r.totalSittings || 0),
  );
}
