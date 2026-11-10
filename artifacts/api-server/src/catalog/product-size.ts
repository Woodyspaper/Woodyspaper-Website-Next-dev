/** Extract the first explicit dimensions, not pack quantities, weights or SKU digits. */
export function sizeFromName(name: string): string | undefined {
  const fractions: Record<string, string> = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
  const normalized = name.replace(/[½¼¾⅛⅜⅝⅞]/g, char => ` ${fractions[char]}`);
  const number = String.raw`\d+(?:[ -]\d+\/\d+|\/\d+|\.\d+)?`;
  const unit = String.raw`(?:mm|cm|inches|inch|in\.?|ft|feet|["″])`;
  const dimension = `${number}\\s*(?:${unit})?`;
  const pattern = new RegExp(`(?<![\\w./-])(${dimension})\\s*[x×]\\s*(${dimension})(?:\\s*[x×]\\s*(${dimension}))?(?![\\w./-])`, 'i');
  const match = normalized.match(pattern);
  if (!match) return undefined;
  const dimensions = match.slice(1).filter((part): part is string => !!part).map(part => {
    const value = part.match(new RegExp(`^(${number})\\s*(${unit})?$`, 'i'));
    if (!value) return undefined;
    const text = value[1];
    const mixed = text.match(/^(\d+)[ -](\d+)\/(\d+)$/);
    const fraction = text.match(/^(\d+)\/(\d+)$/);
    const amount = mixed ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
      : fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(text);
    if (!Number.isFinite(amount) || amount <= 0) return undefined;
    const suffix = (value[2] || '').toLowerCase();
    const units = /^(in|inch|inches|in\.|"|″)$/.test(suffix) ? 'in' : suffix === 'feet' ? 'ft' : suffix;
    return { amount: String(Number(amount.toFixed(6))), units };
  });
  if (dimensions.some(d => !d)) return undefined;
  const parts = dimensions.filter((d): d is NonNullable<typeof d> => !!d);
  const explicitUnits = [...new Set(parts.map(p => p.units).filter(Boolean))];
  // A trailing unit applies to every dimension; don't equate mm with inches.
  if (explicitUnits.length <= 1) return `${parts.map(p => p.amount).join(' × ')}${explicitUnits[0] ? ` ${explicitUnits[0]}` : ''}`;
  return parts.map(p => `${p.amount}${p.units ? ` ${p.units}` : ''}`).join(' × ');
}
