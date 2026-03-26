/**
 * POST /api/off-market-lead
 *
 * Handles NDA form submissions from the off-market page.
 * 1. Creates a ClickUp task in "Off-Market Leads" list
 * 2. Sends email notification to Michael via Resend
 * 3. Sends confirmation email to the buyer with NDA receipt
 */

interface Env {
  CLICKUP_API_KEY: string;
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

const CLICKUP_LIST_ID = '901326469668'; // Deal Hunter > Off-Market Leads

const BUYER_TYPE_LABELS: Record<string, string> = {
  principal: 'Principal Buyer',
  broker: 'Broker / Agent',
  operator: 'Operator',
  investor: 'Passive Investor / 1031',
  fund: 'Fund / Institutional',
};

const PROPERTY_TAGS: Record<string, string> = {
  soflo11: 'SoFlo-11',
  miami2: 'Miami-2',
  psl: 'PSL',
  booneville: 'Booneville',
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
    const propertyTag = PROPERTY_TAGS[body.property] || body.property;
    const signedDate = new Date(body.timestamp).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    // --- 1. Create ClickUp Task ---
    const clickupBody = {
      name: `NDA Lead: ${body.name} — ${body.propertyTitle}`,
      description: [
        `## Off-Market NDA Submission`,
        ``,
        `**Contact**`,
        `- Name: ${body.name}`,
        `- Email: ${body.email}`,
        `- Phone: ${body.phone}`,
        `- Company: ${body.company || 'N/A'}`,
        `- Buyer Type: ${buyerLabel}`,
        ``,
        `**Property:** ${body.propertyTitle}`,
        `**Property ID:** ${body.property}`,
        ``,
        `**NDA Signed**`,
        `- Electronic Signature: ${body.signature}`,
        `- Signed At: ${signedDate}`,
        `- Agreed to: NDA, Non-Circumvention, 2% Buyer Rep Commission`,
        ``,
        `*Submitted via staxre.com/off-market*`,
      ].join('\n'),
      tags: ['off-market-nda', propertyTag],
      priority: 2, // High
    };

    const clickupRes = await fetch(
      `https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ID}/task`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: context.env.CLICKUP_API_KEY,
        },
        body: JSON.stringify(clickupBody),
      }
    );

    if (!clickupRes.ok) {
      console.error('ClickUp error:', await clickupRes.text());
    }

    // --- 2. Email notification to Michael ---
    const notifyHtml = `
      <div style="font-family: Inter, sans-serif; max-width: 560px;">
        <h2 style="color: #0a0a0a; font-size: 20px;">New Off-Market NDA Submission</h2>
        <p style="color: #555;"><strong>${body.name}</strong> signed an NDA for <strong>${body.propertyTitle}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #888; font-size: 13px;">Name</td><td style="padding: 8px 0;">${body.name}</td></tr>
          <tr><td style="padding: 8px 0; color: #888; font-size: 13px;">Email</td><td style="padding: 8px 0;"><a href="mailto:${body.email}">${body.email}</a></td></tr>
          <tr><td style="padding: 8px 0; color: #888; font-size: 13px;">Phone</td><td style="padding: 8px 0;"><a href="tel:${body.phone}">${body.phone}</a></td></tr>
          <tr><td style="padding: 8px 0; color: #888; font-size: 13px;">Company</td><td style="padding: 8px 0;">${body.company || 'N/A'}</td></tr>
          <tr><td style="padding: 8px 0; color: #888; font-size: 13px;">Buyer Type</td><td style="padding: 8px 0;">${buyerLabel}</td></tr>
          <tr><td style="padding: 8px 0; color: #888; font-size: 13px;">Property</td><td style="padding: 8px 0;">${body.propertyTitle}</td></tr>
          <tr><td style="padding: 8px 0; color: #888; font-size: 13px;">Signature</td><td style="padding: 8px 0; font-style: italic;">${body.signature}</td></tr>
          <tr><td style="padding: 8px 0; color: #888; font-size: 13px;">Signed At</td><td style="padding: 8px 0;">${signedDate}</td></tr>
        </table>
        <p style="color: #888; font-size: 12px;">This lead has been added to ClickUp → Deal Hunter → Off-Market Leads.</p>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'STAX Real Estate <noreply@staxre.com>',
        to: ['michael@staxre.com'],
        subject: `NDA Signed: ${body.name} — ${body.propertyTitle}`,
        html: notifyHtml,
      }),
    });

    // --- 3. Confirmation email to buyer ---
    const confirmHtml = `
      <div style="font-family: Inter, sans-serif; max-width: 560px;">
        <img src="https://staxre.com/images/stax-logo-black.svg" alt="STAX Real Estate" style="height: 28px; margin-bottom: 24px;" />
        <h2 style="color: #0a0a0a; font-size: 22px; margin-bottom: 8px;">Confidentiality Agreement Received</h2>
        <p style="color: #555; line-height: 1.6;">Hi ${body.name.split(' ')[0]},</p>
        <p style="color: #555; line-height: 1.6;">Thank you for signing our confidentiality agreement for <strong>${body.propertyTitle}</strong>. Your signed NDA is on file.</p>
        <p style="color: #555; line-height: 1.6;">Michael Salafia will be in touch shortly with the full property package including address, financials, and offering memorandum.</p>
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

    return new Response(JSON.stringify({ success: true }), {
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
