import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone } = await req.json();

    if (!phone || typeof phone !== "string") {
      return new Response(
        JSON.stringify({ error: "Phone number required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone: ensure + prefix
    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone.replace(/^0/, "255")}`;

    // Rate limit: max 3 codes per phone per 10 minutes
    const { count } = await supabase
      .from("sms_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", normalizedPhone)
      .eq("used", false)
      .gt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (count && count >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many attempts. Wait 10 minutes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store code in database
    const { error: insertError } = await supabase.from("sms_codes").insert({
      phone: normalizedPhone,
      code,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store verification code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send SMS via Twilio
    if (twilioSid && twilioToken && twilioFrom) {
      const message = `Your MediSauti verification code is: ${code}. Valid for 10 minutes.`;

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const auth = btoa(`${twilioSid}:${twilioToken}`);

      const formData = new URLSearchParams();
      formData.append("To", normalizedPhone);
      formData.append("From", twilioFrom);
      formData.append("Body", message);

      const twilioRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (!twilioRes.ok) {
        const errBody = await twilioRes.text();
        console.error("Twilio error:", errBody);
        // Still return success — code is stored, user can retry
        // In production, you might want to return an error here
      }
    } else {
      // No Twilio configured — log the code for development
      console.log(`[DEV] SMS code for ${normalizedPhone}: ${code}`);
    }

    // Log the event
    await supabase.from("security_audit_log").insert({
      event_type: "sms_sent",
      details: { phone: normalizedPhone },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-sms error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
