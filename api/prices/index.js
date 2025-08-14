const fetch = require('node-fetch');

module.exports = async function (context, req) {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        };
        return;
    }

    try {
        // Build the Azure Retail Prices API URL with query parameters
        const baseUrl = 'https://prices.azure.com/api/retail/prices';
        const queryParams = new URLSearchParams();

        // Forward all query parameters from the request
        if (req.query) {
            Object.keys(req.query).forEach(key => {
                queryParams.append(key, req.query[key]);
            });
        }

        const apiUrl = queryParams.toString() ? `${baseUrl}?${queryParams}` : baseUrl;
        
        context.log(`Proxying request to: ${apiUrl}`);

        // Make the request to the Azure Retail Prices API
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Azure-Retail-Prices-Explorer/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Azure API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Return the data with CORS headers
        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: data
        };

    } catch (error) {
        context.log.error('Error proxying Azure Retail Prices API:', error);
        
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: {
                error: 'Failed to fetch data from Azure Retail Prices API',
                message: error.message
            }
        };
    }
};