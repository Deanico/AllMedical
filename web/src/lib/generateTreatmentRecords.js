import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'

const SUPPLIER_CONFIG = {
  all_medical: {
    label: 'All Medical',
    templateUrl: '/assets/All_Medical_TreatmentVerif.docx',
    companyName: 'All Medical, LLC',
    companyAddress: '1516 Distant Oaks Dr, Wesley Chapel, FL 33543',
    companyPhone: '561-707-0965',
    companyFax: '813-513-9479',
    companyNpi: '1407256191'
  },
  solution8: {
    label: 'Solution8',
    templateUrl: '/assets/Solution8_Treatmentverif.docx',
    companyName: 'Solution8 Marketing Group, LLC',
    companyAddress: '1516 Distant Oaks Dr, Wesley Chapel, FL 33543',
    companyPhone: '352-328-8308',
    companyFax: '813-513-9479',
    companyNpi: '1154271823'
  }
}

function formatPhoneNumber(phone) {
  if (!phone) return ''

  const digits = String(phone).replace(/\D/g, '')
  const last10 = digits.slice(-10)

  if (last10.length === 10) {
    return `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6)}`
  }

  return String(phone)
}

function formatDate(dateString) {
  if (!dateString) return ''
  const [year, month, day] = dateString.split('T')[0].split('-')
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

function splitName(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean)
  return {
    first: parts[0] || '',
    last: parts.slice(1).join(' ') || ''
  }
}

export async function generateTreatmentRecords({ patient, doctor, supplierKey, initialServiceDate }) {
  const supplier = SUPPLIER_CONFIG[supplierKey]
  if (!supplier) {
    throw new Error('Invalid supplier selected for treatment records')
  }

  const response = await fetch(supplier.templateUrl)
  if (!response.ok) {
    throw new Error(`Could not load template: ${supplier.templateUrl}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const zip = new PizZip(arrayBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: {
      start: '{{',
      end: '}}'
    }
  })

  const patientName = splitName(patient?.name)
  const formattedDob = formatDate(patient?.birthday || '')
  const formattedServiceDate = formatDate(initialServiceDate)

  const templateData = {
    pat_first: patientName.first.toUpperCase(),
    pat_last: patientName.last.toUpperCase(),
    pat_address1: (patient?.address_line1 || '').toUpperCase(),
    pat_city: (patient?.city || '').toUpperCase(),
    pat_state: (patient?.state || '').toUpperCase(),
    pat_zipcode: patient?.zip_code || '',
    pat_phone1: formatPhoneNumber(patient?.phone || ''),
    pat_birthday: formattedDob,
    service_initial_date: formattedServiceDate,
    company_name: supplier.companyName,
    company_address: supplier.companyAddress,
    company_phone: formatPhoneNumber(supplier.companyPhone),
    company_fax: formatPhoneNumber(supplier.companyFax),
    company_npi: supplier.companyNpi,
    dr_npi: doctor?.npi_number || '',
    printed_name: doctor?.full_name || '',
    office_phone: formatPhoneNumber(doctor?.phone || ''),
    office_fax: formatPhoneNumber(doctor?.fax || '')
  }

  try {
    doc.render(templateData)
  } catch (error) {
    console.error('Error generating treatment records:', error)
    if (error.properties?.errors) {
      console.error('Template errors:', error.properties.errors)
    }
    throw new Error('Failed to generate treatment records: ' + error.message)
  }

  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })
}

export function getTreatmentRecordSupplierLabel(supplierKey) {
  return SUPPLIER_CONFIG[supplierKey]?.label || 'Supplier'
}
