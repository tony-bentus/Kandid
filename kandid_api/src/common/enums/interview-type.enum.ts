/**
 * Tipos de entrevista da spec (`:173`).
 *
 * String enum com membro igual ao valor para manter contrato HTTP e enum do
 * MySQL alinhados sem conversão adicional.
 */
export enum InterviewType {
  HR = 'HR',
  TECHNICAL = 'TECHNICAL',
  BEHAVIORAL = 'BEHAVIORAL',
  CASE = 'CASE',
  CULTURAL = 'CULTURAL',
  FINAL = 'FINAL',
}
