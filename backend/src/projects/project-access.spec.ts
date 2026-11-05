import { Role } from '@prisma/client';
import { inBody, inParam, inQuery, mayReach, valuesOf } from './project-access';

describe('project access', () => {
  it('lets an admin into every project without a grant', () => {
    expect(mayReach({ role: Role.admin }, ['a', 'b'], new Set())).toBe(true);
    expect(mayReach({ role: Role.editor }, ['a', 'b'], new Set(['a', 'b']))).toBe(true);
    // every project a request names, not one of them
    expect(mayReach({ role: Role.editor }, ['a', 'b'], new Set(['a']))).toBe(false);
    // the role does not widen access: a guest given a project reads it, as before
    expect(mayReach({ role: Role.guest }, ['a'], new Set(['a']))).toBe(true);
    expect(mayReach(null, ['a'], new Set(['a']))).toBe(false);
  });

  it('gives a new account no project', () => {
    // nothing is given at creation: only the migration gave everyone access once (REQ-042-10)
    for (const role of [Role.editor, Role.guest]) expect(mayReach({ role }, ['any'], new Set())).toBe(false);
  });

  it('reads the value a route names from the request', () => {
    const request = { params: { id: 'p' }, query: { buildId: 'b' }, body: ['r1', 'r2', 7] };
    expect(valuesOf(inParam('id', 'project'), request)).toEqual(['p']);
    expect(valuesOf(inQuery('buildId', 'build'), request)).toEqual(['b']);
    expect(valuesOf(inBody(undefined, 'testRuns'), request)).toEqual(['r1', 'r2']);
    expect(valuesOf(inBody('ids', 'testRuns'), { body: { ids: ['r3'] } })).toEqual(['r3']);
    expect(valuesOf(inBody('projectId', 'project'), { body: {} })).toEqual([]);
    expect(valuesOf(inBody('projectId', 'project'), {})).toEqual([]);
  });
});
