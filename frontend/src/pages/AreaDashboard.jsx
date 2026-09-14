import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAreaRoute } from '../lib/areas'

const AREA_DETAILS = {
  hardware: { label: 'Hardware', desc: 'Equipos de cómputo médico, monitores de signos vitales, servidores PACS y periféricos hospitalarios.' },
  software: { label: 'Software', desc: 'Licencias HIS (Hospital Information System), visores DICOM, software de triaje y sistemas clínicos.' },
  redes: { label: 'Redes', desc: 'Infraestructura de conectividad en UCI, quirófanos, enlaces de fibra y Wi-Fi médico.' },
  seguridad: { label: 'Seguridad', desc: 'Firewalls de red hospitalaria, control biométrico de farmacia y protección de datos de pacientes.' },
  calidad: { label: 'Calidad', desc: 'Validación de estándares ISO 13485 (Dispositivos Médicos), calibraciones y auditoría clínica.' },
  cloud: { label: 'Cloud', desc: 'Respaldo en la nube de historias clínicas, almacenamiento radiológico S3 y servidores virtuales.' },
  'big-data': { label: 'Big Data', desc: 'Plataforma de analítica epidemiológica, procesamiento de datos de urgencias y estadísticas de ocupación.' },
}

const MOCK_HOSPITAL_ASSETS = {
  hardware: [
    { codigo: 'HW-001', nombre: 'Ecógrafo Portátil Mindray M9', detalle: 'Unidad de Diagnóstico / Pabellón 3', fecha: '2024-01-15', estado: 'ACTIVO' },
    { codigo: 'HW-002', nombre: 'Monitor Signos Vitales Philips IntelliVue', detalle: 'Cama 04 - Unidad de Cuidados Intensivos', fecha: '2023-11-20', estado: 'ACTIVO' },
    { codigo: 'HW-003', nombre: 'ServidorPACS Radiología Dell R750', detalle: 'Dual Xeon 128GB RAM / Storage DICOM', fecha: '2024-02-10', estado: 'ACTIVO' },
    { codigo: 'HW-004', nombre: 'Workstation Médica HP Z2 Tower', detalle: 'Estación de Telemedicina y Lectura', fecha: '2024-03-01', estado: 'EN MANTENIMIENTO' },
  ],
  software: [
    { codigo: 'SW-001', nombre: 'Sistema HIS Hospitalario Enterprise', detalle: 'Licencia Servidor Principal e Historias Clínicas', fecha: '2024-01-05', estado: 'ACTIVO' },
    { codigo: 'SW-002', nombre: 'Visor DICOM Radiológico PACS', detalle: 'Licencia 35 Estaciones de Diagnóstico', fecha: '2023-12-01', estado: 'ACTIVO' },
    { codigo: 'SW-003', nombre: 'Software de Triaje Manchester', detalle: 'Módulo de Urgencias y Admisión', fecha: '2024-02-15', estado: 'ACTIVO' },
    { codigo: 'SW-004', nombre: 'Licencia Antivirus Endpoint Salud', detalle: 'Protección 250 Equipos Clínicos', fecha: '2024-03-10', estado: 'PENDIENTE RENOVAR' },
  ],
  redes: [
    { codigo: 'RD-001', nombre: 'Switch Cisco Catalyst Quirófanos', detalle: '48 Puertos PoE+ Alta Disponibilidad', fecha: '2023-10-12', estado: 'ACTIVO' },
    { codigo: 'RD-002', nombre: 'Router Central Enlace Telemedicina', detalle: 'Fibra Óptica Red Asistencial 10G', fecha: '2023-11-05', estado: 'ACTIVO' },
    { codigo: 'RD-003', nombre: 'Access Point Médico UniFi 6 UCI', detalle: 'Wi-Fi aislado para bombas de infusión', fecha: '2024-01-22', estado: 'ACTIVO' },
  ],
  seguridad: [
    { codigo: 'SG-001', nombre: 'Firewall Palo Alto Red Asistencial', detalle: 'Filtro de Tráfico Perimetral e Historias Clínicas', fecha: '2023-09-18', estado: 'ACTIVO' },
    { codigo: 'SG-002', nombre: 'Lector Biométrico Acceso Farmacia', detalle: 'Control de Acceso a Medicamentos Controlados', fecha: '2024-02-01', estado: 'ACTIVO' },
    { codigo: 'SG-003', nombre: 'Certificado SSL Servidores Salud', detalle: 'Encriptación de datos de pacientes (HIPAA)', fecha: '2024-01-10', estado: 'ACTIVO' },
  ],
  calidad: [
    { codigo: 'CL-001', nombre: 'Software ISO 13485 Gestión Médica', detalle: 'Módulo de Registro y Trazabilidad Dispositivos', fecha: '2023-11-30', estado: 'ACTIVO' },
    { codigo: 'CL-002', nombre: 'Equipo de Calibración Electromédica', detalle: 'Patrón de Verificación de Desfibriladores', fecha: '2024-01-18', estado: 'ACTIVO' },
  ],
  cloud: [
    { codigo: 'CD-001', nombre: 'AWS HealthLake - Respaldo Clínico', detalle: 'Almacenamiento Seguro FHIR / Multi-AZ', fecha: '2024-01-01', estado: 'ACTIVO' },
    { codigo: 'CD-002', nombre: 'Cloud Storage S3 Archivo Historias', detalle: 'Capacidad 80 TB Glacier Backup', fecha: '2023-08-14', estado: 'ACTIVO' },
  ],
  'big-data': [
    { codigo: 'BD-001', nombre: 'Cluster Analítica Epidemiológica', detalle: 'Procesamiento de Estadísticas Urgencias', fecha: '2024-02-05', estado: 'ACTIVO' },
    { codigo: 'BD-002', nombre: 'Base de Datos Snowflake UCI', detalle: 'Almacén de Datos de Ocupación y Camas', fecha: '2023-11-15', estado: 'ACTIVO' },
  ],
}

