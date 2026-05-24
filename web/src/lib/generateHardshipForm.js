import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'

const TEMPLATE_CONFIG = {
  label: 'Hardship Form',
  templateUrl: '/assets/all_medical_llc_hardship_form_placeholders.docx',
  companyName: 'All Medical, LLC',
  companyAddress: '1516 Distant Oaks Dr, Wesley Chapel, FL 33543',
  companyPhone: '561-707-0965',
  companyFax: '813-513-9479'
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

export async function generateHardshipForm({ patient }) {
  const response = await fetch(TEMPLATE_CONFIG.templateUrl)
  if (!response.ok) {
    throw new Error(`Could not load hardship form template: ${TEMPLATE_CONFIG.templateUrl}`)
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

  // Fill available placeholders (template will skip any not present in the document)
  const templateData = {
    patient_first_name: patientName.first,
    patient_last_name: patientName.last,
    patient_full_name: patient?.name || '',
    patient_address: (patient?.address_line1 || ''),
    patient_city: (patient?.city || ''),
    patient_state: (patient?.state || ''),
    patient_zip: patient?.zip_code || '',
    patient_phone: formatPhoneNumber(patient?.phone || ''),
    patient_email: patient?.email || '',
    patient_dob: formattedDob,
    company_name: TEMPLATE_CONFIG.companyName,
    company_address: TEMPLATE_CONFIG.companyAddress,
    company_phone: formatPhoneNumber(TEMPLATE_CONFIG.companyPhone),
    company_fax: formatPhoneNumber(TEMPLATE_CONFIG.companyFax)
  }

  doc.setData(templateData)

  try {
    doc.render()
  } catch (error) {
    throw new Error(`Error rendering hardship form template: ${error.message}`)
  }

  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })

  return blob
}

export function getHardshipFormLabel() {
  return TEMPLATE_CONFIG.label
}
