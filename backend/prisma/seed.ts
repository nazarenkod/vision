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

// As MIN_PASSWORD_LENGTH in src/users/account.ts (045): the seed image is built without src.
const MIN_PASSWORD_LENGTH = 12;

/**
 * Why the first admin cannot get DEFAULT_USER_PASSWORD, or null. There is no fallback password:
 * a known one would open every Vision whose admin forgot to set it (082).
 */
export function defaultPasswordProblem(password: string): string | null {
  if (!password.trim()) return 'DEFAULT_USER_PASSWORD is not set';
  return password.length < MIN_PASSWORD_LENGTH
    ? `DEFAULT_USER_PASSWORD needs at least ${MIN_PASSWORD_LENGTH} characters`
    : null;
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
  const defaultPassword = process.env.DEFAULT_USER_PASSWORD ?? '';

  // Only create default user if the db has no admin user
  if (!userList.some(({ role, isActive }) => role === Role.admin && isActive)) {
    const problem = defaultPasswordProblem(defaultPassword);
    if (problem) {
      // a non-zero exit stops the migration container, so the API does not start without an admin
      console.error(`No admin is created: ${problem}. Set it in .env.demo (12+ characters) and start again.`);
      process.exitCode = 1;
      return;
    }
    const salt = await genSalt(10);
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
        // the password itself is never printed: logs outlive the first sign-in (082)
        console.log(
          `The user with the email "${defaultEmail}" and the password from DEFAULT_USER_PASSWORD was created (if not changed before)`
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
    // a count only: the rows hold sealed Jira tokens and Gemini keys (rule 7)
    console.log(`Projects: ${projectList.length}`);
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
