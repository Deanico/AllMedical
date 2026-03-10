// Azure Function to proxy NPPES API requests (avoids CORS issues)
const https = require('https');

module.exports = async function (context, req) {
  context.log('NPPES search request received');

  // Get search parameters from query string
  const searchQuery = req.query.q;
  const searchType = req.query.type || 'name'; // 'name' or 'npi'

  if (!searchQuery) {
    context.res = {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Search query is required' })
    };
    return;
  }

  try {
    // Determine search parameter based on type
    const isNPI = /^\d+$/.test(searchQuery.trim());
    
    let searchParam;
    if (isNPI) {
      searchParam = `number=${encodeURIComponent(searchQuery)}`;
    } else {
      // Try to split name into first and last
      const nameParts = searchQuery.trim().split(/\s+/);
      if (nameParts.length === 1) {
        // Single word - search by first name only
        searchParam = `first_name=${encodeURIComponent(nameParts[0])}`;
      } else {
        // Multiple words - use first word as first name, rest as last name
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        searchParam = `first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}`;
      }
    }
    
    // Build NPPES API URL
    const nppesUrl = `https://npiregistry.cms.hhs.gov/api/?version=2.1&${searchParam}&limit=10`;

    context.log('Fetching from NPPES:', nppesUrl);

    // Make request to NPPES API
    const data = await new Promise((resolve, reject) => {
      https.get(nppesUrl, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error('Failed to parse NPPES response'));
            }
          } else {
            reject(new Error(`NPPES API returned status ${response.statusCode}`));
          }
        });
      }).on('error', (err) => {
        reject(err);
      });
    });

    context.res = {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    };

  } catch (error) {
    context.log('Error fetching from NPPES:', error);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Failed to search NPPES',
        message: error.message 
      })
    };
  }
};
