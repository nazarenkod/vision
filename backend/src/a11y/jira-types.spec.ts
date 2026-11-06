import { jiraTypesFor } from './jira-types';

describe('jiraTypesFor', () => {
  it('lists each name once, sorted, a sub-task anywhere counting as one', () => {
    const lists = jiraTypesFor(
      [
        { id: '1', name: 'Bug', subtask: false },
        { id: '2', name: 'Sub-bug', subtask: true },
        { id: '3', name: 'bug', subtask: false },
        { id: '4', name: 'Story', subtask: false },
        { id: '5', name: ' ', subtask: false },
      ],
      [
        { name: 'Relates', inward: 'relates to', outward: 'relates to' },
        { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
        { name: 'relates', inward: '', outward: '' },
      ]
    );
    expect(lists.issueTypes).toEqual([
      { name: 'Bug', subtask: false },
      { name: 'Story', subtask: false },
      { name: 'Sub-bug', subtask: true },
    ]);
    expect(lists.linkTypes).toEqual(['Blocks', 'Relates']);
  });
});
