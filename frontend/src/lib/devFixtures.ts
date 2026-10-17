/**
 * DEV MODE ONLY FIXTURES
 * Reference: docs/PLAN-5H.md and Defect Gate Rules.
 *
 * This is the ONLY file under frontend/src permitted to import from docs/fixtures.
 * These fixtures are bundled and used ONLY when explicitly opted-in via VITE_USE_FIXTURES=1.
 */

import trackC0 from '../../../docs/fixtures/track_assessment_c0.json';
import trackC2 from '../../../docs/fixtures/track_assessment_c2.json';
import jobDraftFixture from '../../../docs/fixtures/job_draft.json';
import diffFixture from '../../../docs/fixtures/diff_c0_c2.json';
import claimsMatrixFixture from '../../../docs/fixtures/claims_matrix.json';
import timelineFixture from '../../../docs/fixtures/analyses_timeline.json';
import resumeFixture from '../../../docs/fixtures/resume_draft.json';

export const DEV_FIXTURES = {
  trackC0,
  trackC2,
  jobDraft: jobDraftFixture,
  diff: diffFixture,
  claimsMatrix: claimsMatrixFixture,
  timeline: timelineFixture,
  resume: resumeFixture,
};
