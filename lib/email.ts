import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface RunSummary {
  to: string
  batchName?: string
  processed: number
  errors: number
  mentionedCount: number
  citedCount: number
  totalResults: number
}

export async function sendRunCompleteEmail(summary: RunSummary) {
  const mentionRate = summary.totalResults > 0
    ? Math.round((summary.mentionedCount / summary.totalResults) * 100)
    : 0
  const citationRate = summary.totalResults > 0
    ? Math.round((summary.citedCount / summary.totalResults) * 100)
    : 0

  const subject = summary.batchName
    ? `Run complete: ${summary.batchName}`
    : 'AI Visibility run complete'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f0f4f7;font-family:'Nunito',Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dde6ea;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(90deg,#084c61 0%,#054166 100%);padding:32px 40px;">
              <p style="margin:0;font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);letter-spacing:1.5px;text-transform:uppercase;">Senior Lifestyle</p>
              <h1 style="margin:4px 0 0;font-size:22px;font-weight:700;color:#ffffff;">AI Visibility Dashboard</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="margin:0 0 6px;font-size:18px;color:#084c61;">Your run is complete</h2>
              <p style="margin:0 0 28px;font-size:14px;color:#5a7a85;line-height:1.6;">
                ${summary.batchName ? `Batch <strong style="color:#084c61;">${summary.batchName}</strong> has finished processing.` : 'Your prompt batch has finished processing.'}
                ${summary.errors > 0 ? ` <span style="color:#e05252;">${summary.errors} platform error${summary.errors !== 1 ? 's' : ''} occurred.</span>` : ''}
              </p>

              <!-- Stats row -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td width="33%" style="padding-right:8px;">
                    <div style="background:#f0f4f7;border-radius:12px;padding:16px;text-align:center;">
                      <p style="margin:0;font-size:28px;font-weight:700;color:#084c61;">${summary.processed}</p>
                      <p style="margin:4px 0 0;font-size:11px;color:#5a7a85;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Prompts Run</p>
                    </div>
                  </td>
                  <td width="33%" style="padding:0 4px;">
                    <div style="background:#f0f4f7;border-radius:12px;padding:16px;text-align:center;">
                      <p style="margin:0;font-size:28px;font-weight:700;color:${mentionRate >= 60 ? '#059669' : mentionRate >= 30 ? '#d97706' : '#e05252'};">${mentionRate}%</p>
                      <p style="margin:4px 0 0;font-size:11px;color:#5a7a85;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Mention Rate</p>
                    </div>
                  </td>
                  <td width="33%" style="padding-left:8px;">
                    <div style="background:#f0f4f7;border-radius:12px;padding:16px;text-align:center;">
                      <p style="margin:0;font-size:28px;font-weight:700;color:${citationRate >= 60 ? '#059669' : citationRate >= 30 ? '#d97706' : '#e05252'};">${citationRate}%</p>
                      <p style="margin:4px 0 0;font-size:11px;color:#5a7a85;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Citation Rate</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-app.vercel.app'}/dashboard"
                       style="display:inline-block;background:#084c61;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 32px;border-radius:8px;">
                      View Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #eef3f5;text-align:center;">
              <p style="margin:0;font-size:11px;color:#8aadb8;">Senior Lifestyle AI Visibility Dashboard</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  await resend.emails.send({
    from: 'AI Visibility Dashboard <notifications@resend.dev>',
    to: summary.to,
    subject,
    html,
  })
}
