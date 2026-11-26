/**
 * Normalización y validación de tipos para estandarizar los datos al modelo oficial de Kru.
 */


export function normalizeHeader(header) {
  if (!header) return '';
  return String(header)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeDocument(raw) {
  if (raw === null || raw === undefined) return { value: '', valid: false, error: 'Documento vacío' };

  const cleaned = String(raw).trim().toUpperCase().replace(/[\s.-]/g, '');
  if (!cleaned) return { value: '', valid: false, error: 'Documento vacío' };

  const match = cleaned.match(/^([VE])?(\d{5,10})$/);
  if (!match) {
    return {
      value: cleaned,
      valid: false,
      error: `Formato de documento inválido: "${raw}"`,
    };
  }

  const prefix = match[1] || 'V';
  const digits = match[2];
  return {
    value: `${prefix}${digits}`,
    valid: true,
    error: null,
  };
}

export function normalizeAmount(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { value: null, valid: false, error: 'Monto vacío' };
  }

  let str = String(raw)
    .trim()
    .replace(/["'$€BsVESusd\s]/gi, '');

  if (!str) return { value: null, valid: false, error: 'Monto vacío' };

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length === 3 && Number(parts[0]) >= 1) {
      str = str.replace(',', '');
    } else {
      str = str.replace(',', '.');
    }
  } else if (hasDot) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      str = str.replace('.', '');
    } else if (parts.length > 2) {
      str = str.replace(/\./g, '');
    }
  }

  const num = Number(str);
  if (Number.isNaN(num)) {
    return {
      value: raw,
      valid: false,
      error: `El monto "${raw}" no es un número válido`,
    };
  }

  return {
    value: Number(num.toFixed(2)),
    valid: true,
    error: null,
  };
}

export function normalizeDate(raw) {
  if (!raw || String(raw).trim() === '') {
    return { value: '', valid: false, error: 'Fecha vacía' };
  }

  const str = String(raw).trim();
  let year, month, day;

  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const latamMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (latamMatch) {
    day = Number(latamMatch[1]);
    month = Number(latamMatch[2]);
    year = Number(latamMatch[3]);
  } else {
    return {
      value: str,
      valid: false,
      error: `Formato de fecha irreconocible: "${raw}"`,
    };
  }

  const dateObj = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    dateObj.getUTCFullYear() === year &&
    dateObj.getUTCMonth() === month - 1 &&
    dateObj.getUTCDate() === day;

  if (!isRealDate) {
    return {
      value: str,
      valid: false,
      error: `Fecha inexistente en calendario: "${raw}"`,
    };
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return {
    value: `${year}-${mm}-${dd}`,
    valid: true,
    error: null,
  };
}

const MONTHS_ES = {
  ene: '01', enero: '01',
  feb: '02', febrero: '02',
  mar: '03', marzo: '03',
  abr: '04', abril: '04',
  may: '05', mayo: '05',
  jun: '06', junio: '06',
  jul: '07', julio: '07',
  ago: '08', agosto: '08',
  sep: '09', sept: '09', septiembre: '09',
  oct: '10', octubre: '10',
  nov: '11', noviembre: '11',
  dic: '12', diciembre: '12',
};

export function normalizePeriod(raw) {
  if (!raw || String(raw).trim() === '') {
    return { value: '', valid: false, error: 'Período vacío' };
  }

  const str = String(raw).trim().toLowerCase();

  const ymMatch = str.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ymMatch) {
    const year = ymMatch[1];
    const month = Number(ymMatch[2]);
    if (month >= 1 && month <= 12) {
      return { value: `${year}-${String(month).padStart(2, '0')}`, valid: true, error: null };
    }
  }

  const myMatch = str.match(/^(\d{1,2})[-/](\d{4})$/);
  if (myMatch) {
    const month = Number(myMatch[1]);
    const year = myMatch[2];
    if (month >= 1 && month <= 12) {
      return { value: `${year}-${String(month).padStart(2, '0')}`, valid: true, error: null };
    }
  }

  const textMatch = str.match(/^([a-z]+)[-\s/](\d{4})$/);
  if (textMatch && MONTHS_ES[textMatch[1]]) {
    return {
      value: `${textMatch[2]}-${MONTHS_ES[textMatch[1]]}`,
      valid: true,
      error: null,
    };
  }

  return {
    value: raw,
    valid: false,
    error: `Período inválido (esperado YYYY-MM): "${raw}"`,
  };
}

