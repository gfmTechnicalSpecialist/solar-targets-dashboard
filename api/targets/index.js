const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

const TABLE_NAME = 'SolarTargets';

function getTableClient() {
  const connStr = process.env.AzureWebJobsStorage;
  if (!connStr || connStr === 'UseDevelopmentStorage=true') {
    return null;
  }
  return TableClient.fromConnectionString(connStr, TABLE_NAME, {
    allowInsecureConnection: false,
  });
}

async function ensureTable(client) {
  try {
    await client.createTable();
  } catch (e) {
    // Table already exists — ignore 409
    if (e.statusCode !== 409) throw e;
  }
}

module.exports = async function (context, req) {
  const { siteId, month } = context.bindingData;

  // Validate inputs
  if (!siteId || !month || !/^\d{4}-\d{2}$/.test(month)) {
    context.res = {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid siteId or month format (expected YYYY-MM).' }),
    };
    return;
  }

  const client = getTableClient();
  if (!client) {
    context.res = {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Storage not configured.' }),
    };
    return;
  }

  await ensureTable(client);

  const partitionKey = siteId;
  const rowKey = month;

  if (req.method === 'GET') {
    try {
      const entity = await client.getEntity(partitionKey, rowKey);
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: entity.target }),
      };
    } catch (e) {
      if (e.statusCode === 404) {
        context.res = {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: null }),
        };
      } else {
        context.log.error('GET target error:', e);
        context.res = {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Failed to read target.' }),
        };
      }
    }
    return;
  }

  if (req.method === 'PUT') {
    const target = req.body?.target;
    if (target === null || target === undefined) {
      // Delete the target
      try {
        await client.deleteEntity(partitionKey, rowKey);
      } catch (e) {
        if (e.statusCode !== 404) throw e;
      }
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: null }),
      };
      return;
    }

    const val = Number(target);
    if (isNaN(val) || val < 0) {
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Target must be a non-negative number.' }),
      };
      return;
    }

    await client.upsertEntity({
      partitionKey,
      rowKey,
      target: val,
    });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: val }),
    };
    return;
  }
};
