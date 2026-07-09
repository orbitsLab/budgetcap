import { prisma } from "@/lib/prisma";

export async function getEnvelopesDb(householdId: string) {
  return prisma.envelopeSet.findMany({
    where: { householdId },
    orderBy: { position: "asc" },
    include: {
      envelopes: {
        orderBy: { position: "asc" },
      },
    },
  });
}

export async function getEnvelopeSetsWithDataDb(
  householdId: string,
  month: number,
  year: number
) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const sets = await prisma.envelopeSet.findMany({
    where: { householdId },
    orderBy: { position: "asc" },
    include: {
      envelopes: {
        where: { isArchived: false },
        orderBy: { position: "asc" },
        include: {
          allocations: {
            where: { month, year },
          },
          // Outgoing: EXPENSE + TRANSFER where this is the source envelope
          transactions: {
            where: {
              type: { in: ["EXPENSE", "TRANSFER"] },
              date: { gte: monthStart, lt: monthEnd },
            },
          },
          // Incoming: TRANSFER where this is the destination envelope
          transfersTo: {
            where: {
              type: "TRANSFER",
              date: { gte: monthStart, lt: monthEnd },
            },
          },
        },
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return sets.map((set: any) => ({
    id: set.id,
    name: set.name,
    position: set.position,
    accountId: set.accountId,
    startsOnDay: set.startsOnDay,
    envelopes: set.envelopes.map((env: any) => {
      const allocatedPaise = env.allocations[0]?.amountInPaise ?? 0;

      // Sum expenses + outgoing transfers
      const spentPaise = env.transactions.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: number, t: any) => sum + t.amountInPaise,
        0
      );

      // Sum incoming transfers (money received into this envelope)
      const receivedTransferPaise = env.transfersTo.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: number, t: any) => sum + t.amountInPaise,
        0
      );

      const availablePaise = allocatedPaise - spentPaise + receivedTransferPaise;

      return {
        id: env.id,
        name: env.name,
        isArchived: env.isArchived,
        position: env.position,
        allocatedPaise,
        spentPaise,
        receivedTransferPaise,
        availablePaise,
        isGoal: env.isGoal,
        goalAmountInPaise: env.goalAmountInPaise,
        goalDeadline: env.goalDeadline,
        initialAmountInPaise: env.initialAmountInPaise ?? 0,
      };
    }),
  }));
}

export async function getEnvelopeRolloverDb(
  envelopeId: string,
  month: number,
  year: number
): Promise<number> {
  const boundary = new Date(year, month - 1, 1);

  const [
    allocationAgg,
    expenseAgg,
    incomeAgg,
    outgoingTransferAgg,
    incomingTransferAgg,
  ] = await Promise.all([
    // All allocations before this month
    prisma.allocation.aggregate({
      where: {
        envelopeId,
        OR: [
          { year: { lt: year } },
          { year, month: { lt: month } },
        ],
      },
      _sum: { amountInPaise: true },
    }),
    // Expenses from this envelope before this month
    prisma.transaction.aggregate({
      where: {
        envelopeId,
        type: "EXPENSE",
        date: { lt: boundary },
      },
      _sum: { amountInPaise: true },
    }),
    // Income into this envelope before this month
    prisma.transaction.aggregate({
      where: {
        envelopeId,
        type: "INCOME",
        date: { lt: boundary },
      },
      _sum: { amountInPaise: true },
    }),
    // Outgoing transfers FROM this envelope before this month
    prisma.transaction.aggregate({
      where: {
        envelopeId,
        type: "TRANSFER",
        date: { lt: boundary },
      },
      _sum: { amountInPaise: true },
    }),
    // Incoming transfers TO this envelope before this month
    prisma.transaction.aggregate({
      where: {
        toEnvelopeId: envelopeId,
        type: "TRANSFER",
        date: { lt: boundary },
      },
      _sum: { amountInPaise: true },
    }),
  ]);

  const totalAllocated = allocationAgg._sum.amountInPaise ?? 0;
  const totalSpent = expenseAgg._sum.amountInPaise ?? 0;
  const totalIncome = incomeAgg._sum.amountInPaise ?? 0;
  const totalOutgoingTransfers = outgoingTransferAgg._sum.amountInPaise ?? 0;
  const totalIncomingTransfers = incomingTransferAgg._sum.amountInPaise ?? 0;

  // Rollover = allocated + income received + incoming transfers - expenses - outgoing transfers
  return totalAllocated + totalIncome + totalIncomingTransfers - totalSpent - totalOutgoingTransfers;
}

export async function getEnvelopeSetsWithRolloverDb(
  householdId: string,
  month: number,
  year: number
) {
  const sets = await getEnvelopeSetsWithDataDb(householdId, month, year);

  const setsWithRollover = await Promise.all(
    sets.map(async (set: any) => ({
      ...set,
      envelopes: await Promise.all(
        set.envelopes.map(async (env: any) => {
          const rollover = await getEnvelopeRolloverDb(env.id, month, year);
          // spentPaise includes outgoing transfers; receivedTransferPaise must be added back
          const availablePaise = rollover + env.allocatedPaise - env.spentPaise + env.receivedTransferPaise;
          return { ...env, availablePaise };
        })
      ),
    }))
  );

  return setsWithRollover;
}

export async function getTotalIncomeDb(
  householdId: string,
  month: number,
  year: number
): Promise<number> {
  const result = await prisma.transaction.aggregate({
    where: {
      householdId,
      type: "INCOME",
      date: {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      },
    },
    _sum: { amountInPaise: true },
  });
  return result._sum.amountInPaise ?? 0;
}

export async function getTransactionsDb(
  householdId: string,
  options?: {
    envelopeId?: string;
    accountId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    householdId,
    ...(options?.envelopeId
      ? {
          OR: [
            { envelopeId: options.envelopeId },
            { toEnvelopeId: options.envelopeId },
          ],
        }
      : {}),
    ...(options?.accountId
      ? {
          OR: [
            { accountId: options.accountId },
            { toAccountId: options.accountId },
          ],
        }
      : {}),
    ...(options?.from || options?.to
      ? {
          date: {
            ...(options.from ? { gte: options.from } : {}),
            ...(options.to ? { lte: options.to } : {}),
          },
        }
      : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        envelope: { select: { id: true, name: true } },
        toEnvelope: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions: transactions.map((t: typeof transactions[number]) => ({
      ...t,
      type: t.type as "INCOME" | "EXPENSE" | "TRANSFER",
    })),
    total,
  };
}
