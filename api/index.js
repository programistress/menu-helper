import '@vercel/node';



export default async function handler(req, res) {
    // Allow credentials (cookies) to be sent with requests  
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    // What headers can be sent with the request
    res.setHeader('Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }


    return res.status(200).json({
        message: 'MenuHelper API',
        version: '1.0.0',
        status: 'healthy',
        endpoints: [
            {
                path: '/api/preferences',
                methods: ['GET', 'POST'],
                description: 'Get or save user food preferences'
            },
            {
                path: '/api/menu/analyze',
                methods: ['POST'],
                description: 'Upload a menu image and get dish information'
            },
            {
                path: '/api/recommendations',
                methods: ['POST'],
                description: 'Get personalized dish recommendations'
            },
            {
                path: '/api/direct/recommendations',
                methods: ['POST'],
                description: 'Get AI-powered dish recommendations with OpenAI'
            }
        ],

        timestamp: new Date().toISOString()
    });
}

