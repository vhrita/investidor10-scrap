export function parseMonetaryValue(originalValue) {
    if (!originalValue) return null;

    let value = originalValue
        .replace('R$', '')
        .replace('US$', '')
        .replace(/Milhões|M/gi, 'e6')
        .replace(/Bilhões|B/gi, 'e9')
        .replace(/\s/g, '')
        .replace('.', '')
        .trim();
    value = value.replace(',', '.');
    const numericValue = parseFloat(value);
    return isNaN(numericValue) ? null : numericValue;
}