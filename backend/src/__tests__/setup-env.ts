process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-minimum-32-characters";
process.env.ORDER_TRACKING_SECRET = process.env.ORDER_TRACKING_SECRET || "test-order-tracking-secret-32chars";

process.env.PAYMENT_PROFILE_ENCRYPTION_KEY = process.env.PAYMENT_PROFILE_ENCRYPTION_KEY || "test-payment-profile-encryption-key-32chars";