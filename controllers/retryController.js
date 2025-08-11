const crypto = require("crypto");
const fetch = require("node-fetch");

const apiKey = (process.env.IYZIPAY_API_KEY || '').trim();
const secretKey = (process.env.IYZIPAY_SECRET_KEY || '').trim();
const baseUrl = process.env.IYZIPAY_BASE_URL || "https://api.iyzipay.com";

function generateHmacSignature(secretKey, randomString, path, payload) {
  const dataToSign = randomString + path + JSON.stringify(payload);
  return crypto
    .createHmac("sha256", secretKey)
    .update(dataToSign, "utf8")
    .digest("hex");
}

async function retrySubscription(referenceCode) {
  const path = "/operation/retry";
  const url = `${baseUrl}${path}`;
  const randomString = crypto.randomBytes(8).toString("hex");
  const payload = { referenceCode };

  const signature = generateHmacSignature(
    secretKey,
    randomString,
    path,
    payload
  );
  const authRaw = `apiKey:${apiKey}&randomKey:${randomString}&signature:${signature}`;
  const base64Auth = Buffer.from(authRaw, "utf8").toString("base64");
  const authorization = `IYZWSv2 ${base64Auth}`;

  const headers = {
    Authorization: authorization,
    "Content-Type": "application/json",
    "x-iyzi-rnd": randomString,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const result = await response?.json();
    if (response?.ok && result?.status === "success") {
      console.log("✅ Subscription retry initiated:", result);
      return { success: true, systemTime: result.systemTime };
    } else {
      console.error("❌ Error retrying subscription:", result);
      return { success: false, error: result.errorMessage || "Unknown error" };
    }
  } catch (error) {
    console.error("❌ Error executing retry request:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  retrySubscription
};
