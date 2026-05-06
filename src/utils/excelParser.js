import * as XLSX from 'xlsx';

export const parseExcelFile = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file was provided.'));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target.result;
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetNames = workbook.SheetNames || [];

        if (sheetNames.length === 0) {
          return reject(new Error('The uploaded file contains no sheets.'));
        }

        resolve({ workbook, sheetNames });
      } catch (error) {
        reject(new Error('Unable to parse the Excel file.'));
      }
    };

    reader.onerror = () => reject(new Error('File read failed.'));
    reader.readAsArrayBuffer(file);
  });
