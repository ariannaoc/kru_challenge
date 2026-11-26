import Papa from 'papaparse';
import JSZip from 'jszip';
import { KRU_BLOCKS, KRU_SCHEMAS } from './schema';

export async function exportCleanedBatchZip(batchData, zipFileName = 'kru_migracion_limpia.zip') {
  if (!batchData || !batchData.blocks) return;

  const zip = new JSZip();
  const allIncidents = [];

  // Generar CSV formateado
  for (const block of KRU_BLOCKS) {
    const blockData = batchData.blocks[block.id];
    const schema = KRU_SCHEMAS[block.id];

    if (blockData && blockData.rows && blockData.rows.length > 0) {
      const orderedColumns = schema.columns.map((c) => c.key);

      const formattedRows = blockData.rows.map((row) => {
        const cleanObj = {};
        for (const colKey of orderedColumns) {
          cleanObj[colKey] = row[colKey] ?? '';
        }
        return cleanObj;
      });

      const csvString = Papa.unparse(formattedRows, {
        columns: orderedColumns,
        quotes: false,
      });

      zip.file(schema.outputFileName, '\uFEFF' + csvString);
    }

    // Recolectar errores y alertas para el reporte consolidado
    if (blockData?.errors) {
      blockData.errors.forEach((err) => {
        allIncidents.push({
          severidad: 'ERROR',
          archivo: err.file,
          bloque: err.block,
          fila: err.row,
          campo: err.field,
          valor_original: err.value ?? '',
          motivo: err.reason,
        });
      });
    }

    if (blockData?.warnings) {
      blockData.warnings.forEach((warn) => {
        allIncidents.push({
          severidad: 'ALERTA',
          archivo: warn.file,
          bloque: warn.block,
          fila: warn.row,
          campo: warn.field,
          valor_original: warn.value ?? '',
          motivo: warn.reason,
        });
      });
    }
  }

  // Generar reporte_errores.csv
  const reportColumns = [
    'severidad',
    'archivo',
    'bloque',
    'fila',
    'campo',
    'valor_original',
    'motivo',
  ];

  const reportRows =
    allIncidents.length > 0
      ? allIncidents
      : [
          {
            severidad: 'INFO',
            archivo: 'N/A',
            bloque: 'Todos',
            fila: '-',
            campo: '-',
            valor_original: '-',
            motivo: 'Lote procesado sin errores ni alertas de integridad.',
          },
        ];

  const reportCsv = Papa.unparse(reportRows, {
    columns: reportColumns,
  });

  zip.file('reporte_errores.csv', '\uFEFF' + reportCsv);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}