import type { Seniority } from '../../../common/enums/seniority.enum.js';

/**
 * Tipos do motor ATS determinístico (KAN-41 e KAN-42).
 *
 * O motor é composto por funções puras: estes tipos são a fronteira entre as
 * etapas e também o contrato consumido pela persistência de `ats_analyses`
 * (KAN-43). Nenhum tipo aqui carrega comportamento, I/O ou relógio de parede.
 */

/** Entrada do catálogo global de skills (`skills`). */
export interface SkillCatalogEntry {
  id: string;
  name: string;
  aliases: readonly string[];
}

/**
 * Skill encontrada na descrição da vaga.
 *
 * `weight` é o multiplicador do requisito. O parser grava `1`; a cobertura
 * final usa o maior peso de seção do currículo onde a keyword aparece
 * (`resume-extractor` + `scorer`).
 */
export interface SkillMatch {
  skillId: string;
  name: string;
  matchedAs: string;
  weight: number;
}

/** Resultado do parsing da vaga, consumido pelo scorer. */
export interface JobRequirement {
  required: SkillMatch[];
  niceToHave: SkillMatch[];
  yearsRequired: number | null;
  seniorityHint: Seniority | null;
  educationRequired: boolean;
  certificationRequired: boolean;
  languagesRequired: readonly string[];
}

/** Entrada de `parseJob`. */
export interface ParseJobInput {
  description: string;
  skills: readonly SkillCatalogEntry[];
}

export type WeightedSectionKind =
  | 'summary'
  | 'recentHighlight'
  | 'otherHighlight'
  | 'skills'
  | 'projects';

/**
 * Trecho do currículo já ponderado por seção.
 *
 * `text` preserva o conteúdo original do snapshot; o scorer aplica
 * `normalize` antes de comparar, garantindo simetria com a vaga.
 */
export interface WeightedSection {
  section: WeightedSectionKind;
  weight: number;
  text: string;
}

/** Resultado de um check estrutural do currículo. */
export interface StructuralCheck {
  id: string;
  passed: boolean;
  detail: string | null;
}

/** Uma dimensão explicável do score. */
export interface ScoreDimension {
  dimension: string;
  weight: number;
  effectiveWeight: number;
  earned: number | null;
  applicable: boolean;
  matched: string[];
  missing: string[];
  detail: string | null;
}

/** Saída completa do motor, persistida em `ats_analyses`. */
export interface AtsScoreResult {
  score: number;
  breakdown: ScoreDimension[];
  matchedKeywords: string[];
  missingKeywords: string[];
}

/** Entrada de `score`. */
export interface ScoreInput {
  job: JobRequirement;
  sections: readonly WeightedSection[];
  checks: readonly StructuralCheck[];
  snapshot: ResumeSnapshot;
}

/** Links opcionais do candidato. */
export interface ResumeCandidateLinks {
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
}

export interface ResumeCandidate {
  name?: string | null;
  headline?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  links?: ResumeCandidateLinks | null;
}

export interface ResumeSkill {
  name: string;
  category?: string | null;
  level?: string | null;
  /**
   * Informativo (ADR 0005): não entra no cálculo de anos reais, que soma
   * apenas as durações das experiências.
   */
  years?: number | null;
}

export interface ResumeExperience {
  id?: string;
  sortOrder?: number;
  company?: string | null;
  role?: string | null;
  employmentType?: string | null;
  workModel?: string | null;
  location?: string | null;
  /** `YYYY-MM` (contrato do snapshot) ou `YYYY-MM-DD`. */
  startDate?: string | null;
  endDate?: string | null;
  current?: boolean;
  highlights?: readonly string[];
}

export interface ResumeEducation {
  institution?: string | null;
  degree?: string | null;
  fieldOfStudy?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  current?: boolean;
}

export interface ResumeCertification {
  name?: string | null;
  issuer?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  credentialUrl?: string | null;
  credentialId?: string | null;
}

export interface ResumeLanguage {
  name?: string | null;
  proficiency?: string | null;
}

export interface ResumeProject {
  name?: string | null;
  description?: string | null;
  url?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  current?: boolean;
}

/**
 * Snapshot imutável do currículo (`resume_versions.content_snapshot`).
 *
 * Compatível com `docs/prompt-kandid.md:306-357` e com a extensão provisória
 * `seniority` registrada no ADR 0005 (decisão 20). O campo é opcional: sem ele
 * a dimensão de senioridade fica `notApplicable`.
 */
export interface ResumeSnapshot {
  schemaVersion: string;
  generatedAt: string;
  targetRole?: string | null;
  seniority?: Seniority | null;
  candidate: ResumeCandidate;
  summary?: string | null;
  skills: readonly ResumeSkill[];
  experiences: readonly ResumeExperience[];
  education: readonly ResumeEducation[];
  certifications: readonly ResumeCertification[];
  languages: readonly ResumeLanguage[];
  projects: readonly ResumeProject[];
}
