const HIGECO_GRAPHQL = 'https://southafrica.higeco.com/graphql';

module.exports = async function (context, req) {
  try {
    const upstream = await fetch(HIGECO_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
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
    context.log.error('GraphQL proxy error:', err);
    context.res = {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to reach upstream GraphQL API.' }),
    };
  }
};
