/**
 * POST /api/submit-loi
 *
 * Receives a buyer's offer-form submission from the off-market detail
 * page and forwards it to dealngn.com which:
 *   - Generates a populated STAX-letterhead LOI PDF (3% commission baked in)
 *   - Saves it to the deal's Drive folder
 *   - Emails Michael with a review link
 *   - Sends the buyer a confirmation
 *
 * This Cloudflare Pages function exists mainly to set CORS + light input
 * sanitation; the heavy lifting is on the dealngn side.
 */

interface Env {
  // Reserved for future use (rate-limit KV, secrets, etc.)
}

interface SubmitLOIPayload {
  slug: string;
  buyer_name: string;
  buyer_email: string;
  buyer_entity?: string;
  buyer_title?: string;
  buyer_phone?: string;
  purchase_price: number;
  earnest_money: number;
  earnest_money_days?: number;
  inspection_days?: number;
  closing_days?: number;
  financing_contingency?: boolean;
  financing_days?: number;
  is_1031_exchange?: boolean;
  additional_terms?: string;
}

const DEALNGN_BASE = "https://dealngn.com";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "https://staxre.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body: SubmitLOIPayload = await context.request.json();

    // Required fields
    const required: (keyof SubmitLOIPayload)[] = [
      "slug",
      "buyer_name",
      "buyer_email",
      "purchase_price",
      "earnest_money",
    ];
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || body[f] === "") {
        return new Response(
          JSON.stringify({ error: `missing required field: ${f}` }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // Sanity bounds — guards against typos / spam
    if (body.purchase_price < 50_000 || body.purchase_price > 500_000_000) {
      return new Response(
        JSON.stringify({ error: "purchase_price out of expected range" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    if (body.earnest_money < 0 || body.earnest_money > body.purchase_price) {
      return new Response(
        JSON.stringify({ error: "earnest_money out of range" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { slug, ...payload } = body;
    const dgnRes = await fetch(`${DEALNGN_BASE}/api/opportunity/${slug}/submit-loi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await dgnRes.json().catch(() => ({}));
    if (!dgnRes.ok) {
      console.error("dealngn submit-loi error:", dgnRes.status, result);
      return new Response(
        JSON.stringify({ error: "Server error processing LOI", detail: result }),
        {
          status: dgnRes.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("submit-loi error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "https://staxre.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
