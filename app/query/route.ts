import postgres from 'postgres';

const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

const sql = postgres(connectionString!, { ssl: 'require' });

async function listInvoices() {
  const data = await sql`
    SELECT invoices.amount, customers.name
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE invoices.amount = 666;
  `;

  return data;
}

// for Agent
export async function GET() {
  try {
    return Response.json(await listInvoices());
  } catch (error) {
    console.error(error); // biar kelihatan di logs
    return Response.json({ error }, { status: 500 });
  }
}