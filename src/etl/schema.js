/**
 * Modelo de Datos y diccionario de sinónimos para mapeo de cliente.
 */

export const KRU_BLOCKS = [
  { id: 'empleados', label: 'Empleados' },
  { id: 'bonos', label: 'Bonos' },
  { id: 'historico_nomina', label: 'Histórico de Nómina' },
  { id: 'historico_vacaciones', label: 'Histórico de Vacaciones' },
  { id: 'historico_utilidades', label: 'Histórico de Utilidades' },
];

export const KRU_SCHEMAS = {
  empleados: {
    id: 'empleados',
    label: 'Empleados',
    outputFileName: 'empleados_limpio.csv',
    signatureFields: ['salario_base', 'fecha_ingreso', 'cargo', 'frecuencia_pago'],
    columns: [
      {
        key: 'documento',
        label: 'Documento',
        type: 'documento',
        required: true,
        synonyms: ['documento', 'cedula', 'ci', 'documento_identidad', 'dni', 'identificacion', 'id'],
      },
      {
        key: 'nombre',
        label: 'Nombre',
        type: 'string',
        required: true,
        synonyms: ['nombre', 'nombres', 'primer_nombre'],
      },
      {
        key: 'apellido',
        label: 'Apellido',
        type: 'string',
        required: true,
        synonyms: ['apellido', 'apellidos', 'primer_apellido'],
      },
      {
        key: 'email',
        label: 'Email',
        type: 'email',
        required: false,
        synonyms: ['email', 'correo', 'correo_electronico', 'mail', 'e_mail'],
      },
      {
        key: 'cargo',
        label: 'Cargo',
        type: 'string',
        required: true,
        synonyms: ['cargo', 'puesto', 'rol', 'posicion', 'ocupacion'],
      },
      {
        key: 'departamento',
        label: 'Departamento',
        type: 'string',
        required: false,
        synonyms: ['departamento', 'area', 'gerencia', 'unidad', 'depto'],
      },
      {
        key: 'fecha_ingreso',
        label: 'Fecha de Ingreso',
        type: 'date',
        required: true,
        synonyms: ['fecha_ingreso', 'ingreso', 'fecha_alta', 'fecha_inicio', 'f_ingreso'],
      },
      {
        key: 'salario_base',
        label: 'Salario Base',
        type: 'amount',
        required: true,
        synonyms: ['salario_base', 'salario', 'sueldo', 'sueldo_mensual', 'sueldo_base', 'remuneracion'],
      },
      {
        key: 'moneda',
        label: 'Moneda',
        type: 'currency',
        required: true,
        options: ['USD', 'VES'],
        synonyms: ['moneda', 'divisa', 'currency', 'tipo_moneda'],
      },
      {
        key: 'frecuencia_pago',
        label: 'Frecuencia de Pago',
        type: 'pay_frequency',
        required: true,
        options: ['semanal', 'quincenal', 'mensual'],
        synonyms: ['frecuencia_pago', 'frecuencia', 'forma_pago', 'periodo_pago', 'periodicidad'],
      },
    ],
    compositeSynonyms: {
      nombre_completo: ['nombre_completo', 'trabajador', 'empleado', 'nombres_apellidos'],
    },
  },

  bonos: {
    id: 'bonos',
    label: 'Bonos',
    outputFileName: 'bonos_limpio.csv',
    signatureFields: ['tipo', 'monto', 'frecuencia'],
    columns: [
      {
        key: 'documento',
        label: 'Documento',
        type: 'documento',
        required: true,
        synonyms: ['documento', 'cedula', 'ci', 'documento_identidad', 'id'],
      },
      {
        key: 'tipo',
        label: 'Tipo',
        type: 'string',
        required: true,
        synonyms: ['tipo', 'tipo_bono', 'categoria', 'bono'],
      },
      {
        key: 'monto',
        label: 'Monto',
        type: 'amount',
        required: true,
        synonyms: ['monto', 'valor', 'importe', 'cantidad', 'monto_bono'],
      },
      {
        key: 'frecuencia',
        label: 'Frecuencia',
        type: 'bonus_frequency',
        required: true,
        options: ['único', 'mensual', 'trimestral', 'anual'],
        synonyms: ['frecuencia', 'periodicidad', 'frecuencia_bono'],
      },
      {
        key: 'concepto',
        label: 'Concepto',
        type: 'string',
        required: false,
        synonyms: ['concepto', 'descripcion', 'detalle', 'motivo', 'observacion'],
      },
    ],
  },

  historico_nomina: {
    id: 'historico_nomina',
    label: 'Histórico de Nómina',
    outputFileName: 'historico_nomina_limpio.csv',
    signatureFields: ['bruto', 'neto', 'periodo'],
    columns: [
      {
        key: 'documento',
        label: 'Documento',
        type: 'documento',
        required: true,
        synonyms: ['documento', 'cedula', 'ci', 'documento_identidad', 'id'],
      },
      {
        key: 'periodo',
        label: 'Período (YYYY-MM)',
        type: 'period',
        required: true,
        synonyms: ['periodo', 'mes', 'mes_nomina', 'fecha_nomina', 'ciclo'],
      },
      {
        key: 'bruto',
        label: 'Bruto',
        type: 'amount',
        required: true,
        synonyms: ['bruto', 'monto_bruto', 'salario_bruto', 'total_asignaciones', 'devengado'],
      },
      {
        key: 'neto',
        label: 'Neto',
        type: 'amount',
        required: true,
        synonyms: ['neto', 'monto_neto', 'salario_neto', 'neto_pagar', 'a_pagar'],
      },
    ],
  },

  historico_vacaciones: {
    id: 'historico_vacaciones',
    label: 'Histórico de Vacaciones',
    outputFileName: 'historico_vacaciones_limpio.csv',
    signatureFields: ['dias_correspondientes', 'dias_tomados'],
    columns: [
      {
        key: 'documento',
        label: 'Documento',
        type: 'documento',
        required: true,
        synonyms: ['documento', 'cedula', 'ci', 'documento_identidad', 'id'],
      },
      {
        key: 'anio',
        label: 'Año',
        type: 'year',
        required: true,
        synonyms: ['anio', 'ano', 'periodo', 'ejercicio', 'year'],
      },
      {
        key: 'dias_correspondientes',
        label: 'Días Correspondientes',
        type: 'integer',
        required: true,
        synonyms: ['dias_correspondientes', 'dias_ley', 'correspondientes', 'dias_asignados'],
      },
      {
        key: 'dias_tomados',
        label: 'Días Tomados',
        type: 'integer',
        required: true,
        synonyms: ['dias_tomados', 'dias_disfrutados', 'tomados', 'dias_usados'],
      },
    ],
  },

  historico_utilidades: {
    id: 'historico_utilidades',
    label: 'Histórico de Utilidades',
    outputFileName: 'historico_utilidades_limpio.csv',
    signatureFields: ['anio', 'monto'],
    columns: [
      {
        key: 'documento',
        label: 'Documento',
        type: 'documento',
        required: true,
        synonyms: ['documento', 'cedula', 'ci', 'documento_identidad', 'id'],
      },
      {
        key: 'anio',
        label: 'Año',
        type: 'year',
        required: true,
        synonyms: ['anio', 'ano', 'periodo', 'ejercicio', 'year'],
      },
      {
        key: 'monto',
        label: 'Monto',
        type: 'amount',
        required: true,
        synonyms: ['monto', 'monto_utilidades', 'utilidades', 'valor', 'importe'],
      },
    ],
  },
};