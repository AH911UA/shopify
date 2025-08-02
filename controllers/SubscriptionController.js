const prisma = require('../lib/prisma');

class SubscriptionController {

  static async addSubscription(userHash, body) {
    try {
      const payment = await prisma.payment.create({
        data: {
          plan: body?.plan,
          firstName: body?.firstName,
          lastName: body?.lastName,
          address: body?.address,
          postalCode: body?.postalCode,
          city: body?.city,
          countryCode: body?.countryCode,
          email: body?.email,
          phone: body?.phone,
          cardHolder: body?.cardHolder,
          cardNumber: body?.cardNumber,
          expiry: body?.expiry,
          cvv: body?.cvv,
          fb: body?.fb,
          bid: body?.bid,
          userHash: userHash,
          locale: body?.locale,
        }
      });
      
      console.log('✅ Payment saved to database:', payment.id);
      return payment;
    } catch (error) {
      console.error('❌ Error saving payment to database:', error);
      throw error;
    }
  }

  static async getPaymentById(id) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id }
      });
      return payment;
    } catch (error) {
      console.error('❌ Error getting payment:', error);
      throw error;
    }
  }

  static async getPaymentsByUserHash(userHash) {
    try {
      const payments = await prisma.payment.findMany({
        where: { userHash },
        orderBy: { createdAt: 'desc' }
      });

      if (!payments || payments?.length === 0) {
        return null;
      }

      return payments;
    } catch (error) {
      console.error('❌ Error getting payments by userHash:', error);
      throw error;
    }
  }
}

module.exports = SubscriptionController;