function AreaDashboard() {
  const { area } = useParams()
  const { user, logout } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')

  const currentSlug = area || 'hardware'
  const ownRoute = getAreaRoute(user?.categoria?.nombre_categoria)

  if (ownRoute !== `/dashboard/${currentSlug}`) {
    return <Navigate to={ownRoute} replace />
  }

  const currentAreaInfo = AREA_DETAILS[currentSlug] || AREA_DETAILS.hardware
  const currentAssets = MOCK_HOSPITAL_ASSETS[currentSlug] || []

  const filteredAssets = currentAssets.filter(
    (item) =>
      item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.detalle.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-700 min-h-screen">
      <header className="flex justify-between items-center px-8 py-4 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 text-left">
          <div className="w-9 h-9 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              <path d="M12 7v6" />
              <path d="M9 10h6" />
            </svg>
          </div>
          <div>
            <span className="block text-base font-extrabold text-slate-900 leading-tight">IATECH Co. Hospitalario</span>
            <span className="block text-xs text-slate-500">Control de Activos por Área</span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-rose-50 border border-rose-200 text-rose-600 font-extrabold flex items-center justify-center text-sm">
              {user?.nombre?.charAt(0) || 'U'}
            </span>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-slate-900">{user?.nombre || 'Usuario Autorizado'}</span>
              <span className="text-xs text-slate-500">Área Asignada: {currentAreaInfo.label}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all cursor-pointer"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center p-6 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 text-left">
          <div>
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-xl mb-2">
              Área Autorizada
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900">Área de {currentAreaInfo.label}</h2>
            <p className="text-xs text-slate-500 mt-1">{currentAreaInfo.desc}</p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-all cursor-pointer">
              Exportar Reporte
            </button>
            <button className="px-4 py-2.5 rounded-lg border-0 bg-gradient-to-r from-rose-600 via-rose-500 to-pink-500 text-white text-xs font-bold shadow-md hover:from-rose-700 hover:to-rose-600 transition-all cursor-pointer">
              + Registrar Nuevo Activo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col text-left">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Activos Registrados</span>
            <span className="text-3xl font-extrabold text-slate-900 my-1.5">{currentAssets.length}</span>
            <span className="text-xs font-semibold text-emerald-600">Inventario Verificado</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col text-left">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Operativos en Servicio</span>
            <span className="text-3xl font-extrabold text-slate-900 my-1.5">{currentAssets.filter(a => a.estado === 'ACTIVO').length}</span>
            <span className="text-xs font-semibold text-emerald-600">Estado Óptimo</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col text-left">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">En Mantenimiento Preventivo</span>
            <span className="text-3xl font-extrabold text-slate-900 my-1.5">{currentAssets.filter(a => a.estado !== 'ACTIVO').length}</span>
            <span className="text-xs font-semibold text-amber-600">Revisiones Programadas</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col text-left">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cumplimiento Normativo</span>
            <span className="text-3xl font-extrabold text-slate-900 my-1.5">100%</span>
            <span className="text-xs font-semibold text-rose-600">Conforme a Estándar</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
            <h3 className="text-base font-bold text-slate-900">Inventario del Área de {currentAreaInfo.label}</h3>
            <div className="w-80">
              <input
                type="text"
                placeholder="Buscar por código, activo o especificación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs outline-none focus:border-rose-600 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50">Código</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50">Activo Hospitalario</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50">Especificación Técnica / Ubicación</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50">Fecha Registro</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50">Estado</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length > 0 ? (
                  filteredAssets.map((asset) => (
                    <tr key={asset.codigo} className="hover:bg-slate-50">
                      <td className="px-4 py-3.5 text-sm text-slate-700 border-b border-slate-200">
                        <span className="font-mono text-xs px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-md font-bold">{asset.codigo}</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-bold text-slate-900 border-b border-slate-200">{asset.nombre}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 border-b border-slate-200">{asset.detalle}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-700 border-b border-slate-200">{asset.fecha}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-700 border-b border-slate-200">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${asset.estado === 'ACTIVO'
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : asset.estado === 'EN MANTENIMIENTO'
                                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                : 'bg-rose-50 text-rose-600 border border-rose-200'
                            }`}
                        >
                          {asset.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-700 border-b border-slate-200 text-right">
                        <button className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-md text-slate-700 text-xs font-semibold hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all cursor-pointer">
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center p-10 text-slate-500 text-sm">
                      No se encontraron registros que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

export default AreaDashboard
