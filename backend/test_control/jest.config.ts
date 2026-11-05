import { createDefaultPreset } from 'ts-jest';

// Run only through scripts/control-scenario.sh: it starts the server, the database and the SDK build.
/** @returns {Promise<import('jest').Config>} */
module.exports = async () => {
  return {
    displayName: 'Control scenario',
    roots: ['./'],
    testTimeout: 120000,
    testRegex: '.control.ts$',
    transform: {
      ...createDefaultPreset().transform,
    },
    testEnvironment: 'node',
  };
};
