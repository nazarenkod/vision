/**
 * @see https://www.prisma.io/docs/guides/migrate/seed-database
 */
import type { Prisma } from '@prisma/client';
import { Role } from '@prisma/client';
import { genSalt, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';

import prisma from './client';

export async function seed() {
  await prisma.$connect();
  console.log('Seeding default data...');
  await Promise.all([createDefaultUser(), createDefaultProject()]);
  await prisma.$disconnect();
}

seed()
  .catch((e) => console.error('e', e))
  .finally(async () => await prisma.$disconnect());

/** The SHA-256 the API looks keys up by, as `hashApiKey` in src/shared/api-key-hash.ts makes it. */
function storedApiKey(key: string | undefined): string {
  return (
    'sha256:' +
    createHash('sha256')
      .update(key?.trim() || randomBytes(32).toString('hex'))
      .digest('hex')
  );
}

async function createDefaultUser() {
  let userList: Prisma.UserGetPayload<undefined>[] = [];
  try {
    // never logged: the rows hold password hashes (rule 7)
    userList = await prisma.user.findMany();
  } catch (error) {
    // Expected to see that "user" table does not exist
    console.log(error.message);
  }

  const defaultEmail = process.env.DEFAULT_USER_EMAIL || 'admin@vision.local';
  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || '123456';
  const salt = await genSalt(10);

  // Only create default user if the db has no admin user
  if (!userList.some(({ role, isActive }) => role === Role.admin && isActive)) {
    await prisma.user
      .upsert({
        where: {
          email: defaultEmail,
        },
        update: {
          role: Role.admin,
        },
        create: {
          email: defaultEmail,
          firstName: 'fname',
          lastName: 'lname',
          role: Role.admin,
          // stored as the API stores keys (044); without DEFAULT_USER_API_KEY nobody knows the key,
          // and the admin makes one in the profile
          apiKey: storedApiKey(process.env.DEFAULT_USER_API_KEY),
          password: await hash(defaultPassword, salt),
        },
      })
      .then(() => {
        console.log('###########################');
        console.log('####### DEFAULT USER ######');
        console.log('###########################');
        console.log('');
        console.log(
          `The user with the email "${defaultEmail}" and password "${defaultPassword}" was created (if not changed before)`
        );
        console.log(
          process.env.DEFAULT_USER_API_KEY
            ? 'The API key is the one in DEFAULT_USER_API_KEY'
            : 'Make an API key in the profile'
        );
      });
  }
}

async function createDefaultProject() {
  let projectList: Prisma.ProjectGetPayload<undefined>[] = [];
  try {
    projectList = await prisma.project.findMany();
    console.log(projectList);
  } catch (error) {
    // Expected to see that "project" table does not exist
    console.log(error.message);
  }

  if (projectList.length === 0) {
    await prisma.project
      .create({
        data: {
          name: 'Default project',
        },
      })
      .then((project) => {
        console.log('##############################');
        console.log('## CREATING DEFAULT PROJECT ##');
        console.log('##############################');
        console.log('');
        console.log(`Project key: ${project.id}`);
        console.log(`Project name ${project.name}`);
        console.log(`Project name ${project.mainBranchName}`);
      });
  }
}
