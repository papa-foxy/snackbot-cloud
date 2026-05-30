import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const token = body?.token;
    const password = body?.password;
    if (!token || !password) {
      throw new Error("Missing token or password.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: invitation, error: inviteError } = await supabase
      .from("staff_invitations")
      .select("id, email, name, role, merchant_id, accepted_at, created_at")
      .eq("id", token)
      .single();

    if (inviteError) throw inviteError;
    if (!invitation) throw new Error("Invitation not found.");
    if (invitation.accepted_at) throw new Error("This invitation has already been accepted.");

    const createdAt = new Date(invitation.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursDiff > 24) throw new Error("This invitation has expired. Please contact your administrator for a new invitation.");

    const { data: userData, error: authError } = await supabase.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
    });

    if (authError) {
      throw new Error(authError.message || "Failed to create auth user.");
    }
    if (!userData || !userData.user) {
      throw new Error("Failed to create auth user.");
    }

    const authId = userData.user.id;

    const { error: userError } = await supabase.from("users").insert({
      auth_id:     authId,
      name:        invitation.name,
      email:       invitation.email,
      role:        invitation.role,
      merchant_id: invitation.merchant_id,
      is_active:   true,
      password:    null,
    });

    if (userError) {
      throw userError;
    }

    const { error: acceptError } = await supabase
      .from("staff_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    if (acceptError) {
      console.error("Failed to update invitation accepted_at:", acceptError);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[accept-invite] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
