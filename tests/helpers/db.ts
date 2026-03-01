import { prisma } from "../../src/lib/prisma";

export const TEST_USER_1 = "00000000-0000-0000-0000-000000000001";
export const TEST_USER_2 = "00000000-0000-0000-0000-000000000002";

export const resetDatabase = async () => {
  await prisma.$transaction(async (tx) => {
    await tx.idempotencyKey.deleteMany();
    await tx.productTransaction.deleteMany();
    await tx.transaction.deleteMany();

    await tx.transaction.createMany({
      data: [
        {
          id: "10000000-0000-0000-0000-000000000001",
          userId: TEST_USER_1,
          amount: -500,
        },
      ],
      skipDuplicates: true,
    });
  });
};
