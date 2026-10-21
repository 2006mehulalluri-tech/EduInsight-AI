/**
 * Robust zero-dependency CSV parser and serializer.
 * Handles quotes, commas within quotes, escaped quotes, and CRLF/LF newlines.
 */

export function parseCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') return []

  const lines = []
  let currentRow = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        currentRow.push(currentField.trim())
        currentField = ''
      } else if (char === '\r') {
        // Skip CR, handle LF next
        if (nextChar === '\n') i++
        currentRow.push(currentField.trim())
        currentField = ''
        if (currentRow.some((f) => f.length > 0)) {
          lines.push(currentRow)
        }
        currentRow = []
      } else if (char === '\n') {
        currentRow.push(currentField.trim())
        currentField = ''
        if (currentRow.some((f) => f.length > 0)) {
          lines.push(currentRow)
        }
        currentRow = []
      } else {
        currentField += char
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((f) => f.length > 0)) {
      lines.push(currentRow)
    }
  }

  if (lines.length < 2) return []

  const headers = lines[0].map((h) => h.toLowerCase().replace(/[\s_-]+/g, '_'))
  const records = []

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const row = lines[rowIdx]
    const record = { _rowNumber: rowIdx + 1 }
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      record[headers[colIdx]] = row[colIdx] !== undefined ? row[colIdx] : ''
    }
    records.push(record)
  }

  return records
}
