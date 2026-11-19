export {
  containsNormalizedTerm,
  indexOfNormalizedTerm,
  normalize,
} from './normalizer.js';
export { canonicalLanguageKey, parseJob } from './job-parser.js';
export { extractResume } from './resume-extractor.js';
export { runChecks } from './checks.js';
export { score } from './scorer.js';
export type {
  AtsScoreResult,
  JobRequirement,
  ParseJobInput,
  ResumeCandidate,
  ResumeCandidateLinks,
  ResumeCertification,
  ResumeEducation,
  ResumeExperience,
  ResumeLanguage,
  ResumeProject,
  ResumeSkill,
  ResumeSnapshot,
  ScoreDimension,
  ScoreInput,
  SkillCatalogEntry,
  SkillMatch,
  StructuralCheck,
  WeightedSection,
  WeightedSectionKind,
} from './types.js';
