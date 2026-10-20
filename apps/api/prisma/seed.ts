import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@amanit.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const passwordHash = await bcrypt.hash(password, 10);

  // Clear demo / previous seed data
  await prisma.order.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.user.deleteMany({
    where: {
      email: { in: ["admin@amanit.local", "admin@amanit.com"] },
    },
  });

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Amanit Admin",
    },
  });

  console.log(`Seeded admin ${email} (no dummy conversations/orders)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
