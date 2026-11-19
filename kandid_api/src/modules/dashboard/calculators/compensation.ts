import type {
  CompensationBucketResponseDto,
  SeniorityCompensationBucketDto,
  SkillCompensationBucketDto,
} from '../dto/compensation-bucket-response.dto.js';
import type { CompensationDifferenceDto } from '../dto/compensation-difference.dto.js';
import type { CompensationStatsDto } from '../dto/compensation-stats.dto.js';
import { round2, roundCents } from './round.js';
import { compareNullableStrings, compareStrings } from './sort.js';
import type {
  MoneyInput,
  MoneyPair,
  SeniorityMoneyInput,
  SkillMoneyInput,
} from './types.js';

interface TaggedMoneyInput extends MoneyInput {
  seniority?: string | null;
  skillId?: string;
  skillName?: string;
}

interface MoneyGroup<T extends TaggedMoneyInput> {
  representative: T;
  applicationCount: number;
  proposed: number[];
  offered: number[];
  pairs: MoneyPair[];
}

type BucketFields = Pick<
  CompensationBucketResponseDto,
  | 'currency'
  | 'salaryPeriod'
  | 'applicationCount'
  | 'proposed'
  | 'offered'
  | 'difference'
>;

/** Estatísticas de uma base; todos os valores monetários são `null` com count 0. */
export function aggregateStats(values: readonly number[]): CompensationStatsDto {
  if (values.length === 0) {
    return { count: 0, minCents: null, maxCents: null, averageCents: null };
  }

  let min = values[0];
  let max = values[0];
  let sum = 0;

  for (const value of values) {
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
    sum += value;
  }

  return {
    count: values.length,
    minCents: min,
    maxCents: max,
    averageCents: roundCents(sum / values.length),
  };
}

/**
 * Diferença sobre a amostra pareada: cada par é uma candidatura com os dois
 * valores. `percentage` é null sem pares ou se a média dos propostos for <= 0.
 */
export function pairedDifference(
  pairs: readonly MoneyPair[],
): CompensationDifferenceDto {
  if (pairs.length === 0) {
    return { absoluteCents: null, percentage: null, pairedSampleSize: 0 };
  }

  let sumProposed = 0;
  let sumOffered = 0;

  for (const pair of pairs) {
    sumProposed += pair.proposed;
    sumOffered += pair.offered;
  }

  const meanProposed = sumProposed / pairs.length;
  const meanOffered = sumOffered / pairs.length;

  return {
    absoluteCents: roundCents(meanOffered - meanProposed),
    percentage:
      meanProposed <= 0
        ? null
        : round2((100 * (meanOffered - meanProposed)) / meanProposed),
    pairedSampleSize: pairs.length,
  };
}

function groupMoney<T extends TaggedMoneyInput>(
  inputs: readonly T[],
  keyOf: (input: T) => string,
): MoneyGroup<T>[] {
  const groups = new Map<string, MoneyGroup<T>>();

  for (const input of inputs) {
    if (input.proposedCents === null && input.offeredCents === null) {
      continue;
    }

    const key = keyOf(input);
    let group = groups.get(key);
    if (group === undefined) {
      group = {
        representative: input,
        applicationCount: 0,
        proposed: [],
        offered: [],
        pairs: [],
      };
      groups.set(key, group);
    }

    group.applicationCount += 1;
    if (input.proposedCents !== null) {
      group.proposed.push(input.proposedCents);
    }
    if (input.offeredCents !== null) {
      group.offered.push(input.offeredCents);
    }
    if (input.proposedCents !== null && input.offeredCents !== null) {
      group.pairs.push({
        proposed: input.proposedCents,
        offered: input.offeredCents,
      });
    }
  }

  return [...groups.values()];
}

function finishGroup<T extends TaggedMoneyInput>(
  group: MoneyGroup<T>,
): BucketFields {
  return {
    currency: group.representative.currency,
    salaryPeriod: group.representative.salaryPeriod,
    applicationCount: group.applicationCount,
    proposed: aggregateStats(group.proposed),
    offered: aggregateStats(group.offered),
    difference: pairedDifference(group.pairs),
  };
}

function compareBucket(
  left: CompensationBucketResponseDto,
  right: CompensationBucketResponseDto,
): number {
  return (
    compareStrings(left.currency, right.currency) ||
    compareStrings(left.salaryPeriod, right.salaryPeriod)
  );
}

/** Um bucket por par (currency, salaryPeriod), ordenado de forma estável. */
export function groupByCurrency(
  inputs: readonly MoneyInput[],
): CompensationBucketResponseDto[] {
  return groupMoney(inputs, (input) =>
    JSON.stringify([input.currency, input.salaryPeriod]),
  )
    .map(finishGroup)
    .sort(compareBucket);
}

/** Mesmo cálculo por senioridade; `seniority: null` é um bucket explícito. */
export function groupBySeniority(
  inputs: readonly SeniorityMoneyInput[],
): SeniorityCompensationBucketDto[] {
  return groupMoney(inputs, (input) =>
    JSON.stringify([input.currency, input.salaryPeriod, input.seniority]),
  )
    .map((group) => ({
      ...finishGroup(group),
      seniority: group.representative.seniority ?? null,
    }))
    .sort(
      (left, right) =>
        compareBucket(left, right) ||
        compareNullableStrings(left.seniority, right.seniority),
    );
}

/**
 * Mesmo cálculo por skill. Uma candidatura com N skills entra em N buckets; a
 * soma de `applicationCount` não reconcilia com `byCurrency` por construção.
 */
export function groupBySkill(
  inputs: readonly SkillMoneyInput[],
): SkillCompensationBucketDto[] {
  return groupMoney(inputs, (input) =>
    JSON.stringify([
      input.currency,
      input.salaryPeriod,
      input.skillId,
      input.skillName,
    ]),
  )
    .map((group) => ({
      ...finishGroup(group),
      skillId: group.representative.skillId,
      skillName: group.representative.skillName,
    }))
    .sort(
      (left, right) =>
        compareBucket(left, right) ||
        compareStrings(left.skillName, right.skillName) ||
        compareStrings(left.skillId, right.skillId),
    );
}
