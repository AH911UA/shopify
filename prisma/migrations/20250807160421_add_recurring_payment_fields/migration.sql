-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "plan" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "countryCode" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "cardHolder" TEXT,
    "cardNumber" TEXT,
    "expiry" TEXT,
    "cvv" TEXT,
    "fb" TEXT,
    "bid" TEXT,
    "userHash" TEXT,
    "locale" TEXT,
    "subscriptionReferenceCode" TEXT,
    "isFirstPayment" BOOLEAN NOT NULL DEFAULT false,
    "isSecondPayment" BOOLEAN NOT NULL DEFAULT false,
    "customerReferenceCode" TEXT,
    "firstReferenceCode" TEXT,
    "isRecurringPayment" BOOLEAN NOT NULL DEFAULT false,
    "recurringPaymentDate" DATETIME,
    "nextRecurringDate" DATETIME
);
INSERT INTO "new_Payment" ("address", "bid", "cardHolder", "cardNumber", "city", "countryCode", "createdAt", "customerReferenceCode", "cvv", "email", "expiry", "fb", "firstName", "firstReferenceCode", "id", "isFirstPayment", "isSecondPayment", "lastName", "locale", "phone", "plan", "postalCode", "subscriptionReferenceCode", "updatedAt", "userHash") SELECT "address", "bid", "cardHolder", "cardNumber", "city", "countryCode", "createdAt", "customerReferenceCode", "cvv", "email", "expiry", "fb", "firstName", "firstReferenceCode", "id", "isFirstPayment", "isSecondPayment", "lastName", "locale", "phone", "plan", "postalCode", "subscriptionReferenceCode", "updatedAt", "userHash" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
