const HIGECO_EQUIPMENT = 'https://southafrica.higeco.com/GWC_V200/phpScript/deviceServerCgi.php';

module.exports = async function (context, req) {
  try {
    const token = req.headers['x-higeco-token'];

    const headers = {
      'Content-Type': req.headers['content-type'] || 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    };

    if (token) {
      headers['Cookie'] = `com.higeco.sid=${token}; ids=${token}`;
    }

    const upstream = await fetch(HIGECO_EQUIPMENT, {
      method: 'POST',
      headers,
      body: req.rawBody,
    });

    const body = await upstream.text();

    context.res = {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
      },
      body,
    };
  } catch (err) {
    context.log.error('Equipment proxy error:', err);
    context.res = {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to reach upstream equipment API.' }),
    };
  }
};
