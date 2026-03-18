import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

/**
 * Formats a phone number to XXX-XXX-XXXX format
 * @param {string} phone - Phone number (can include p:+1, spaces, etc.)
 * @returns {string} - Formatted phone number
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Take last 10 digits (in case there's a country code)
  const last10 = digits.slice(-10);
  
  // Format as XXX-XXX-XXXX
  if (last10.length === 10) {
    return `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6)}`;
  }
  
  // Return original if we can't format it
  return phone;
}

/**
 * Formats a date string without timezone conversion issues
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} - Formatted date string
 */
function formatDate(dateString) {
  if (!dateString) return '';
  // Parse YYYY-MM-DD format directly without timezone conversion
  const [year, month, day] = dateString.split('T')[0].split('-');
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

/**
 * Cleans a name by removing credentials and extra punctuation
 * @param {string} name - Name string that may contain credentials
 * @returns {string} - Cleaned name without credentials
 */
function cleanName(name) {
  if (!name) return '';
  
  // List of common medical credentials to remove
  const credentials = ['MD', 'DO', 'NP', 'PA', 'FNP', 'RN', 'APRN', 'DNP', 'PHD', 'DPM', 'DDS', 'DMD', 'PHARMD'];
  
  // Split by comma to remove credentials that appear after commas
  let cleanedName = name.split(',')[0].trim();
  
  // Remove any credentials that appear as separate words
  const words = cleanedName.split(/\s+/);
  const filteredWords = words.filter(word => 
    !credentials.includes(word.toUpperCase().replace(/[.,]/g, ''))
  );
  
  return filteredWords.join(' ').trim();
}

/**
 * Generates a physician order document by filling in the Word template
 * @param {Object} patient - Patient information
 * @param {Object} doctor - Doctor information
 * @returns {Promise<Blob>} - The filled document as a Word Blob
 */
export async function generatePhysicianOrder(patient, doctor) {
  try {
    // Fetch the Word template
    const templateUrl = '/assets/Physician-order-template.docx.docx';
    const response = await fetch(templateUrl);
    const arrayBuffer = await response.arrayBuffer();
    
    // Load the template
    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: '«',
        end: '»'
      }
    });
    
    // Parse patient name into first and last
    const patientNameParts = (patient.name || '').trim().split(/\s+/);
    const patientFirst = patientNameParts[0] || '';
    const patientLast = patientNameParts.slice(1).join(' ') || '';
    
    // Use structured first and last name from NPPES data
    // Falls back to parsing full_name if first/last not available (for legacy data)
    let doctorFirst = cleanName(doctor.first_name || '');
    let doctorLast = cleanName(doctor.last_name || '');
    
    // Fallback for legacy records without first_name/last_name
    if (!doctorFirst && !doctorLast && doctor.full_name) {
      const doctorNameParts = doctor.full_name.trim().split(/\s+/);
      const credentials = ['MD', 'DO', 'NP', 'PA', 'FNP', 'RN', 'APRN', 'DNP', 'PHD', 'DPM', 'DDS', 'DMD'];
      const filteredParts = doctorNameParts.filter(part => 
        !credentials.includes(part.toUpperCase().replace(/[.,]/g, ''))
      );
      doctorFirst = filteredParts[0] || '';
      doctorLast = filteredParts[filteredParts.length - 1] || '';
    }
    
    // Format birthday
    let birthday = '';
    if (patient.birthday) {
      birthday = formatDate(patient.birthday);
    }
    
    // Format city/state/zip for patient and doctor
    const patCityStateZip = `${patient.city || ''}, ${patient.state || ''} ${patient.zip_code || ''}`;
    const phyCityStateZip = `${doctor.city || ''}, ${doctor.state || ''} ${doctor.zip_code || ''}`;
    
    // Prepare the data for template replacement (all uppercase)
    const templateData = {
      Phy_First: doctorFirst.toUpperCase(),
      Phy_Last: doctorLast.toUpperCase(),
      Phy_Phone1: formatPhoneNumber(doctor.phone || ''),
      Phy_Phone2: formatPhoneNumber(doctor.fax || ''),
      Phy_Address1: (doctor.address_line1 || '').toUpperCase(),
      Phy_City: (doctor.city || '').toUpperCase(),
      Phy_State: (doctor.state || '').toUpperCase(),
      Phy_ZipCode: doctor.zip_code || '',
      Phy_CityStateZip: phyCityStateZip.toUpperCase(),
      Phy_NPI: doctor.npi_number || '',
      Pat_First: patientFirst.toUpperCase(),
      Pat_Last: patientLast.toUpperCase(),
      Pat_Birthday: birthday,
      Pat_Address1: (patient.address_line1 || '').toUpperCase(),
      Pat_City: (patient.city || '').toUpperCase(),
      Pat_State: (patient.state || '').toUpperCase(),
      Pat_ZipCode: patient.zip_code || '',
      Pat_CityStateZip: patCityStateZip.toUpperCase(),
      Pat_Phone1: formatPhoneNumber(patient.phone || '')
    };
    
    // Debug logging
    console.log('Patient data:', patient);
    console.log('Doctor data:', doctor);
    console.log('Template data being used:', templateData);
    
    // Fill in the template
    doc.render(templateData);
    
    // Generate the filled Word document
    const docBlob = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    
    return docBlob;
  } catch (error) {
    console.error('Error generating physician order:', error);
    if (error.properties && error.properties.errors) {
      console.error('Template errors:', error.properties.errors);
    }
    throw new Error('Failed to generate physician order: ' + error.message);
  }
}

/**
 * Downloads the physician order document
 * @param {Blob} docBlob - The document blob to download
 * @param {string} fileName - The name for the downloaded file
 */
export function downloadPDF(docBlob, fileName = 'physician-order.docx') {
  const url = URL.createObjectURL(docBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
