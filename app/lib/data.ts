import postgres from 'postgres';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';

import { formatCurrency } from './utils';

const sql = postgres(process.env.POSTGRES_URL!, {
  ssl: 'require',
  connect_timeout: 60,
});

export async function fetchRevenue() {
  try {
    console.log('Fetching revenue data...');

    // loading demo
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await sql<Revenue[]>`
      SELECT
        month,
        revenue
      FROM revenue
      ORDER BY month ASC
    `;

    return data;
  } catch (error) {
    console.error('Database Error:', error);

    // fallback data supaya chart tetap tampil
    return [
      { month: 'Jan', revenue: 2000 },
      { month: 'Feb', revenue: 1800 },
      { month: 'Mar', revenue: 2200 },
      { month: 'Apr', revenue: 2500 },
      { month: 'May', revenue: 2300 },
      { month: 'Jun', revenue: 3200 },
      { month: 'Jul', revenue: 3500 },
      { month: 'Aug', revenue: 3700 },
      { month: 'Sep', revenue: 2500 },
      { month: 'Oct', revenue: 2800 },
      { month: 'Nov', revenue: 3000 },
      { month: 'Dec', revenue: 4800 },
    ];
  }
}

export async function fetchLatestInvoices() {
  try {
    const data = await sql<LatestInvoiceRaw[]>`
      SELECT
        invoices.amount,
        customers.name,
        customers.image_url,
        customers.email,
        invoices.id

      FROM invoices

      JOIN customers
      ON invoices.customer_id = customers.id

      ORDER BY invoices.amount DESC
      LIMIT 10
    `;

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));

    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);

    return [
      {
        id: '1',
        name: 'Lee Robinson',
        email: 'lee@robinson.com',
        image_url: '/customers/lee-robinson.png',
        amount: '$42.46',
      },
      {
        id: '2',
        name: 'Michael Novotny',
        email: 'michael@novotny.com',
        image_url: '/customers/michael-novotny.png',
        amount: '$448.00',
      },
    ];
  }
}

export async function fetchCardData() {
  try {
    const invoiceCountPromise = sql`
      SELECT COUNT(*) FROM invoices
    `;

    const customerCountPromise = sql`
      SELECT COUNT(*) FROM customers
    `;

    const invoiceStatusPromise = sql`
      SELECT
        SUM(
          CASE
            WHEN status = 'paid'
            THEN amount
            ELSE 0
          END
        ) AS "paid",

        SUM(
          CASE
            WHEN status = 'pending'
            THEN amount
            ELSE 0
          END
        ) AS "pending"

      FROM invoices
    `;

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(
      data[0][0].count ?? '0',
    );

    const numberOfCustomers = Number(
      data[1][0].count ?? '0',
    );

    const totalPaidInvoices = formatCurrency(
      data[2][0].paid ?? '0',
    );

    const totalPendingInvoices = formatCurrency(
      data[2][0].pending ?? '0',
    );

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);

    // fallback data supaya card tetap tampil
    return {
      numberOfCustomers: 6,
      numberOfInvoices: 13,
      totalPaidInvoices: '$1,006.26',
      totalPendingInvoices: '$1,256.32',
    };
  }
}

const ITEMS_PER_PAGE = 6;

export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await sql<InvoicesTable[]>`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url

      FROM invoices

      JOIN customers
      ON invoices.customer_id = customers.id

      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}

      ORDER BY invoices.amount DESC

      LIMIT ${ITEMS_PER_PAGE}
      OFFSET ${offset}
    `;

    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    return [];
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const data = await sql`
      SELECT COUNT(*)

      FROM invoices

      JOIN customers
      ON invoices.customer_id = customers.id

      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
    `;

    const totalPages = Math.ceil(
      Number(data[0].count) / ITEMS_PER_PAGE,
    );

    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    return 0;
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = await sql<InvoiceForm[]>`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status

      FROM invoices

      WHERE invoices.id = ${id}
    `;

    const invoice = data.map((invoice) => ({
      ...invoice,
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    return null;
  }
}

export async function fetchCustomers() {
  try {
    const customers = await sql<CustomerField[]>`
      SELECT
        id,
        name

      FROM customers

      ORDER BY name ASC
    `;

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    return [];
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType[]>`
      SELECT
        customers.id,
        customers.name,
        customers.email,
        customers.image_url,

        COUNT(invoices.id) AS total_invoices,

        SUM(
          CASE
            WHEN invoices.status = 'pending'
            THEN invoices.amount
            ELSE 0
          END
        ) AS total_pending,

        SUM(
          CASE
            WHEN invoices.status = 'paid'
            THEN invoices.amount
            ELSE 0
          END
        ) AS total_paid

      FROM customers

      LEFT JOIN invoices
      ON customers.id = invoices.customer_id

      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}

      GROUP BY
        customers.id,
        customers.name,
        customers.email,
        customers.image_url

      ORDER BY customers.name ASC
    `;

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    return [];
  }
}