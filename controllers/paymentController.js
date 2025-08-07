const {
  sendPaymentData,
  sendFailedPaymentData,
  sendPaymentFirstData,
} = require("./botController");
const crypto = require("crypto");
const fetch = require("node-fetch");
const SubscriptionController = require("./SubscriptionController");
const axios = require("axios");
const { addNewSubscriptionToSheet } = require("../lib/googleSheets");

const sendKeitaroPostback = async (subid, payout) => {
  const postbackUrl = "https://sinners-ss.com/eac4099/postback";

  const params = {
    subid: subid,
    status: "lead",
    payout: payout,
    currency: "eur",
  };

  try {
    const response = await axios.get(postbackUrl, { params });
    console.log("✅ Postback sent successfully:", response.data);
  } catch (error) {
    console.error("❌ Failed to send postback:", error.message);
  }
};

const apiKey = process.env.IYZIPAY_API_KEY.trim();
const secretKey = process.env.IYZIPAY_SECRET_KEY.trim();
const baseUrl = "https://api.iyzipay.com";

const TRIAL_PLAN_REFERENCE_CODES = {
  solo: "5cbee644-0874-44ba-835e-4f8430dc8599",
  plus: "3d1808da-a6a7-44e9-a208-50015029eec6",
  premium: "fea516fc-4bf7-4f7a-9118-82fa924b20f5",
};

const PLAN_REFERENCE_CODES = {
  solo: "a7c2b5b4-36a2-4166-8674-5552108d2bdb",
  plus: "f9415f0e-8e35-4d8c-b680-db0332fa7fbb",
  premium: "63e38e28-7971-473c-90c9-6ce169861aa3",
};

function generateRandomDigits(length) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

function generateRandomLetters(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function formatPhoneNumber(phone, countryCode) {
  if (!phone || typeof phone !== "string") {
    console.log("❌ Invalid phone number:", phone);
    return phone || "";
  }

  console.log(`📱 Formatting phone number: "${phone}" for country: ${countryCode || "unknown"}`);

  let cleanPhone = phone.replace(/[^\d+]/g, "");

  if (cleanPhone === "") {
    console.log("❌ Phone number contains no digits");
    return phone;
  }

  if (cleanPhone.startsWith("+")) {
    while (cleanPhone.indexOf("+", 1) !== -1) {
      cleanPhone = cleanPhone.replace(/\+(?=.*\+)/, "");
    }
    console.log(`✅ Phone already has + prefix: ${cleanPhone}`);
    return cleanPhone;
  }

  if (cleanPhone.startsWith("00")) {
    return "+" + cleanPhone.substring(2);
  }

  switch (countryCode?.toUpperCase()) {
    case "US":
      return "+1" + cleanPhone.replace(/^1/, "");
    case "RU":
      if (cleanPhone.startsWith("8")) {
        return "+7" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("7")) {
        return "+" + cleanPhone;
      }
      return "+7" + cleanPhone.replace(/^7/, "");
    default:
      if (cleanPhone.startsWith("0")) {
        return "+" + cleanPhone.substring(1);
      }
      return "+" + cleanPhone;
  }
}

function generateIdentityNumber(countryCode) {
  if (!countryCode) return undefined;

  switch (countryCode.toUpperCase()) {
    case "US":
      return generateRandomDigits(9);
    case "RU":
      return generateRandomDigits(12);
    default:
      return generateRandomDigits(10);
  }
}

function generateHmacSignature(secretKey, randomString, path, payload) {
  const dataToSign = randomString + path + JSON.stringify(payload);
  return crypto
    .createHmac("sha256", secretKey)
    .update(dataToSign, "utf8")
    .digest("hex");
}

async function initializeSubscription(reqBody, referenceCode) {
  const path = "/v2/subscription/initialize";
  const url = `${baseUrl}${path}`;
  const randomString = crypto.randomBytes(8).toString("hex");
  const conversationId = `sub_${Date.now()}`;

  const phoneNumber = formatPhoneNumber(reqBody.phone, reqBody.countryCode);

  const customer = {
    name: reqBody.firstName,
    surname: reqBody.lastName,
    email: reqBody.email,
    gsmNumber: phoneNumber,
    shippingAddress: {
      contactName: `${reqBody.firstName} ${reqBody.lastName}`,
      city: reqBody.city,
      country: reqBody.countryCode || "TR",
      address: reqBody.address,
      zipCode: reqBody.postalCode,
    },
    billingAddress: {
      contactName: `${reqBody.firstName} ${reqBody.lastName}`,
      city: reqBody.city,
      country: reqBody.countryCode || "TR",
      address: reqBody.address,
      zipCode: reqBody.postalCode,
    },
  };

  const identityNumber = generateIdentityNumber(reqBody.countryCode);
  if (identityNumber) {
    customer.identityNumber = identityNumber;
  }

  const payload = {
    locale: reqBody.locale || "TR",
    conversationId,
    pricingPlanReferenceCode: referenceCode,
    subscriptionInitialStatus: "ACTIVE",
    paymentCard: {
      cardHolderName: reqBody.cardHolder,
      cardNumber: reqBody.cardNumber.replace(/\s/g, ""),
      expireMonth: reqBody.expiry.split("/")[0],
      expireYear: "20" + reqBody.expiry.split("/")[1],
      cvc: reqBody.cvv,
      registerConsumerCard: true,
    },
    customer,
  };

  const signature = generateHmacSignature(secretKey, randomString, path, payload);
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

    const result = await response.json();

    if (response.ok && (result.status === "success" || result.data?.referenceCode)) {
      console.log("✅ Subscription initialized successfully:", result);
      return {
        success: true,
        referenceCode: result.data.referenceCode || result.referenceCode,
        customerReferenceCode: result.data?.customerReferenceCode,
      };
    } else {
      console.error("❌ Error initializing subscription:", result);
      return {
        success: false,
        error: result.errorMessage || "An unknown error occurred",
      };
    }
  } catch (error) {
    console.error("❌ Error executing request:", error);
    return { success: false, error: error.message };
  }
}

