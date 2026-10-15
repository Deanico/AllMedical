// Builds the list of Google Sheet ranges to pull leads from.
// GOOGLE_SHEET_ID + GOOGLE_SHEET_RANGE          -> primary sheet; RANGE may list several tabs separated by "|"
// GOOGLE_SHEET_ID_2 + GOOGLE_SHEET_RANGE_2 ...  -> additional sheets (up to _9), same format
const getLeadSheetSources = (env = process.env) => {
  const sources = []

  const add = (sheetId, rangeValue) => {
    if (!sheetId) return
    String(rangeValue || 'Sheet1!A2:R')
      .split('|')
      .map((range) => range.trim())
      .filter(Boolean)
      .forEach((range) => {
        const tab = range.split('!')[0].replace(/^'|'$/g, '')
        sources.push({ sheetId: sheetId.trim(), range, label: tab })
      })
  }

  add(env.GOOGLE_SHEET_ID, env.GOOGLE_SHEET_RANGE)
  for (let i = 2; i <= 9; i++) {
    add(env[`GOOGLE_SHEET_ID_${i}`], env[`GOOGLE_SHEET_RANGE_${i}`])
  }

  return sources
}

module.exports = { getLeadSheetSources }
