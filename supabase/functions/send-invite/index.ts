import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ─── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Email HTML Template ──────────────────────────────────────────────────────

function buildEmailHtml(params: {
  name: string;
  role: string;
  inviteLink: string;
}): string {
  const { name, role, inviteLink } = params;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SnackBot POS - You're Invited</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:40px 48px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">SnackBot POS</h1>
              <p style="margin:6px 0 0;color:#ddd6fe;font-size:14px;">Point of Sale Management System</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 48px;">
              <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">You're invited!</h2>
              <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
                Hi <strong style="color:#374151;">${name}</strong>, you've been invited to join
                <strong style="color:#374151;">SnackBot POS</strong> as a:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#ede9fe;border:1px solid #ddd6fe;border-radius:999px;
                              padding:6px 18px;color:#6d28d9;font-size:13px;font-weight:600;">
                    ${role}
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.6;">
                Click the button below to accept your invitation and set up your password.
                This link is valid for <strong style="color:#374151;">24 hours</strong>.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background:#7c3aed;border-radius:10px;">
                    <a href="${inviteLink}"
                      style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;color:#9ca3af;font-size:13px;">Button not working? Copy this link:</p>
              <p style="margin:0;word-break:break-all;">
                <a href="${inviteLink}" style="color:#7c3aed;font-size:13px;">${inviteLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                If you didn't expect this invitation, you can safely ignore this email.<br/>
                © ${new Date().getFullYear()} SnackBot POS. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Send email via Gmail SMTP using raw TCP + TLS ────────────────────────────
// Uses std/net directly — no third party SMTP lib needed

async function sendGmailSmtp(params: {
  smtpUser: string;
  smtpPass: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const { smtpUser, smtpPass, to, subject, html } = params;

  // Encode credentials for AUTH PLAIN
  const authPlain = btoa(`\0${smtpUser}\0${smtpPass}`);

  // Build the raw email (MIME)
  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
  const date = new Date().toUTCString();

  const rawEmail = [
    `Date: ${date}`,
    `From: SnackBot POS <${smtpUser}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(html))),
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  // Connect to Gmail SMTP over TLS (port 465)
  const conn = await Deno.connectTls({
    hostname: "smtp.gmail.com",
    port: 465,
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const read = async (): Promise<string> => {
    const buf = new Uint8Array(4096);
    const n = await conn.read(buf);
    const response = decoder.decode(buf.subarray(0, n ?? 0));
    console.log("[smtp] <<", response.trim());
    return response;
  };

  const write = async (cmd: string): Promise<void> => {
    console.log("[smtp] >>", cmd.trim());
    await conn.write(encoder.encode(cmd + "\r\n"));
  };

  try {
    await read(); // 220 greeting

    await write("EHLO smtp.gmail.com");
    await read(); // 250 capabilities

    await write("AUTH PLAIN " + authPlain);
    const authResp = await read();
    if (!authResp.startsWith("235")) {
      throw new Error(`SMTP AUTH failed: ${authResp.trim()}`);
    }

    await write(`MAIL FROM:<${smtpUser}>`);
    await read(); // 250

    await write(`RCPT TO:<${to}>`);
    await read(); // 250

    await write("DATA");
    await read(); // 354

    await write(rawEmail + "\r\n.");
    const dataResp = await read(); // 250
    if (!dataResp.startsWith("250")) {
      throw new Error(`SMTP DATA failed: ${dataResp.trim()}`);
    }

    await write("QUIT");
    await read(); // 221
  } finally {
    conn.close();
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // ── CORS preflight ───────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Auth check ───────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized — missing Authorization header." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // ── 1. Parse body ──────────────────────────────────────────────────────────
    let invitationId: string | undefined;
    try {
      const body = await req.json();
      invitationId = body?.invitationId;
    } catch {
      throw new Error("Invalid JSON body.");
    }

    if (!invitationId) throw new Error("invitationId is required.");

    console.log(`[send-invite] Processing invitation: ${invitationId}`);

    // ── 2. Validate env vars ───────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const smtpUser    = Deno.env.get("SMTP_USER");
    const smtpPass    = Deno.env.get("SMTP_PASS");
    const appUrl = Deno.env.get("APP_URL") ?? "https://snackbot-cloud.vercel.app";

    const missing = (
      [
        ["SUPABASE_URL",              supabaseUrl],
        ["SUPABASE_SERVICE_ROLE_KEY", supabaseKey],
        ["SMTP_USER",                 smtpUser],
        ["SMTP_PASS",                 smtpPass],
      ] as [string, string | undefined][]
    )
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (missing.length > 0) {
      throw new Error(`Missing environment variables: ${missing.join(", ")}`);
    }

    // ── 3. Init Supabase ───────────────────────────────────────────────────────
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // ── 4. Fetch invitation ────────────────────────────────────────────────────
    const { data: invitation, error: inviteError } = await supabase
      .from("staff_invitations")
      .select("id, email, name, role, accepted_at")
      .eq("id", invitationId)
      .single();

    if (inviteError) throw new Error(`Could not fetch invitation: ${inviteError.message}`);
    if (!invitation)  throw new Error(`Invitation ${invitationId} not found.`);
    if (invitation.accepted_at) throw new Error("This invitation has already been accepted.");

    console.log(`[send-invite] Sending to: ${invitation.email} (role: ${invitation.role})`);

    // ── 5. Build invite link ───────────────────────────────────────────────────
    const inviteLink = `${appUrl}/accept-invite?token=${invitation.id}`;

    // ── 6. Send email ──────────────────────────────────────────────────────────
    await sendGmailSmtp({
      smtpUser: smtpUser!,
      smtpPass: smtpPass!,
      to:       invitation.email,
      subject:  `You've been invited to join SnackBot POS as ${invitation.role}`,
      html:     buildEmailHtml({
        name:       invitation.name ?? invitation.email,
        role:       invitation.role,
        inviteLink,
      }),
    });

    // ── 7. Mark email_sent_at ──────────────────────────────────────────────────
    await supabase
      .from("staff_invitations")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", invitationId);

    // ── 8. Return success ──────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ success: true, message: `Invitation email sent to ${invitation.email}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[send-invite] Error:", message);

    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});