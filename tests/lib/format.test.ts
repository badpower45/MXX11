import { compactNumber, dateTime, money, shortDate } from '../../lib/format';

describe('lib/format', () => {
  it('formats Egyptian pound values by default', () => {
    expect(money(1234.5)).toBe('ج.م ١٬٢٣٤٫٥٠');
    expect(money('99.9')).toBe('ج.م ٩٩٫٩٠');
    expect(money('bad-input')).toBe('ج.م ٠٫٠٠');
  });

  it('formats dates for the Egypt locale and timezone', () => {
    const value = '2026-04-06T08:15:00.000Z';

    expect(shortDate(value)).toContain('أبريل');
    expect(dateTime(value)).toContain('١٠:١٥');
  });

  it('formats compact numbers without crashing', () => {
    expect(compactNumber(1200)).toBe('١٫٢ ألف');
  });
});
