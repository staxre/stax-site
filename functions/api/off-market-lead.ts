/**
 * POST /api/off-market-lead
 *
 * Handles NDA form submissions from the off-market page.
 * 1. Submits NDA to DealNgn API (creates nda_request, emails Michael with approve/deny)
 * 2. Sends confirmation email to buyer via Resend (NDA receipt)
 *
 * DealNgn handles: NDA tracking, approval workflow, magic-link generation, dataroom access.
 * This function handles: buyer-facing confirmation email (immediate).
 */

interface Env {
  DEALNGN_API_KEY: string;   // PAT token: dgn_...
  RESEND_API_KEY: string;
}

interface LeadPayload {
  property: string;
  propertyTitle: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  buyerType: string;
  signature: string;
  timestamp: string;
}

const DEALNGN_BASE = 'https://dealngn.com';

const BUYER_TYPE_LABELS: Record<string, string> = {
  principal: 'Principal Buyer',
  broker: 'Broker / Agent',
  operator: 'Operator',
  investor: 'Passive Investor / 1031',
  fund: 'Fund / Institutional',
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://staxre.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body: LeadPayload = await context.request.json();

    // Validate required fields
    if (!body.name || !body.email || !body.phone || !body.buyerType || !body.signature) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const buyerLabel = BUYER_TYPE_LABELS[body.buyerType] || body.buyerType;
    const signedDate = new Date(body.timestamp).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    // --- 1. Submit NDA to DealNgn ---
    let dealNgnOk = false;
    try {
      const dgnRes = await fetch(`${DEALNGN_BASE}/api/nda/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      dealNgnOk = dgnRes.ok;
      if (!dealNgnOk) {
        console.error('DealNgn NDA submit error:', dgnRes.status, await dgnRes.text());
      }
    } catch (err) {
      console.error('DealNgn NDA submit failed:', err);
    }

    // --- 2. Confirmation email to buyer ---
    const confirmHtml = `
      <div style="font-family: Inter, sans-serif; max-width: 560px;">
        <img src="https://staxre.com/images/stax-logo-black.svg" alt="STAX Real Estate" style="height: 28px; margin-bottom: 24px;" />
        <h2 style="color: #0a0a0a; font-size: 22px; margin-bottom: 8px;">Confidentiality Agreement Received</h2>
        <p style="color: #555; line-height: 1.6;">Hi ${body.name.split(' ')[0]},</p>
        <p style="color: #555; line-height: 1.6;">Thank you for signing our confidentiality agreement for <strong>${body.propertyTitle}</strong>. Your signed NDA is on file.</p>
        <p style="color: #555; line-height: 1.6;">Your request is being reviewed. Once approved, you'll receive a secure link to access the confidential property data including financials, site details, and supporting documents.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #888; font-size: 12px; line-height: 1.6;">
          <strong>Your Agreement Summary</strong><br/>
          Property: ${body.propertyTitle}<br/>
          Electronic Signature: ${body.signature}<br/>
          Date: ${signedDate}<br/>
          Terms: Non-Disclosure, Non-Circumvention (24 months), 2% Buyer Representative Commission
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #555; line-height: 1.6;">
          <strong>Michael Salafia</strong><br/>
          Founder &amp; Principal Broker<br/>
          STAX Real Estate<br/>
          <a href="tel:+13052010125" style="color: #DA291C;">(305) 201-0125</a> &middot;
          <a href="mailto:michael@staxre.com" style="color: #DA291C;">michael@staxre.com</a>
        </p>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Michael Salafia — STAX Real Estate <michael@staxre.com>',
        to: [body.email],
        subject: `Your Confidentiality Agreement — ${body.propertyTitle} | STAX Real Estate`,
        html: confirmHtml,
        reply_to: 'michael@staxre.com',
      }),
    });

    return new Response(JSON.stringify({ success: true, dealngn: dealNgnOk }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('off-market-lead error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': 'https://staxre.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
