import { requireStaff } from "@/lib/session";
import { bullBoardApp } from "@/lib/queue/board";

/**
 * /admin/kolejki - Bull Board. Staff only (users.is_staff, read from the
 * database); everyone else gets 404, the customer's account owner too: the
 * board shows jobs of all customers, post texts included.
 */

export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  try {
    await requireStaff();
  } catch {
    return new Response("Not Found", { status: 404 });
  }
  return bullBoardApp().fetch(request);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
