import Papa from 'papaparse';
import { KRU_BLOCKS, KRU_SCHEMAS } from './schema';
import {
  normalizeHeader,
  normalizeDocument,
  normalizeAmount,
  normalizeDate,
  normalizePeriod,
  normalizeCurrency,
  normalizePayFrequency,
  normalizeBonusFrequency,
  splitFullName,
} from './normalizers';

function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        resolve({
          fileName: file.name,
          rawHeaders: results.meta.fields || [],
          rawRows: results.data || [],
          parseErrors: results.errors || [],
        });
      },
      error: (err) => reject(err),
    });
  });
}

function detectBlockId(rawHeaders) {
  const normHeaders = rawHeaders.map(normalizeHeader);
  let bestMatchId = null;
  let highestScore = 0;

  for (const block of KRU_BLOCKS) {
    const schema = KRU_SCHEMAS[block.id];
    let score = 0;

    for (const sigKey of schema.signatureFields) {
      const colDef = schema.columns.find((c) => c.key === sigKey);
      if (colDef && normHeaders.some((h) => colDef.synonyms.includes(h))) {
        score += 3;
      }
    }

    for (const colDef of schema.columns) {
      if (normHeaders.some((h) => colDef.synonyms.includes(h))) {
        score += 1;
      }
    }

    if (schema.compositeSynonyms) {
      for (const synList of Object.values(schema.compositeSynonyms)) {
        if (normHeaders.some((h) => synList.includes(h))) {
          score += 2;
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatchId = block.id;
    }
  }

  return highestScore >= 4 ? bestMatchId : null;
}

function buildHeaderMapping(rawHeaders, schema) {
  const mapping = {};
  const compositeMapping = {};

  const headerPairs = rawHeaders.map((raw) => ({
    raw,
    norm: normalizeHeader(raw),
  }));

  for (const col of schema.columns) {
    const found = headerPairs.find((hp) => col.synonyms.includes(hp.norm));
    if (found) {
      mapping[col.key] = found.raw;
    }
  }

  if (schema.compositeSynonyms) {
    for (const [compKey, synList] of Object.entries(schema.compositeSynonyms)) {
      const found = headerPairs.find((hp) => synList.includes(hp.norm));
      if (found) {
        compositeMapping[compKey] = found.raw;
      }
    }
  }

  return { mapping, compositeMapping };
}


function normalizeFieldByType(type, rawValue) {
  const strVal = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim();

  switch (type) {
    case 'documento':
      return normalizeDocument(strVal);
    case 'amount':
      return normalizeAmount(strVal);
    case 'date':
      return normalizeDate(strVal);
    case 'period':
      return normalizePeriod(strVal);
    case 'currency':
      return normalizeCurrency(strVal);
    case 'pay_frequency':
      return normalizePayFrequency(strVal);
    case 'bonus_frequency':
      return normalizeBonusFrequency(strVal);
    case 'email': {
      if (!strVal) return { value: '', valid: true, error: null };
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(strVal)
        ? { value: strVal.toLowerCase(), valid: true, error: null }
        : { value: strVal, valid: false, error: `Email inválido: "${strVal}"` };
    }
    case 'year': {
      const y = Number(strVal);
      const isValidYear = Number.isInteger(y) && y >= 1980 && y <= 2035;
      return isValidYear
        ? { value: y, valid: true, error: null }
        : { value: strVal, valid: false, error: `Año inválido: "${strVal}"` };
    }
    case 'integer': {
      const n = Number(strVal);
      const isValidInt = strVal !== '' && Number.isInteger(n) && n >= 0;
      return isValidInt
        ? { value: n, valid: true, error: null }
        : { value: strVal, valid: false, error: `Número entero inválido: "${strVal}"` };
    }
    default:
      return { value: strVal, valid: true, error: null };
  }
}

export function validateAndNormalizeRow(blockId, rawRowObj, rowNumber, fileName) {
  const schema = KRU_SCHEMAS[blockId];
  const cleanRow = {};
  const rowErrors = [];
  const rowWarnings = [];

  for (const col of schema.columns) {
    const rawVal = rawRowObj[col.key];
    const strVal = rawVal === null || rawVal === undefined ? '' : String(rawVal).trim();

    if (col.required && strVal === '') {
      cleanRow[col.key] = '';
      rowErrors.push({
        file: fileName,
        block: schema.label,
        row: rowNumber,
        field: col.key,
        value: '',
        reason: `Campo obligatorio "${col.label}" vacío`,
      });
      continue;
    }

    if (!col.required && strVal === '') {
      cleanRow[col.key] = '';
      continue;
    }

    const res = normalizeFieldByType(col.type, strVal);
    cleanRow[col.key] = res.value;

    if (!res.valid) {
      rowErrors.push({
        file: fileName,
        block: schema.label,
        row: rowNumber,
        field: col.key,
        value: strVal,
        reason: res.error,
      });
    } else if (col.type === 'amount' && res.value < 0) {
      rowErrors.push({
        file: fileName,
        block: schema.label,
        row: rowNumber,
        field: col.key,
        value: strVal,
        reason: `El monto en "${col.label}" no puede ser negativo (${res.value})`,
      });
    }
  }

  if (blockId === 'historico_nomina') {
    if (
      typeof cleanRow.bruto === 'number' &&
      typeof cleanRow.neto === 'number' &&
      cleanRow.neto > cleanRow.bruto
    ) {
      rowWarnings.push({
        file: fileName,
        block: schema.label,
        row: rowNumber,
        field: 'neto',
        value: cleanRow.neto,
        reason: `El salario neto (${cleanRow.neto}) es mayor que el bruto (${cleanRow.bruto})`,
      });
    }
  }

  if (blockId === 'historico_vacaciones') {
    if (
      typeof cleanRow.dias_correspondientes === 'number' &&
      typeof cleanRow.dias_tomados === 'number' &&
      cleanRow.dias_tomados > cleanRow.dias_correspondientes
    ) {
      rowWarnings.push({
        file: fileName,
        block: schema.label,
        row: rowNumber,
        field: 'dias_tomados',
        value: cleanRow.dias_tomados,
        reason: `Días tomados (${cleanRow.dias_tomados}) excede los días correspondientes (${cleanRow.dias_correspondientes})`,
      });
    }
  }

  return { cleanRow, rowErrors, rowWarnings };
}

export function computeBlockStatus(blockData) {
  if (!blockData || !blockData.fileName || blockData.rows.length === 0) {
    return 'FALTANTE';
  }
  const hasBlockingErrors = blockData.errors.length > 0;
  const hasMissingOptionalCols = (blockData.missingOptional || []).length > 0;

  if (hasBlockingErrors || hasMissingOptionalCols) {
    return 'PARCIAL';
  }
  return 'COMPLETO';
}

export async function processCsvBatch(fileList) {
  const parsedFiles = await Promise.all(Array.from(fileList).map(parseCsvFile));

  const blocks = {};
  for (const b of KRU_BLOCKS) {
    blocks[b.id] = {
      id: b.id,
      label: b.label,
      status: 'FALTANTE',
      fileName: null,
      rows: [],
      errors: [],
      warnings: [],
      missingOptional: [],
    };
  }

  const unrecognizedFiles = [];

  for (const parsed of parsedFiles) {
    const blockId = detectBlockId(parsed.rawHeaders);

    if (!blockId) {
      unrecognizedFiles.push(parsed.fileName);
      continue;
    }

    const schema = KRU_SCHEMAS[blockId];
    const { mapping, compositeMapping } = buildHeaderMapping(parsed.rawHeaders, schema);

    const missingOptional = schema.columns
      .filter((col) => !col.required && !mapping[col.key])
      .map((col) => col.label);

    const rows = [];
    const errors = [];
    const warnings = [];

    parsed.rawRows.forEach((rawCsvRow, idx) => {
      const rowNumber = idx + 2;
      const mappedObj = {};

      for (const col of schema.columns) {
        const csvHeader = mapping[col.key];
        mappedObj[col.key] = csvHeader ? rawCsvRow[csvHeader] : '';
      }

      if (
        blockId === 'empleados' &&
        (!mappedObj.nombre || !mappedObj.apellido) &&
        compositeMapping.nombre_completo
      ) {
        const fullVal = rawCsvRow[compositeMapping.nombre_completo];
        const split = splitFullName(fullVal);
        if (!mappedObj.nombre) mappedObj.nombre = split.nombre;
        if (!mappedObj.apellido) mappedObj.apellido = split.apellido;
      }

      const { cleanRow, rowErrors, rowWarnings } = validateAndNormalizeRow(
        blockId,
        mappedObj,
        rowNumber,
        parsed.fileName
      );

      rows.push(cleanRow);
      errors.push(...rowErrors);
      warnings.push(...rowWarnings);
    });

    blocks[blockId] = {
      id: blockId,
      label: schema.label,
      fileName: parsed.fileName,
      rows,
      errors,
      warnings,
      missingOptional,
      status: 'FALTANTE',
    };
  }

  const validEmployeeDocs = new Set(
    blocks.empleados.rows
      .map((emp) => emp.documento)
      .filter((doc) => doc && /^[VE]\d{5,10}$/.test(doc))
  );

  for (const b of KRU_BLOCKS) {
    if (b.id === 'empleados') continue;
    const blockData = blocks[b.id];
    if (blockData.rows.length === 0) continue;

    blockData.rows.forEach((row, idx) => {
      const doc = row.documento;
      if (doc && blocks.empleados.rows.length > 0 && !validEmployeeDocs.has(doc)) {
        blockData.warnings.push({
          file: blockData.fileName,
          block: blockData.label,
          row: idx + 2,
          field: 'documento',
          value: doc,
          reason: `Registro huérfano: el documento ${doc} no existe en la maestro de Empleados`,
        });
      }
    });
  }

  let totalRows = 0;
  let errorCount = 0;
  let warningCount = 0;

  for (const b of KRU_BLOCKS) {
    blocks[b.id].status = computeBlockStatus(blocks[b.id]);
    totalRows += blocks[b.id].rows.length;
    errorCount += blocks[b.id].errors.length;
    warningCount += blocks[b.id].warnings.length;
  }

  return {
    blocks,
    unrecognizedFiles,
    summary: {
      totalFiles: parsedFiles.length,
      totalRows,
      errorCount,
      warningCount,
    },
  };
}