// Builds the list of Google Sheet ranges to pull leads from.
// GOOGLE_SHEET_ID + GOOGLE_SHEET_RANGE          -> primary sheet; RANGE may list several tabs separated by "|"
// GOOGLE_SHEET_ID_2 + GOOGLE_SHEET_RANGE_2 ...  -> additional sheets (up to _9), same format
// GOOGLE_SHEET_HANDLING[_n] = "ai" or "call" (default) for the whole spreadsheet
// GOOGLE_SHEET_AI_TABS = comma-separated tab names that are always "ai", e.g. "Sheet2"
const getLeadSheetSources = (env = process.env) => {
  const sources = []
  const aiTabs = String(env.GOOGLE_SHEET_AI_TABS || '')
    .split(',')
    .map((tab) => tab.trim().toLowerCase())
    .filter(Boolean)

  const add = (sheetId, rangeValue, handlingValue) => {
    if (!sheetId) return
    const sheetHandling = String(handlingValue || '').trim().toLowerCase() === 'ai' ? 'ai' : 'call'
    String(rangeValue || 'Sheet1!A2:R')
      .split('|')
      .map((range) => range.trim())
      .filter(Boolean)
      .forEach((range) => {
        const tab = range.split('!')[0].replace(/^'|'$/g, '')
        const handling = aiTabs.includes(tab.toLowerCase()) ? 'ai' : sheetHandling
        sources.push({ sheetId: sheetId.trim(), range, label: tab, handling })
      })
  }

  add(env.GOOGLE_SHEET_ID, env.GOOGLE_SHEET_RANGE, env.GOOGLE_SHEET_HANDLING)
  for (let i = 2; i <= 9; i++) {
    add(env[`GOOGLE_SHEET_ID_${i}`], env[`GOOGLE_SHEET_RANGE_${i}`], env[`GOOGLE_SHEET_HANDLING_${i}`])
  }

  return sources
}

const getLeadHandling = (row, handling, adNameColumn = 3) => {
  const adName = String(row[adNameColumn] ?? '').trim()
  return handling === 'ai' || /^AI Agent\b/i.test(adName) ? 'ai' : handling
}

module.exports = { getLeadHandling, getLeadSheetSources }
