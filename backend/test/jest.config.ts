import { createDefaultPreset } from 'ts-jest';

/** @returns {Promise<import('jest').Config>} */
export default async () => {
  return {
    displayName: 'E2E Tests',
    roots: ['./'],
    testTimeout: 30000,
    testRegex: '.e2e-spec.ts$',
    transform: {
      ...createDefaultPreset().transform,
    },
    coverageDirectory: '../coverage',
    testEnvironment: 'node',
  };
};
