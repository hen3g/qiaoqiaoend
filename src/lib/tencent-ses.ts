import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as tencentcloud from "tencentcloud-sdk-nodejs-ses";

const SesClient = tencentcloud.ses.v20201002.Client;

const BRAND_TITLE = "敲敲英语";

function requireEnv(name: string): string {
  const value = (process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function getSesClient() {
  const secretId = requireEnv("SECRET_ID");
  const secretKey = requireEnv("SECRET_KEY");
  const region = (process.env.TENCENT_SES_REGION || "ap-guangzhou").trim();

  return new SesClient({
    credential: { secretId, secretKey },
    region,
    profile: {
      httpProfile: {
        endpoint: "ses.tencentcloudapi.com",
      },
    },
  });
}

async function loadVerificationHtml(code: string): Promise<string> {
  const filePath = path.join(process.cwd(), "verification_code_email.html");
  const raw = await readFile(filePath, "utf8");
  return raw
    .replaceAll("{{title}}", BRAND_TITLE)
    .replaceAll("{{code}}", code);
}

/**
 * Send a 6-digit bind-email verification code via Tencent Cloud SES.
 *
 * Prefers template send when TENCENT_SES_TEMPLATE_ID is set (recommended;
 * SES default). Otherwise falls back to Simple HTML from
 * verification_code_email.html (needs SES Simple permission).
 */
export async function sendVerificationCodeEmail(input: {
  to: string;
  code: string;
}): Promise<{ messageId: string }> {
  const from = requireEnv("TENCENT_SES_FROM");
  const client = getSesClient();
  const templateIdRaw = (process.env.TENCENT_SES_TEMPLATE_ID || "").trim();
  const subject = `${BRAND_TITLE}邮箱验证码`;

  const base = {
    FromEmailAddress: from,
    Destination: [input.to],
    Subject: subject,
    TriggerType: 1,
    Unsubscribe: "0",
  };

  let response: { MessageId?: string };

  if (templateIdRaw) {
    const templateId = Number(templateIdRaw);
    if (!Number.isFinite(templateId) || templateId < 1) {
      throw new Error("TENCENT_SES_TEMPLATE_ID is invalid");
    }
    response = await client.SendEmail({
      ...base,
      Template: {
        TemplateID: templateId,
        // 模板变量：verification_code_email.html 的 {{title}} / {{code}}
        TemplateData: JSON.stringify({
          title: BRAND_TITLE,
          code: input.code,
        }),
      },
    });
  } else {
    const html = await loadVerificationHtml(input.code);
    response = await client.SendEmail({
      ...base,
      Simple: {
        Html: Buffer.from(html, "utf8").toString("base64"),
        Text: Buffer.from(
          `您的验证码是 ${input.code}，30 分钟内有效。`,
          "utf8",
        ).toString("base64"),
      },
    });
  }

  return { messageId: response.MessageId || "" };
}