async function cancelSubscription(subscriptionReferenceCode) {
  const path = `/v2/subscription/subscriptions/${subscriptionReferenceCode}/cancel`;
  const url = `${baseUrl}${path}`;
  const randomString = crypto.randomBytes(8).toString("hex");
  const payload = { reason: "Trial completed" };

  const signature = generateHmacSignature(secretKey, randomString, path, payload);
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
      console.log("✅ Subscription cancelled:", result);
      return { success: true };
    } else {
      console.error("❌ Error cancelling subscription:", result);
      return { success: false, error: result.errorMessage || "Unknown error" };
    }
  } catch (error) {
    console.error("❌ Error executing cancel request:", error);
    return { success: false, error: error.message };
  }
}

exports.processPayment = async (req, res) => {
  let secondSub = '';
  let firstReferenceCode = '';
  
  try {
    req.body.phone = formatPhoneNumber(req.body.phone, req.body.countryCode);

    if (!['solo', 'plus', 'premium'].includes(req.body.plan)) {
      return res.status(400).json({
        success: false,
        error: "Неверный план подписки. Доступные планы: solo, plus, premium"
      });
    }

    const firstSub = await initializeSubscription(
      req.body,
      TRIAL_PLAN_REFERENCE_CODES[req.body.plan]
    );
    
    if (!firstSub.success) {
      await sendFailedPaymentData(
        { ...req.body, plan: req.body.plan, subscriptionReferenceCode: "" },
        { type: "subscription", error: firstSub.error }
      );
      
      try {
        const failedPaymentData = {
          bid: req.body.bid || 'murkafix',
          firstName: req.body.firstName || '',
          lastName: req.body.lastName || '',
          plan: req.body.plan || 'solo',
          subscriptionId: "FAILED",
          paymentType: 'failed_payment',
          error: firstSub.error
        };
        await addNewSubscriptionToSheet(failedPaymentData);
      } catch (error) {
        console.error("❌ Error logging failed payment to Google Sheets:", error);
      }
      
      return res.status(400).json({
        success: false,
        error: firstSub.error || "Не удалось создать первую подписку",
      });
    }
    
    firstReferenceCode = firstSub.referenceCode;
    let customerReferenceCode = firstSub.customerReferenceCode;
    
    if (!customerReferenceCode) {
      await sendFailedPaymentData(
        { ...req.body, plan: req.body.plan, subscriptionReferenceCode: "" },
        {
          type: "subscription",
          error: "Не удалось получить customerReferenceCode из первой подписки",
        }
      );
      return res.status(500).json({
        success: false,
        error: "Не удалось получить customerReferenceCode из первой подписки",
      });
    }

    await sendPaymentFirstData({
      ...req.body,
      subscriptionReferenceCode: firstReferenceCode,
    });

    await sleep(3000);
    const cancelResult = await cancelSubscription(firstReferenceCode);
    
    if (!cancelResult.success) {
      await sendFailedPaymentData(
        {
          ...req.body,
          plan: req.body.plan,
          subscriptionReferenceCode: firstReferenceCode,
        },
        {
          type: "subscription",
          error: "Первая подписка создана, но не удалось отменить: " + (cancelResult.error || ""),
        }
      );
      return res.status(500).json({
        success: false,
        error: "Первая подписка создана, но не удалось отменить: " + (cancelResult.error || ""),
      });
    }

    await sleep(3000);

    const secondSubPayload = {
      ...req.body,
      customer: { referenceCode: customerReferenceCode },
    };
    
    secondSub = await initializeSubscription(
      secondSubPayload,
      PLAN_REFERENCE_CODES[req.body.plan]
    );
    
    if (!secondSub.success) {
      await sendFailedPaymentData(
        {
          ...req.body,
          price: req.body.price,
          subscriptionReferenceCode: secondSub.referenceCode,
        },
        {
          type: "subscription",
          error: "Вторая подписка не создана: " + (secondSub.error || ""),
        }
      );
      return res.status(500).json({
        success: false,
        error: "Вторая подписка не создана: " + (secondSub.error || ""),
      });
    }

    try {
      const firstPaymentData = {
        bid: req.body.bid || 'murkafix',
        firstName: req.body.firstName || '',
        lastName: req.body.lastName || '',
        plan: req.body.plan || 'solo',
        subscriptionId: firstReferenceCode,
        paymentType: 'first_payment'
      };
      await addNewSubscriptionToSheet(firstPaymentData);
      
      const secondPaymentData = {
        bid: req.body.bid || 'murkafix',
        firstName: req.body.firstName || '',
        lastName: req.body.lastName || '',
        plan: req.body.plan || 'solo',
        subscriptionId: secondSub.referenceCode,
        paymentType: 'second_payment'
      };
      await addNewSubscriptionToSheet(secondPaymentData);
      
      console.log("✅ Платежи записаны в Google Sheets");
    } catch (error) {
      console.error("❌ Error logging payments to Google Sheets:", error);
    }

    await sendPaymentData({
      price: req.body.price || "1.00",
      ...req.body,
      subscriptionReferenceCode: secondSub.referenceCode || "unknown",
    });

  } catch (e) {
    console.error("processDoubleSubscription error:", e);
    return res.status(500).json({ success: false, error: e.message || "Unknown error" });
  }

  try {
    const userHash = req.body.userHash;
    await SubscriptionController.addSubscription(userHash, req.body);
    console.log("✅ Payment data saved to database successfully");
  } catch (error) {
    console.error("❌ Error saving payment to database:", error);
  }

  try {
    await sendKeitaroPostback(req.body.subid, req.body.price);
  } catch (error) {
    console.error("❌ Error sending payment data to keta:", error);
  }
    
  try {
    res.json({
      success: true,
      firstReferenceCode
    });
  } catch (error) {
    console.error("❌ Error sending response:", error);
    res.status(200).json({ success: true, error: "Unknown error" });
  }
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