export function normalizeCurrency(raw) {
  if (!raw || String(raw).trim() === '') {
    return { value: '', valid: false, error: 'Moneda vacía' };
  }

  const clean = String(raw).trim().toUpperCase();
  if (['USD', '$', 'DOLAR', 'DOLARES', 'US$'].includes(clean)) {
    return { value: 'USD', valid: true, error: null };
  }
  if (['VES', 'BS', 'BS.', 'BS.S', 'BOLIVARES', 'BOLIVAR'].includes(clean)) {
    return { value: 'VES', valid: true, error: null };
  }
  if (['EUR', '€', 'EURO', 'EUROS'].includes(clean)) {
    return { value: 'EUR', valid: true, error: null };
  }

  if (/^[A-Z]{3}$/.test(clean)) {
    return { value: clean, valid: true, error: null };
  }

  return {
    value: clean,
    valid: false,
    error: `Moneda no soportada: "${raw}"`,
  };
}

export function normalizePayFrequency(raw) {
  if (!raw || String(raw).trim() === '') {
    return { value: '', valid: false, error: 'Frecuencia de pago vacía' };
  }

  const clean = String(raw).trim().toLowerCase();
  if (['semanal', 's', 'sem', '7', 'cada 7 dias', 'cada 7 días'].includes(clean)) {
    return { value: 'semanal', valid: true, error: null };
  }
  if (['quincenal', 'q', 'quincena', '15nal', '15', 'cada 15 dias', 'cada 15 días'].includes(clean)) {
    return { value: 'quincenal', valid: true, error: null };
  }
  if (['mensual', 'm', 'mes', '30', 'cada 30 dias', 'cada 30 días'].includes(clean)) {
    return { value: 'mensual', valid: true, error: null };
  }

  if (clean.length >= 2) {
    return { value: clean, valid: true, error: null };
  }

  return {
    value: clean,
    valid: false,
    error: `Frecuencia de pago inválida: "${raw}"`,
  };
}

export function normalizeBonusFrequency(raw) {
  if (!raw || String(raw).trim() === '') {
    return { value: '', valid: false, error: 'Frecuencia de bono vacía' };
  }

  const clean = String(raw)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (['unico', 'unica', '1', 'una vez', 'eventual'].includes(clean)) {
    return { value: 'único', valid: true, error: null };
  }
  if (['mensual', 'm', 'mes'].includes(clean)) {
    return { value: 'mensual', valid: true, error: null };
  }
  if (['trimestral', 't', 'trimestre', 'cada 3 meses'].includes(clean)) {
    return { value: 'trimestral', valid: true, error: null };
  }
  if (['anual', 'a', 'ano', 'anio', 'cada ano'].includes(clean)) {
    return { value: 'anual', valid: true, error: null };
  }

  if (clean.length >= 2) {
    return { value: String(raw).trim().toLowerCase(), valid: true, error: null };
  }

  return {
    value: raw,
    valid: false,
    error: `Frecuencia de bono no permitida: "${raw}"`,
  };
}

export function normalizePersonName(raw) {
  if (!raw || String(raw).trim() === '') {
    return { value: '', valid: false, error: 'Nombre vacío' };
  }

  const formatted = String(raw)
    .trim()
    .replace(/,/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return {
    value: formatted,
    valid: true,
    error: null,
  };
}

export function splitFullName(fullName) {
  const rawStr = String(fullName || '').trim();
  if (!rawStr) return { nombre: '', apellido: '' };

  if (rawStr.includes(',')) {
    const [lastPart, firstPart] = rawStr.split(',').map((s) => s.trim());
    return {
      nombre: firstPart ? normalizePersonName(firstPart).value : '',
      apellido: lastPart ? normalizePersonName(lastPart).value : '',
    };
  }

  const parts = rawStr.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { nombre: normalizePersonName(parts[0]).value, apellido: '' };
  }
  if (parts.length === 2) {
    return {
      nombre: normalizePersonName(parts[0]).value,
      apellido: normalizePersonName(parts[1]).value,
    };
  }

  return {
    nombre: normalizePersonName(parts.slice(0, 2).join(' ')).value,
    apellido: normalizePersonName(parts.slice(2).join(' ')).value,
  };
  
}