/**
 * Senioridade usada pelo perfil, por vagas e pelo motor ATS.
 * Persistida como `enum` do MySQL (string enum do TypeScript).
 */
export enum Seniority {
  INTERN = 'INTERN',
  JUNIOR = 'JUNIOR',
  MID = 'MID',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
  STAFF = 'STAFF',
  PRINCIPAL = 'PRINCIPAL',
}
