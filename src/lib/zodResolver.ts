import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form'
import type { z } from 'zod'

/**
 * zod 스키마용 최소 react-hook-form 리졸버.
 * (@hookform/resolvers 의존성을 추가하지 않기 위한 소형 구현 — 새 라이브러리 금지 원칙)
 */
export function zodResolver<T extends FieldValues>(schema: z.ZodType<T>): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values)
    if (result.success) {
      return { values: result.data, errors: {} }
    }
    const errors: Record<string, { type: string; message: string }> = {}
    for (const issue of result.error.issues) {
      const name = String(issue.path[0] ?? '_root')
      if (!errors[name]) {
        errors[name] = { type: issue.code, message: issue.message }
      }
    }
    return { values: {} as Record<string, never>, errors: errors as FieldErrors<T> }
  }
}
