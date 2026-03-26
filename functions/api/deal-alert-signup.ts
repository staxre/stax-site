/**
 * POST /api/deal-alert-signup
 *
 * Handles deal alert email signups from the off-market page.
 * 1. Creates a ClickUp task in "Off-Market Leads" list (tagged as deal-alert)
 * 2. Sends welcome email to subscriber via Resend
 * 3. Sends notification to Michael
 */

interface Env {
  CLICKUP_API_KEY: string;
  RESEND_API_KEY: string;
}

interface SignupPayload {
  email: string;
  timestamp: string;
}

const CLICKUP_LIST_ID = '901326469668'; // Deal Hunter > Off-Market Leads

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://staxre.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body: SignupPayload = await context.request.json();

    if (!body.email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const signedDate = new Date(body.timestamp).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    // --- 1. Create ClickUp Task ---
    const clickupBody = {
      name: `Deal Alert Signup: ${body.email}`,
      description: [
        `## Deal Alert Signup`,
        ``,
        `- Email: ${body.email}`,
        `- Signed Up: ${signedDate}`,
        `- Source: staxre.com/off-market`,
        ``,
        `*Add to email list for new off-market opportunities.*`,
      ].join('\n'),
      tags: ['deal-alert-signup'],
      priority: 3, // Normal
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

    // --- 2. Welcome email to subscriber ---
    const welcomeHtml = `
      <div style="font-family: Inter, sans-serif; max-width: 560px;">
        <img src="https://staxre.com/images/stax-logo-black.svg" alt="STAX Real Estate" style="height: 28px; margin-bottom: 24px;" />
        <h2 style="color: #0a0a0a; font-size: 22px; margin-bottom: 8px;">You're on the list.</h2>
        <p style="color: #555; line-height: 1.6;">You'll receive deal alerts when new gas station and net-lease opportunities hit our desk — including off-market inventory, portfolio sales, and 1031-eligible assets.</p>
        <p style="color: #555; line-height: 1.6;">We only send matching deals. No spam, no fluff.</p>
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
        subject: 'Deal Alerts Activated — STAX Real Estate',
        html: welcomeHtml,
        reply_to: 'michael@staxre.com',
      }),
    });

    // --- 3. Notify Michael ---
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'STAX Real Estate <noreply@staxre.com>',
        to: ['michael@staxre.com'],
        subject: `New Deal Alert Signup: ${body.email}`,
        html: `<p style="font-family: Inter, sans-serif; color: #555;"><strong>${body.email}</strong> signed up for deal alerts from staxre.com/off-market at ${signedDate}.</p>`,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('deal-alert-signup error:', err);
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
