import { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  Search,
  Play,
  FileWarning,
  Layers,
  ArrowUpRight,
  CopyCheck,
} from 'lucide-react';
import { KRU_BLOCKS, KRU_SCHEMAS } from './etl/schema';
import {
  processCsvBatch,
  validateAndNormalizeRow,
  applyCrossRowValidations,
  areEmployeeRowsExactMatch,
  computeBlockStatus,
} from './etl/processor';
import { exportCleanedBatchZip } from './etl/exporter';

const SELECT_TYPES = new Set(['currency', 'pay_frequency', 'bonus_frequency']);

export default function App() {
  const [stagedFiles, setStagedFiles] = useState([]);
  const [batchData, setBatchData] = useState(null);
  const [activeBlockId, setActiveBlockId] = useState('empleados');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedCell, setHighlightedCell] = useState(null);

  const [customOptions, setCustomOptions] = useState({});
  const [bulkPanel, setBulkPanel] = useState(null);

  const fileInputRef = useRef(null);
  const cellRefs = useRef({});

  const handleFilesSelected = (fileList) => {
    const csvFiles = Array.from(fileList).filter((file) =>
      file.name.toLowerCase().endsWith('.csv')
    );

    if (csvFiles.length === 0) return;

    setStagedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const uniqueNew = csvFiles.filter((f) => !existingNames.has(f.name));
      return [...prev, ...uniqueNew];
    });
  };

  const removeStagedFile = (fileName) => {
    setStagedFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const handleRunEtl = async () => {
    if (stagedFiles.length === 0) return;
    setIsProcessing(true);

    try {
      const result = await processCsvBatch(stagedFiles);
      setBatchData(result);
      setBulkPanel(null);

      const firstLoaded = KRU_BLOCKS.find(
        (b) => result.blocks[b.id]?.rows?.length > 0
      );
      if (firstLoaded) {
        setActiveBlockId(firstLoaded.id);
      }
    } catch (error) {
      console.error('Error procesando lote CSV:', error);
      alert('Ocurrió un error al leer los archivos CSV.');
    } finally {
      setIsProcessing(false);
    }
  };

  const jumpToCell = (rowIndex, fieldKey) => {
    if (rowIndex === undefined || rowIndex === null || !fieldKey) return;

    if (searchTerm.trim() !== '') {
      setSearchTerm('');
    }

    const cellKey = `${activeBlockId}-${rowIndex}-${fieldKey}`;
    setHighlightedCell(cellKey);

    setTimeout(() => {
      const el = cellRefs.current[cellKey];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        el.focus();
        if (typeof el.select === 'function') el.select();
      }
    }, 50);

    setTimeout(() => {
      setHighlightedCell((prev) => (prev === cellKey ? null : prev));
    }, 2200);
  };

  const revalidateBlockState = (prevBatch, blockId, overrideRows = null) => {
    const updatedBlocks = { ...prevBatch.blocks };
    const targetBlock = updatedBlocks[blockId];
    const rowsToValidate = overrideRows || targetBlock.rows;

    const newRows = [];
    const newErrors = [];
    const newWarnings = [];

    rowsToValidate.forEach((rowObj, idx) => {
      const sourceFile = rowObj._sourceFile || targetBlock.fileName;
      const sourceRow = rowObj._sourceRow || idx + 2;

      const { cleanRow, rowErrors, rowWarnings } = validateAndNormalizeRow(
        blockId,
        rowObj,
        idx,
        sourceRow,
        sourceFile
      );
      newRows.push(cleanRow);
      newErrors.push(...rowErrors);
      newWarnings.push(...rowWarnings);
    });

    updatedBlocks[blockId] = {
      ...targetBlock,
      rows: newRows,
      errors: newErrors,
      warnings: newWarnings,
    };

    applyCrossRowValidations(updatedBlocks);

    let totalRows = 0;
    let errorCount = 0;
    let warningCount = 0;

    for (const b of KRU_BLOCKS) {
      updatedBlocks[b.id].status = computeBlockStatus(updatedBlocks[b.id]);
      totalRows += updatedBlocks[b.id].rows.length;
      errorCount += updatedBlocks[b.id].errors.length;
      warningCount += updatedBlocks[b.id].warnings.length;
    }

    return {
      ...prevBatch,
      blocks: updatedBlocks,
      summary: {
        ...prevBatch.summary,
        totalRows,
        errorCount,
        warningCount,
      },
    };
  };

  const handleMergeDuplicateEmployees = (duplicateDoc) => {
    setBatchData((prev) => {
      if (!prev) return prev;
      const empRows = prev.blocks.empleados.rows;
      let firstMatchedRow = null;

      const deduplicatedRows = empRows.filter((row) => {
        if (row.documento !== duplicateDoc) return true;
        if (!firstMatchedRow) {
          firstMatchedRow = row;
          return true;
        }
        return !areEmployeeRowsExactMatch(firstMatchedRow, row);
      });

      return revalidateBlockState(prev, 'empleados', deduplicatedRows);
    });
  };

  const handleCellChange = (blockId, rowIndex, fieldKey, newValue, immediateValidate = false) => {
    setBatchData((prev) => {
      if (!prev) return prev;
      const block = prev.blocks[blockId];
      const updatedRows = [...block.rows];
      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        [fieldKey]: newValue,
      };

      if (immediateValidate) {
        return revalidateBlockState(prev, blockId, updatedRows);
      }

      return {
        ...prev,
        blocks: {
          ...prev.blocks,
          [blockId]: {
            ...block,
            rows: updatedRows,
          },
        },
      };
    });
  };

  const handleCellBlur = (blockId) => {
    setBatchData((prev) => (prev ? revalidateBlockState(prev, blockId) : prev));
  };

  const handleExportZip = () => {
    if (!batchData) return;
    const finalizedBatch = revalidateBlockState(batchData, activeBlockId);
    setBatchData(finalizedBatch);
    exportCleanedBatchZip(finalizedBatch);
  };

  const getOptionsForColumn = (blockId, col) => {
    const key = `${blockId}-${col.key}`;
    const base = col.options || [];
    const extra = customOptions[key] || [];
    return Array.from(new Set([...base, ...extra]));
  };

  const registerCustomOption = (blockId, col, rawInput) => {
    const cleaned =
      col.type === 'currency'
        ? rawInput.trim().toUpperCase()
        : rawInput.trim().toLowerCase();
    if (!cleaned) return null;

    const key = `${blockId}-${col.key}`;
    setCustomOptions((prev) => ({
      ...prev,
      [key]: Array.from(new Set([...(prev[key] || []), cleaned])),
    }));
    return cleaned;
  };

  const handleSelectChange = (blockId, rowIndex, col, selectedValue) => {
    if (selectedValue === '__ADD_NEW__') {
      const labelPrompt =
        col.type === 'currency'
          ? 'Ingresa el código de la nueva moneda (ej. COP, MXN):'
          : 'Ingresa la nueva frecuencia:';
      const userVal = window.prompt(labelPrompt);
      if (!userVal) return;

      const added = registerCustomOption(blockId, col, userVal);
      if (added) {
        handleCellChange(blockId, rowIndex, col.key, added, true);
      }
      return;
    }

    handleCellChange(blockId, rowIndex, col.key, selectedValue, true);
  };

  const handleApplyBulk = (onlyEmpty) => {
    if (!bulkPanel || !bulkPanel.value) return;
    const { colKey, value } = bulkPanel;

    setBatchData((prev) => {
      if (!prev) return prev;
      const block = prev.blocks[activeBlockId];
      const updatedRows = block.rows.map((row) => {
        const currentVal = String(row[colKey] ?? '').trim();
        if (onlyEmpty && currentVal !== '') return row;
        return { ...row, [colKey]: value };
      });
      return revalidateBlockState(prev, activeBlockId, updatedRows);
    });

    setBulkPanel(null);
  };

  const handleReset = () => {
    setBatchData(null);
    setStagedFiles([]);
    setSearchTerm('');
    setHighlightedCell(null);
    setBulkPanel(null);
    setActiveBlockId('empleados');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETO':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completo
          </span>
        );
      case 'PARCIAL':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
            <AlertTriangle className="h-3.5 w-3.5" />
            Parcial
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20">
            <XCircle className="h-3.5 w-3.5 text-slate-400" />
            Faltante
          </span>
        );
    }
  };

  const currentBlockData = batchData?.blocks?.[activeBlockId];
  const currentSchema = KRU_SCHEMAS[activeBlockId];
  const hasMultipleSources = (currentBlockData?.sourceFiles?.length || 0) > 1;

  const errorCellKeys = new Set(
    (currentBlockData?.errors || []).map((err) => `${err.rowIndex}-${err.field}`)
  );

  const warningCellKeys = new Set(
    (currentBlockData?.warnings || []).map((warn) => `${warn.rowIndex}-${warn.field}`)
  );

  const indexedFilteredRows = (currentBlockData?.rows || [])
    .map((row, originalIdx) => ({ row, originalIdx }))
    .filter(({ row }) => {
      if (!searchTerm.trim()) return true;
      const query = searchTerm.toLowerCase();
      return Object.entries(row).some(
        ([key, val]) =>
          !key.startsWith('_') && String(val ?? '').toLowerCase().includes(query)
      );
    });

  const activeBulkCol = bulkPanel
    ? currentSchema.columns.find((c) => c.key === bulkPanel.colKey)
    : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {!batchData ? (
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-xl">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-blue-950">
                Kru Challenge
              </h1>
              <p className="text-sm text-slate-500 mt-1.5">
                Arrastra los archivos CSV del cliente para normalizar y auditar
              </p>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFilesSelected(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer bg-white shadow-sm ${
                isDragging
                  ? 'border-blue-700 bg-blue-50/60 scale-[1.01]'
                  : 'border-blue-200 hover:border-blue-600 hover:bg-blue-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
              />

              <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mb-4">
                <UploadCloud className="h-6 w-6" />
              </div>

              <p className="text-base font-medium text-slate-800">
                Arrastra tus archivos CSV aquí
              </p>
              <p className="text-xs text-slate-500 mt-1">
                o haz clic para seleccionarlos desde tu computador
              </p>
            </div>

            {stagedFiles.length > 0 && (
              <div className="mt-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Archivos listos ({stagedFiles.length})
                  </span>
                  <button
                    onClick={() => setStagedFiles([])}
                    className="text-xs text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    Limpiar todo
                  </button>
                </div>

                <ul className="divide-y divide-slate-100 mb-4">
                  {stagedFiles.map((file) => (
                    <li
                      key={file.name}
                      className="py-2.5 flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <FileSpreadsheet className="h-4 w-4 text-blue-700 shrink-0" />
                        <span className="font-medium text-slate-700 truncate">
                          {file.name}
                        </span>
                        <span className="text-xs text-slate-400">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>

                      <button
                        onClick={() => removeStagedFile(file.name)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        title="Quitar archivo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={handleRunEtl}
                  disabled={isProcessing}
                  className="w-full py-2.5 px-4 bg-blue-800 hover:bg-blue-900 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Play className="h-4 w-4" />
                  {isProcessing ? 'Normalizando datos...' : 'Procesar y normalizar lote'}
                </button>
              </div>
            )}
          </div>
        </main>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-blue-950">Kru Challenge</h1>
              <p className="text-xs text-slate-500">
                Auditoría y normalización de registros
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Nuevo cliente
              </button>
              <button
                onClick={handleExportZip}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 shadow-sm transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar ZIP
              </button>
            </div>
          </div>

          {batchData.unrecognizedFiles?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-900">
              <FileWarning className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Archivos no reconocidos por el modelo de Kru:
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  {batchData.unrecognizedFiles.join(', ')} — Verifica que contengan
                  columnas estándar (documento, monto, fecha, etc.).
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
              <p className="text-xs text-slate-500">Archivos</p>
              <p className="text-xl font-bold text-blue-950 mt-0.5">
                {batchData.summary.totalFiles - (batchData.unrecognizedFiles?.length || 0)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
              <p className="text-xs text-slate-500">Registros procesados</p>
              <p className="text-xl font-bold text-blue-950 mt-0.5">
                {batchData.summary.totalRows}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
              <p className="text-xs text-slate-500">Errores bloqueantes</p>
              <p className="text-xl font-bold text-rose-600 mt-0.5">
                {batchData.summary.errorCount}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
              <p className="text-xs text-slate-500">Alertas</p>
              <p className="text-xl font-bold text-amber-600 mt-0.5">
                {batchData.summary.warningCount}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {KRU_BLOCKS.map((block) => {
              const info = batchData.blocks[block.id];
              const isSelected = activeBlockId === block.id;
              return (
                <button
                  key={block.id}
                  onClick={() => {
                    setActiveBlockId(block.id);
                    setBulkPanel(null);
                  }}
                  className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-blue-700 ring-2 ring-blue-700/15 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {block.label}
                    </span>
                  </div>
                  <div className="mb-2">{renderStatusBadge(info?.status)}</div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {info?.sourceFiles?.length > 0
                      ? `${info.sourceFiles.length > 1 ? `${info.sourceFiles.length} archivos` : info.fileName} (${info.rows.length} filas)`
                      : 'Sin archivo asociado'}
                  </p>
                </button>
              );
            })}
          </div>

          {hasMultipleSources && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-blue-950">
              <Layers className="h-4 w-4 text-blue-700 shrink-0" />
              <span>
                <strong>Múltiples fuentes combinadas en este bloque:</strong> se
                fusionaron los registros de{' '}
                <span className="font-medium">
                  {currentBlockData.sourceFiles.join(' y ')}
                </span>
                . Cada fila conserva su archivo de origen para el reporte de errores.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-blue-950">
                    {currentSchema.label}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Haz clic en cualquier celda para editar, o asigna valores en lote desde los encabezados
                  </p>
                </div>

                <div className="relative">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar registros..."
                    className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {bulkPanel && activeBulkCol && (
                <div className="px-4 py-3 bg-blue-50/80 border-b border-blue-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-blue-950">
                      Asignar {activeBulkCol.label}:
                    </span>
                    <select
                      value={bulkPanel.value}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          const userVal = window.prompt(
                            `Ingresa nuevo valor para ${activeBulkCol.label}:`
                          );
                          if (!userVal) return;
                          const added = registerCustomOption(
                            activeBlockId,
                            activeBulkCol,
                            userVal
                          );
                          if (added) setBulkPanel({ ...bulkPanel, value: added });
                          return;
                        }
                        setBulkPanel({ ...bulkPanel, value: e.target.value });
                      }}
                      className="px-2.5 py-1 rounded border border-blue-300 bg-white text-slate-800 focus:outline-none focus:border-blue-600"
                    >
                      <option value="">Seleccionar...</option>
                      {getOptionsForColumn(activeBlockId, activeBulkCol).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                      <option value="__ADD_NEW__">+ Agregar nuevo...</option>
                    </select>

                    <button
                      type="button"
                      disabled={!bulkPanel.value}
                      onClick={() => handleApplyBulk(true)}
                      className="px-3 py-1 rounded bg-blue-800 hover:bg-blue-900 disabled:bg-blue-300 text-white font-medium cursor-pointer"
                    >
                      Solo a vacíos
                    </button>
                    <button
                      type="button"
                      disabled={!bulkPanel.value}
                      onClick={() => handleApplyBulk(false)}
                      className="px-3 py-1 rounded bg-white hover:bg-blue-100 disabled:opacity-50 text-blue-900 border border-blue-300 font-medium cursor-pointer"
                    >
                      A todas las filas
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setBulkPanel(null)}
                    className="text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
                    title="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {indexedFilteredRows.length > 0 ? (
                <div className="overflow-x-auto max-h-[540px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase">
                          Fila
                        </th>
                        {hasMultipleSources && (
                          <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase">
                            Origen
                          </th>
                        )}
                        {currentSchema.columns.map((col) => {
                          const isSelectCol = SELECT_TYPES.has(col.type);
                          return (
                            <th
                              key={col.key}
                              className="py-2.5 px-3 text-[11px] font-semibold text-slate-600 uppercase whitespace-nowrap"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>
                                  {col.label}
                                  {!col.required && (
                                    <span className="ml-1 text-[10px] font-normal text-slate-400">
                                      (opc)
                                    </span>
                                  )}
                                </span>
                                {isSelectCol && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setBulkPanel({
                                        colKey: col.key,
                                        value: getOptionsForColumn(activeBlockId, col)[0] || '',
                                      })
                                    }
                                    title={`Aplicar ${col.label} a múltiples filas`}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-[10px] font-medium normal-case text-blue-700 border border-blue-200 cursor-pointer"
                                  >
                                    <CopyCheck className="h-3 w-3" />
                                    Aplicar a todos
                                  </button>
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {indexedFilteredRows.map(({ row, originalIdx }) => {
                        const displayRowNumber = row._sourceRow || originalIdx + 2;
                        return (
                          <tr key={originalIdx} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 text-slate-400 font-mono">
                              {displayRowNumber}
                            </td>
                            {hasMultipleSources && (
                              <td className="py-2 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                                {row._sourceFile}
                              </td>
                            )}
                            {currentSchema.columns.map((col) => {
                              const cellKey = `${activeBlockId}-${originalIdx}-${col.key}`;
                              const hasCellError = errorCellKeys.has(
                                `${originalIdx}-${col.key}`
                              );
                              const hasCellWarning = warningCellKeys.has(
                                `${originalIdx}-${col.key}`
                              );
                              const isHighlighted = highlightedCell === cellKey;
                              const isSelectCol = SELECT_TYPES.has(col.type);
                              const currentVal = row[col.key] ?? '';

                              if (isSelectCol) {
                                const optionsList = getOptionsForColumn(activeBlockId, col);
                                const hasUnlistedValue =
                                  currentVal !== '' && !optionsList.includes(currentVal);

                                return (
                                  <td key={col.key} className="py-1.5 px-2">
                                    <select
                                      ref={(el) => {
                                        cellRefs.current[cellKey] = el;
                                      }}
                                      value={currentVal}
                                      onChange={(e) =>
                                        handleSelectChange(
                                          activeBlockId,
                                          originalIdx,
                                          col,
                                          e.target.value
                                        )
                                      }
                                      className={`w-full min-w-[125px] px-2 py-1 rounded border focus:outline-none text-slate-800 transition-all cursor-pointer ${
                                        isHighlighted
                                          ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-600'
                                          : hasCellError
                                          ? 'bg-rose-50 border-rose-400 text-rose-900 focus:border-rose-600'
                                          : hasCellWarning
                                          ? 'bg-amber-50 border-amber-400 text-amber-950 focus:border-amber-600'
                                          : 'border-transparent hover:border-slate-300 focus:border-blue-600 focus:bg-white bg-transparent'
                                      }`}
                                    >
                                      <option value="">Seleccionar...</option>
                                      {hasUnlistedValue && (
                                        <option value={currentVal}>{currentVal}</option>
                                      )}
                                      {optionsList.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                      <option value="__ADD_NEW__">+ Agregar nuevo...</option>
                                    </select>
                                  </td>
                                );
                              }

                              return (
                                <td key={col.key} className="py-1.5 px-2">
                                  <input
                                    ref={(el) => {
                                      cellRefs.current[cellKey] = el;
                                    }}
                                    type="text"
                                    value={currentVal}
                                    onChange={(e) =>
                                      handleCellChange(
                                        activeBlockId,
                                        originalIdx,
                                        col.key,
                                        e.target.value
                                      )
                                    }
                                    onBlur={() => handleCellBlur(activeBlockId)}
                                    className={`w-full min-w-[115px] px-2 py-1 rounded border focus:outline-none text-slate-800 transition-all ${
                                      isHighlighted
                                        ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-600'
                                        : hasCellError
                                        ? 'bg-rose-50 border-rose-400 text-rose-900 focus:border-rose-600'
                                        : hasCellWarning
                                        ? 'bg-amber-50 border-amber-400 text-amber-950 focus:border-amber-600'
                                        : 'border-transparent hover:border-slate-300 focus:border-blue-600 focus:bg-white bg-transparent'
                                    }`}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-sm text-slate-500">
                  {currentBlockData?.status === 'FALTANTE'
                    ? 'No se cargó ningún archivo correspondiente a este bloque.'
                    : 'No hay filas para mostrar con el filtro actual.'}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-semibold text-blue-950">
                  Auditoría de Incidencias
                </h3>
                <p className="text-xs text-slate-500">
                  Haz clic sobre una incidencia para ir directo a la celda
                </p>
              </div>

              {currentBlockData?.missingOptional?.length > 0 && (
                <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200 text-xs text-blue-950">
                  <span className="font-semibold">Columnas opcionales ausentes:</span>{' '}
                  {currentBlockData.missingOptional.join(', ')}
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold text-rose-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Errores de validación</span>
                  <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full text-[11px]">
                    {currentBlockData?.errors?.length || 0}
                  </span>
                </h4>
                {currentBlockData?.errors?.length > 0 ? (
                  <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {currentBlockData.errors.map((err, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => jumpToCell(err.rowIndex, err.field)}
                          className="w-full text-left p-2.5 rounded-lg bg-rose-50 hover:bg-rose-100/80 border border-rose-200 text-xs text-rose-900 transition-colors cursor-pointer group"
                        >
                          <div className="font-semibold flex items-center justify-between">
                            <span>
                              Fila {err.row} • Campo: {err.field}
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-rose-500 opacity-70 group-hover:opacity-100" />
                          </div>
                          {hasMultipleSources && (
                            <div className="text-[11px] text-rose-600/80 font-medium">
                              Archivo: {err.file}
                            </div>
                          )}
                          <div className="text-rose-700 mt-0.5">{err.reason}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    Sin errores de validación en este bloque.
                  </p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Alertas</span>
                  <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[11px]">
                    {currentBlockData?.warnings?.length || 0}
                  </span>
                </h4>
                {currentBlockData?.warnings?.length > 0 ? (
                  <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {currentBlockData.warnings.map((warn, i) => (
                      <li
                        key={i}
                        className="rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => jumpToCell(warn.rowIndex, warn.field)}
                          className="w-full text-left p-2.5 hover:bg-amber-100/80 transition-colors cursor-pointer group"
                        >
                          <div className="font-semibold flex items-center justify-between">
                            <span>
                              Fila {warn.row} • {warn.field}
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-amber-600 opacity-70 group-hover:opacity-100" />
                          </div>
                          {hasMultipleSources && (
                            <div className="text-[11px] text-amber-700/80 font-medium">
                              Archivo: {warn.file}
                            </div>
                          )}
                          <div className="text-amber-700 mt-0.5">{warn.reason}</div>
                        </button>

                        {warn.isExactDuplicate && (
                          <div className="px-2.5 pb-2.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleMergeDuplicateEmployees(warn.duplicateDoc)
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-medium shadow-xs transition-colors cursor-pointer"
                            >
                              Mezclar registros idénticos
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    Sin alertas pendientes.
                  </p>
                )}
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}