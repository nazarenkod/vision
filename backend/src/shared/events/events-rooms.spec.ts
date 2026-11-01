import { groupByProject, projectRoom } from './events-rooms';

describe('groupByProject', () => {
  it('groups records by project', () => {
    const items = [
      { id: 1, projectId: 'a' },
      { id: 2, projectId: 'b' },
      { id: 3, projectId: 'a' },
    ];
    expect(groupByProject(items, (i) => i.projectId)).toEqual(
      new Map([
        ['a', [items[0], items[2]]],
        ['b', [items[1]]],
      ])
    );
  });

  it('drops records whose project is unknown', () => {
    expect(groupByProject([{ projectId: null }], (i) => i.projectId).size).toBe(0);
  });
});

describe('projectRoom', () => {
  it('names one room per project', () => {
    expect(projectRoom('p1')).toBe('project:p1');
  });
});
