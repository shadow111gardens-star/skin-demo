import { describe, it, expect } from 'vitest';
import { resetState, saveState, readState } from './data';
import { invoiceBalance, invoicePaid, invoiceTotals } from './features/finance/ledger';
import { completeSession, packageBalance } from './features/sessions/services';
import { expiringCourses } from './features/finance/packageSelectors';
import { reviewReady, sessionRecord, clinician } from './features/sessions/testFixtures';

describe('cross-module data integrity audit',()=>{
 it('uses purchased course validity for expiry alerts rather than invoice payment deadlines',()=>{
  const s=resetState();
  for(const r of s.records['Treatment Plans']) if(r.course) r.course.validUntil='2027-10-23';
  for(const r of s.records['Packages & Billing']) r.dueDate='2026-10-24';
  expect(expiringCourses(s)).toEqual([]);
  const course=s.records['Treatment Plans'].find(r=>r.course && r.status==='Active')!;
  course.course!.validUntil='2026-10-28';
  expect(expiringCourses(s).map(r=>r.id)).toEqual([course.id]);
  course.completedSittings=course.totalSittings;
  expect(expiringCourses(s)).toEqual([]);
 });
 it('resets to deterministic valid records with unique IDs and valid patient/course links',()=>{
  const a=resetState(),b=resetState();expect(a).toEqual(b);
  const ids=a.patients.map(p=>p.id);expect(new Set(ids).size).toBe(ids.length);
  const courses=a.records['Treatment Plans'].filter(r=>r.course).map(r=>r.id);
  for(const rows of Object.values(a.records)){
   expect(new Set(rows.map(r=>r.id)).size).toBe(rows.length);
   for(const r of rows){if(r.patientId)expect(ids,r.id).toContain(r.patientId);if(r.courseId)expect(courses,r.id).toContain(r.courseId);}
  }
  for(const a1 of a.appointments){expect(ids).toContain(a1.patientId);if(a1.courseId)expect(courses).toContain(a1.courseId);}
  for(const r of a.records['Packages & Billing'].filter(r=>r.invoice)){
   expect(r.invoice!.state).toMatch(/Draft|Issued|Void/);
   expect(invoiceBalance(a,r)).toBeGreaterThanOrEqual(0);
   expect(invoicePaid(a,r.id)).toBeGreaterThanOrEqual(0);
   expect(invoiceTotals(r.invoice!).total).toBeGreaterThanOrEqual(0);
  }
 });
 it('persists a completed sitting exactly once across a reload and retains package and stock history',()=>{
  const initial=reviewReady(),r=sessionRecord(initial),before=packageBalance(initial,r)!;
  const done=completeSession(initial,r.id,clinician,'Explicit fictional clinician completion');
  saveState(done);const reloaded=readState(),again=completeSession(reloaded,r.id,clinician,'Repeated completion after refresh');
  expect(again.sessionCompletions).toHaveLength(1);expect(packageBalance(again,r)?.remaining).toBe(before.remaining-1);
  expect(again.records['Packages & Billing'].find(i=>i.courseId===r.courseId)?.packageSessions?.remaining).toBe(before.remaining-1);
  expect(again.stockMovements).toEqual(done.stockMovements);
  expect(again.patients.map(p=>p.id)).toEqual(initial.patients.map(p=>p.id));
 });
});
