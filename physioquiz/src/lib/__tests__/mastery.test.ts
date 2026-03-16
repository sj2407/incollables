import { getMasteryColor, getMasteryLabel } from '../mastery';

describe('getMasteryColor', () => {
  it('returns gray for null (not attempted)', () => {
    expect(getMasteryColor(null)).toBe('#BDC3C7');
  });

  it('returns gray for -1 (not attempted)', () => {
    expect(getMasteryColor(-1)).toBe('#BDC3C7');
  });

  it('returns dark red for 0%', () => {
    expect(getMasteryColor(0)).toBe('#C0392B');
  });

  it('returns dark red for 15%', () => {
    expect(getMasteryColor(15)).toBe('#C0392B');
  });

  it('returns light red for 20%', () => {
    expect(getMasteryColor(20)).toBe('#E74C3C');
  });

  it('returns light red for 35%', () => {
    expect(getMasteryColor(35)).toBe('#E74C3C');
  });

  it('returns orange for 40%', () => {
    expect(getMasteryColor(40)).toBe('#F39C12');
  });

  it('returns orange for 55%', () => {
    expect(getMasteryColor(55)).toBe('#F39C12');
  });

  it('returns yellow-green for 60%', () => {
    expect(getMasteryColor(60)).toBe('#F1C40F');
  });

  it('returns yellow-green for 70%', () => {
    expect(getMasteryColor(70)).toBe('#F1C40F');
  });

  it('returns light green for 75%', () => {
    expect(getMasteryColor(75)).toBe('#2ECC71');
  });

  it('returns light green for 85%', () => {
    expect(getMasteryColor(85)).toBe('#2ECC71');
  });

  it('returns dark green for 90%', () => {
    expect(getMasteryColor(90)).toBe('#27AE60');
  });

  it('returns dark green for 100%', () => {
    expect(getMasteryColor(100)).toBe('#27AE60');
  });
});

describe('getMasteryLabel', () => {
  it('returns "Non tenté" for null', () => {
    expect(getMasteryLabel(null)).toBe('Non tenté');
  });

  it('returns "Lacune grave" for 0%', () => {
    expect(getMasteryLabel(0)).toBe('Lacune grave');
  });

  it('returns "En difficulté" for 25%', () => {
    expect(getMasteryLabel(25)).toBe('En difficulté');
  });

  it('returns "En progression" for 50%', () => {
    expect(getMasteryLabel(50)).toBe('En progression');
  });

  it('returns "Correct" for 65%', () => {
    expect(getMasteryLabel(65)).toBe('Correct');
  });

  it('returns "Bon" for 80%', () => {
    expect(getMasteryLabel(80)).toBe('Bon');
  });

  it('returns "Maîtrisé" for 95%', () => {
    expect(getMasteryLabel(95)).toBe('Maîtrisé');
  });
});
