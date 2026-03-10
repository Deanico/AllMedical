import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { renderAsync } from 'docx-preview';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
 * Generates a physician order document by filling in the Word template
 * and converting it to PDF while preserving exact formatting
 * @param {Object} patient - Patient information
 * @param {Object} doctor - Doctor information
 * @returns {Promise<Blob>} - The filled document as a PDF Blob
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
    
    // Parse doctor name into first and last name (excluding credentials)
    const doctorNameParts = (doctor.full_name || '').trim().split(/\s+/);
    // Remove common medical credentials from the end
    const credentials = ['MD', 'DO', 'NP', 'PA', 'FNP', 'RN', 'APRN', 'DNP', 'PHD', 'DPM', 'DDS', 'DMD'];
    const filteredParts = doctorNameParts.filter(part => 
      !credentials.includes(part.toUpperCase().replace(/[.,]/g, ''))
    );
    const doctorFirst = filteredParts[0] || '';
    const doctorLast = filteredParts[filteredParts.length - 1] || '';
    
    // Format birthday
    let birthday = '';
    if (patient.birthday) {
      birthday = new Date(patient.birthday).toLocaleDateString('en-US');
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
    
    // Convert the filled Word document to PDF
    console.log('Converting Word document to PDF...');
    const pdfBlob = await convertDocxToPdf(docBlob);
    
    return pdfBlob;
  } catch (error) {
    console.error('Error generating physician order:', error);
    if (error.properties && error.properties.errors) {
      console.error('Template errors:', error.properties.errors);
    }
    throw new Error('Failed to generate physician order: ' + error.message);
  }
}

/**
 * Converts a Word document blob to PDF by rendering it and capturing as images
 * @param {Blob} docxBlob - The Word document blob
 * @returns {Promise<Blob>} - PDF blob
 */
async function convertDocxToPdf(docxBlob) {
  return new Promise(async (resolve, reject) => {
    try {
      // Create a hidden container for rendering
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '8.5in';
      container.style.backgroundColor = 'white';
      document.body.appendChild(container);
      
      // Convert blob to array buffer for docx-preview
      const arrayBuffer = await docxBlob.arrayBuffer();
      
      // Render the Word document to the container
      await renderAsync(arrayBuffer, container, undefined, {
        className: 'docx-preview',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        debug: false,
        experimental: false,
        trimXmlDeclaration: true,
      });
      
      // Wait a moment for rendering to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get all page sections
      const pages = container.querySelectorAll('.docx-wrapper > section');
      
      if (pages.length === 0) {
        throw new Error('No pages found in rendered document');
      }
      
      console.log(`Found ${pages.length} pages to convert to PDF`);
      
      // Create PDF - US Letter size (8.5 x 11 inches)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter'
      });
      
      // Capture each page as an image and add to PDF
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        
        // Capture the page as a canvas
        const canvas = await html2canvas(page, {
          scale: 2, // Higher quality
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
        
        // Convert canvas to image
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        // Add new page if not the first page
        if (i > 0) {
          pdf.addPage();
        }
        
        // Add image to PDF (fit to page)
        const imgWidth = 8.5;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
        
        console.log(`Added page ${i + 1} to PDF`);
      }
      
      // Clean up
      document.body.removeChild(container);
      
      // Generate PDF blob
      const pdfBlob = pdf.output('blob');
      resolve(pdfBlob);
      
    } catch (error) {
      console.error('Error converting to PDF:', error);
      // Clean up on error
      const container = document.querySelector('div[style*="-9999px"]');
      if (container) {
        document.body.removeChild(container);
      }
      reject(error);
    }
  });
}

/**
 * Downloads the physician order PDF document
 * @param {Blob} pdfBlob - The PDF blob to download
 * @param {string} fileName - The name for the downloaded file
 */
export function downloadPDF(pdfBlob, fileName = 'physician-order.pdf') {
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
