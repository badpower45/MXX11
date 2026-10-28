export function summarizeConversions(
  conversions: Array<{ unitName: string; ratioToBase: number }>,
  baseUnitName: string | null | undefined
) {
  if (!conversions.length || !baseUnitName) {
    return 'No pack conversions';
  }

  return conversions
    .map((conversion) =>
      `1 ${conversion.unitName.toLowerCase()} = ${conversion.ratioToBase} ${baseUnitName.toLowerCase()}${
        conversion.ratioToBase === 1 ? '' : 's'
      }`
    )
    .join(' | ');
}
