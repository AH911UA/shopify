-- CreateTable
CREATE TABLE "Payment" (
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
    "locale" TEXT
);
