import { elementForArea } from './area-elements';

const clock = { selector: 'id:clock', bounds: { x: 100, y: 40, width: 120, height: 40 } };
const header = { selector: 'id:header', bounds: { x: 0, y: 0, width: 1080, height: 200 } };
const elements = [header, clock];

describe('elementForArea', () => {
  it('finds the element a noisy area covers', () => {
    expect(elementForArea({ x: 99, y: 39, width: 122, height: 42 }, elements)).toBe(clock);
  });

  it('suggests an element only when it and the area overlap by 90 %', () => {
    // the area is mostly the clock, but twice its height
    expect(elementForArea({ x: 100, y: 40, width: 120, height: 80 }, elements)).toBeNull();
    // the area is a small part of the header
    expect(elementForArea({ x: 0, y: 0, width: 500, height: 200 }, elements)).toBeNull();
    expect(elementForArea({ x: 0, y: 0, width: 1080, height: 190 }, elements)).toBe(header);
  });

  it('finds nothing where there are no elements', () => {
    expect(elementForArea({ x: 0, y: 900, width: 10, height: 10 }, elements)).toBeNull();
  });
});
