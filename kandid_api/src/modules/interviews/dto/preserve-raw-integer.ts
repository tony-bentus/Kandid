import { Transform } from 'class-transformer';

/**
 * Impede que o `enableImplicitConversion` global transforme strings numéricas
 * em números antes do `@IsInt()`.
 *
 * O `ValidationPipe` usa `enableImplicitConversion: true`, e uma string `"1"` em
 * `round`/`durationMinutes` viraria `1` e passaria no `@IsInt()`. Este transform
 * devolve o valor original do corpo quando ele era string, mantendo o 400 e a
 * mensagem `must be an integer number`. Valores já numéricos seguem normais.
 */
export function PreserveRawInteger(): PropertyDecorator {
  return Transform(({ value, obj, key }) => {
    const raw = (obj as Record<string, unknown> | undefined)?.[key];

    return typeof raw === 'string' ? raw : value;
  });
}
