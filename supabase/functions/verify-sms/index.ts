import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, code, new_password } = await req.json();

    if (!phone || !code || !new_password) {
      return new Response(
        JSON.stringify({ error: "Phone, code, and new_password required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone.replace(/^0/, "255")}`;

    // Find valid code
    const { data: codes, error: queryError } = await supabase
      .from("sms_codes")
      .select("*")
      .eq("phone", normalizedPhone)
      .eq("code", code)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (queryError || !codes || codes.length === 0) {
      await supabase.from("security_audit_log").insert({
        event_type: "sms_verify_failed",
        details: { phone: normalizedPhone },
      });

      return new Response(
        JSON.stringify({ error: "Invalid or expired verification code" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark code as used
    await supabase
      .from("sms_codes")
      .update({ used: true })
      .eq("id", codes[0].id);

    // Find user by phone
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the user's Supabase auth password
    // Using admin API via service role
    const updateRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userData.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
          apikey: supabaseServiceKey,
        },
        body: JSON.stringify({ password: new_password }),
      }
    );

    if (!updateRes.ok) {
      const errBody = await updateRes.text();
      console.error("Password update failed:", errBody);
      return new Response(
        JSON.stringify({ error: "Failed to update password" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the event
    await supabase.from("security_audit_log").insert({
      event_type: "pin_reset_success",
      user_id: userData.id,
      details: { phone: normalizedPhone },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Password updated", user_id: userData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-sms error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
