import { prisma } from "./prisma";

type WhatsAppInput = {
  registrationId?: string;
  phone: string;
  trigger: string;
  templateName?: string;
  language?: string;
  parameters?: string[];
};

function configured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function sendWhatsAppTemplate(input: WhatsAppInput) {
  const phone = normalizePhone(input.phone);
  if (!configured()) {
    await prisma.whatsAppLog.create({
      data: {
        registrationId: input.registrationId,
        phone,
        trigger: input.trigger,
        status: "Skipped",
        error: "WhatsApp Cloud API is not configured."
      }
    });
    return { status: "skipped" as const };
  }

  const templateName = input.templateName || process.env.WHATSAPP_TEMPLATE_NAME;
  if (!templateName) {
    await prisma.whatsAppLog.create({
      data: {
        registrationId: input.registrationId,
        phone,
        trigger: input.trigger,
        status: "Skipped",
        error: "WhatsApp template name is not configured."
      }
    });
    return { status: "skipped" as const };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: input.language || process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US" },
          ...(input.parameters?.length
            ? {
                components: [
                  {
                    type: "body",
                    parameters: input.parameters.map((text) => ({ type: "text", text }))
                  }
                ]
              }
            : {})
        }
      })
    });
    const payload = await response.json().catch(() => ({}));
    const messageId = payload.messages?.[0]?.id || null;
    await prisma.whatsAppLog.create({
      data: {
        registrationId: input.registrationId,
        phone,
        trigger: input.trigger,
        status: response.ok ? "Sent" : "Failed",
        messageId,
        error: response.ok ? null : JSON.stringify(payload).slice(0, 1000)
      }
    });
    return { status: response.ok ? "sent" as const : "failed" as const, messageId };
  } catch (error) {
    await prisma.whatsAppLog.create({
      data: {
        registrationId: input.registrationId,
        phone,
        trigger: input.trigger,
        status: "Failed",
        error: error instanceof Error ? error.message : "Unknown WhatsApp error"
      }
    });
    return { status: "failed" as const };
  }
}

