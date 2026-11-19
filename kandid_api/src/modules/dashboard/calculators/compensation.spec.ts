import { SalaryPeriod } from '../../../common/enums/salary-period.enum.js';
import { Seniority } from '../../../common/enums/seniority.enum.js';
import {
  aggregateStats,
  groupByCurrency,
  groupBySeniority,
  groupBySkill,
  pairedDifference,
} from './compensation.js';
import type {
  MoneyInput,
  SeniorityMoneyInput,
  SkillMoneyInput,
} from './types.js';

const money = (
  currency: string,
  salaryPeriod: SalaryPeriod,
  proposedCents: number | null,
  offeredCents: number | null,
): MoneyInput => ({ currency, salaryPeriod, proposedCents, offeredCents });

describe('compensation calculators', () => {
  it('separa buckets por currency e salaryPeriod sem misturar grandezas', () => {
    const buckets = groupByCurrency([
      money('BRL', SalaryPeriod.MONTH, 100000, 110000),
      money('BRL', SalaryPeriod.YEAR, 1200000, null),
      money('USD', SalaryPeriod.MONTH, null, 90000),
      money('BRL', SalaryPeriod.MONTH, null, null),
    ]);

    expect(buckets.map((bucket) => [bucket.currency, bucket.salaryPeriod])).toEqual([
      ['BRL', SalaryPeriod.MONTH],
      ['BRL', SalaryPeriod.YEAR],
      ['USD', SalaryPeriod.MONTH],
    ]);
    expect(buckets[0].applicationCount).toBe(1);
    expect(buckets[1].offered).toEqual({
      count: 0,
      minCents: null,
      maxCents: null,
      averageCents: null,
    });
    expect(buckets[2].proposed).toEqual({
      count: 0,
      minCents: null,
      maxCents: null,
      averageCents: null,
    });
  });

  it('devolve null em min/max/average quando a base está vazia', () => {
    expect(aggregateStats([])).toEqual({
      count: 0,
      minCents: null,
      maxCents: null,
      averageCents: null,
    });
    expect(aggregateStats([800000, 900000, 1000000])).toEqual({
      count: 3,
      minCents: 800000,
      maxCents: 1000000,
      averageCents: 900000,
    });
  });

  it('calcula a diferença pareada com sinal, percentual e média proposta zero', () => {
    expect(
      pairedDifference([{ proposed: 100000, offered: 110000 }]),
    ).toEqual({ absoluteCents: 10000, percentage: 10, pairedSampleSize: 1 });
    expect(
      pairedDifference([{ proposed: 100000, offered: 90000 }]),
    ).toEqual({ absoluteCents: -10000, percentage: -10, pairedSampleSize: 1 });
    expect(pairedDifference([{ proposed: 0, offered: 5000 }])).toEqual({
      absoluteCents: 5000,
      percentage: null,
      pairedSampleSize: 1,
    });
    expect(
      pairedDifference([
        { proposed: 100000, offered: 110000 },
        { proposed: 200000, offered: 220000 },
      ]),
    ).toEqual({ absoluteCents: 15000, percentage: 10, pairedSampleSize: 2 });
    expect(pairedDifference([])).toEqual({
      absoluteCents: null,
      percentage: null,
      pairedSampleSize: 0,
    });
  });

  it('inclui o bucket seniority: null e ordena por currency/salaryPeriod/seniority', () => {
    const inputs: SeniorityMoneyInput[] = [
      {
        ...money('BRL', SalaryPeriod.MONTH, 900000, 1000000),
        seniority: Seniority.SENIOR,
      },
      { ...money('BRL', SalaryPeriod.MONTH, 700000, 800000), seniority: null },
      {
        ...money('USD', SalaryPeriod.YEAR, 12000000, 13200000),
        seniority: Seniority.LEAD,
      },
    ];

    const buckets = groupBySeniority(inputs);

    expect(
      buckets.map((bucket) => [bucket.currency, bucket.salaryPeriod, bucket.seniority]),
    ).toEqual([
      ['BRL', SalaryPeriod.MONTH, null],
      ['BRL', SalaryPeriod.MONTH, Seniority.SENIOR],
      ['USD', SalaryPeriod.YEAR, Seniority.LEAD],
    ]);
    expect(buckets[0].proposed.averageCents).toBe(700000);
  });

  it('expande uma candidatura em várias skills e ordena por skillName/skillId', () => {
    const node = { skillId: 'skill-node', skillName: 'Node.js' };
    const typeScript = { skillId: 'skill-ts', skillName: 'TypeScript' };
    const inputs: SkillMoneyInput[] = [
      {
        ...money('BRL', SalaryPeriod.MONTH, 100000, 110000),
        ...node,
      },
      {
        ...money('BRL', SalaryPeriod.MONTH, 100000, 110000),
        ...typeScript,
      },
      {
        ...money('BRL', SalaryPeriod.MONTH, 200000, null),
        ...node,
      },
    ];

    const buckets = groupBySkill(inputs);

    expect(buckets.map((bucket) => bucket.skillName)).toEqual([
      'Node.js',
      'TypeScript',
    ]);
    expect(buckets[0].applicationCount).toBe(2);
    expect(buckets[0].proposed).toEqual({
      count: 2,
      minCents: 100000,
      maxCents: 200000,
      averageCents: 150000,
    });
    expect(buckets[0].offered.count).toBe(1);
    expect(buckets[0].difference).toEqual({
      absoluteCents: 10000,
      percentage: 10,
      pairedSampleSize: 1,
    });
    expect(buckets[1].difference.pairedSampleSize).toBe(1);

    const currencyTotal = groupByCurrency([
      money('BRL', SalaryPeriod.MONTH, 100000, 110000),
      money('BRL', SalaryPeriod.MONTH, 200000, null),
    ]).reduce((sum, bucket) => sum + bucket.applicationCount, 0);
    const skillTotal = buckets.reduce(
      (sum, bucket) => sum + bucket.applicationCount,
      0,
    );
    expect(currencyTotal).toBe(2);
    expect(skillTotal).toBe(3);
  });
});
