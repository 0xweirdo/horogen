import { createPrismaClient } from './index.js';

const prisma = createPrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { clerkId: 'dev_local_user' },
    update: {},
    create: {
      clerkId: 'dev_local_user',
      email: 'dev@horogen.local',
      plan: 'free',
    },
  });

  const existing = await prisma.project.findFirst({
    where: { userId: user.id, title: 'Demo — first talking avatar' },
  });
  if (!existing) {
    await prisma.project.create({
      data: {
        userId: user.id,
        title: 'Demo — first talking avatar',
        scriptConfig: {
          script: 'สวัสดีครับ ยินดีต้อนรับสู่ Horogen',
          voiceId: 'th-TH-NiwatNeural',
        },
      },
    });
  }

  console.log(`seeded dev user ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
