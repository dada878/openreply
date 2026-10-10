import { Client } from "pg";
import { contactExportSql, type ContactQuery, type Contact } from "./query";

// Prevent spreadsheet formula evaluation, while preserving commas and quotes.
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
function contactCsv(contact: Contact) {
  return (
    [
      contact.email ?? "",
      contact.commenterName ?? "",
      contact.commenterId,
      contact.campaigns.map((campaign) => campaign.name).join("; "),
      contact.lastInteractionAt,
    ]
      .map(csvCell)
      .join(",") + "\r\n"
  );
}

// PostgreSQL holds one read-only result; application memory stays at 100 rows.
export function contactCsvStream(
  workspaceId: string,
  options: ContactQuery,
  signal: AbortSignal,
  connectionString = process.env.DATABASE_URL,
) {
  const encoder = new TextEncoder();
  let client: Client | undefined;
  let cancelled = false;
  let streamController: ReadableStreamDefaultController<Uint8Array>;
  async function close() {
    const active = client;
    client = undefined;
    await active?.end(); // Ending the connection also releases its read-only cursor.
  }
  const onAbort = () => {
    cancelled = true;
    streamController.close();
    void close().catch(() => {});
  };
  signal.addEventListener("abort", onAbort, { once: true });
  return new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      controller.enqueue(
        encoder.encode(
          "\uFEFFemail,instagram_username,instagram_id,campaigns,last_interaction_at\r\n",
        ),
      );
    },
    async pull(controller) {
      if (cancelled || signal.aborted) {
        signal.removeEventListener("abort", onAbort);
        controller.close();
        return;
      }
      try {
        if (!client) {
          client = new Client({
            connectionString,
            connectionTimeoutMillis: 10_000,
            statement_timeout: 60_000,
            idle_in_transaction_session_timeout: 30_000,
          });
          await client.connect();
          await client.query(
            "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
          );
          const sql = contactExportSql(workspaceId, options);
          await client.query(
            `DECLARE contacts_export NO SCROLL CURSOR FOR ${sql.text}`,
            sql.values,
          );
        }
        const result = await client.query<Contact>(
          "FETCH FORWARD 100 FROM contacts_export",
        );
        if (cancelled) return;
        controller.enqueue(
          encoder.encode(result.rows.map(contactCsv).join("")),
        );
        if (result.rows.length < 100) {
          signal.removeEventListener("abort", onAbort);
          await close();
          controller.close();
        }
      } catch (error) {
        signal.removeEventListener("abort", onAbort);
        await close().catch(() => {});
        if (!cancelled) controller.error(error);
      }
    },
    async cancel() {
      cancelled = true;
      signal.removeEventListener("abort", onAbort);
      await close();
    },
  });
}
