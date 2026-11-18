import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Valida uma data no formato estrito `YYYY-MM-DD` (sem hora, sem fuso).
 *
 * `@IsDateString()` aceita ISO 8601 amplo (com hora e offset), o que não serve
 * para colunas `date` do MySQL. Este validador exige o formato de data pura e
 * rejeita datas inexistentes como `2026-02-31`.
 */
@ValidatorConstraint({ name: 'isDateOnly', async: false })
export class IsDateOnlyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      DATE_ONLY_PATTERN.test(value) &&
      isRealDate(value)
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid date in YYYY-MM-DD format`;
  }
}

export function IsDateOnly(options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isDateOnly',
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      validator: IsDateOnlyConstraint,
    });
  };
}
